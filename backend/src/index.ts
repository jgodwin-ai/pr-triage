import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import configRouter from "./routes/config.js";
import analyzeRouter, { setAnalysis } from "./routes/analyze.js";
import reviewRouter from "./routes/review.js";
import chatRouter from "./routes/chat.js";
import { setupWebSocket, broadcast } from "./ws.js";
import { parsePrUrl, fetchPR, createOctokit } from "./services/github.js";
import { analyzeFilesBatch } from "./services/agents/file-analyzer-batch.js";
import { clusterFiles } from "./services/agents/clustering.js";
import { rankAndSynthesize } from "./services/agents/ranking.js";
import { runPipeline } from "./services/pipeline.js";
import type { LLMClient } from "./services/llm-client.js";
import { createLLMClient } from "./services/create-llm-client.js";
import { AnalysisCache } from "./services/analysis-cache.js";

const app = express();
app.use(express.json());

app.use("/api/config", configRouter);
app.use("/api/analyze", analyzeRouter);
app.use("/api/analysis", analyzeRouter);
app.use("/api/review", reviewRouter);
app.use("/api/chat", chatRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.VITEST ? 0 : parseInt(process.env.PORT || "9000", 10);
const httpServer = http.createServer(app);
const wss = setupWebSocket(httpServer);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cacheDir = process.env.ANALYSIS_CACHE_DIR ?? path.join(__dirname, "..", ".cache", "analyses");
const analysisCache = new AnalysisCache(cacheDir);

// Wire up the pipeline launcher
app.locals.startPipeline = async (
  analysisId: string,
  prUrl: string,
  githubToken: string,
  anthropicKey?: string,
) => {
  try {
    const client = createLLMClient(anthropicKey);
    const octokit = createOctokit(githubToken);
    const parts = parsePrUrl(prUrl);

    broadcast(wss, { type: "status", stage: "fetching-pr", progress: "loading PR data" });
    const prData = await fetchPR(parts, octokit);

    // Prioritize source files over build artifacts / coverage when capping.
    const skipPatterns = /\/(coverage|dist|node_modules|\.cache)\//;
    prData.files.sort((a, b) => {
      const aSkip = skipPatterns.test(a.filename) ? 1 : 0;
      const bSkip = skipPatterns.test(b.filename) ? 1 : 0;
      return aSkip - bSkip;
    });

    // Throttle: cap files analyzed to avoid long waits on mega-PRs.
    const maxFiles = parseInt(process.env.MAX_FILES_ANALYZED ?? "10", 10);
    if (prData.files.length > maxFiles) {
      console.log(`[pipeline] capping analysis to ${maxFiles} of ${prData.files.length} files (skipping coverage/dist)`);
      prData.files = prData.files.slice(0, maxFiles);
      prData.metadata.fileCount = maxFiles;
    }

    const cached = await analysisCache.get(prUrl, prData.metadata.headSha);
    if (cached) {
      broadcast(wss, { type: "complete", analysis: cached });
      setAnalysis(analysisId, cached);
      return;
    }

    const analysis = await runPipeline(prData, {
      analyzeFiles: (files, onProgress) => analyzeFilesBatch(files, client, onProgress),
      clusterFiles: (files) => clusterFiles(files, client),
      rankAndSynthesize: (metadata, clusters) =>
        rankAndSynthesize(metadata, clusters, client),
      onMessage: (msg) => broadcast(wss, msg),
    });

    await analysisCache.set(prUrl, prData.metadata.headSha, analysis);
    setAnalysis(analysisId, analysis);
  } catch (err: any) {
    const message = err instanceof Error ? err.message : String(err);
    broadcast(wss, { type: "error", error: message });
    setAnalysis(analysisId, { status: "error", error: message });
  }
};

// Serve frontend static files in production
if (process.env.NODE_ENV === "production") {
  const publicDir = path.join(__dirname, "..", "public");
  app.use(express.static(publicDir));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

const server = httpServer.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});

export { app, server };
