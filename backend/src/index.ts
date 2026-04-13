import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import configRouter from "./routes/config.js";
import analyzeRouter, { setAnalysis } from "./routes/analyze.js";
import { setupWebSocket, broadcast } from "./ws.js";
import { parsePrUrl, fetchPR, createOctokit } from "./services/github.js";
import { analyzeFilesBatch } from "./services/agents/file-analyzer-batch.js";
import { clusterFiles } from "./services/agents/clustering.js";
import { rankAndSynthesize } from "./services/agents/ranking.js";
import { runPipeline } from "./services/pipeline.js";
import { ClaudeCliClient } from "./services/claude-cli-client.js";
import { AnthropicSdkClient } from "./services/anthropic-sdk-client.js";
import type { LLMClient } from "./services/llm-client.js";

const app = express();
app.use(express.json());

app.use("/api/config", configRouter);
app.use("/api/analyze", analyzeRouter);
app.use("/api/analysis", analyzeRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.VITEST ? 0 : parseInt(process.env.PORT || "9000", 10);
const httpServer = http.createServer(app);
const wss = setupWebSocket(httpServer);

/**
 * Create the LLM client based on available config.
 * Priority: explicit API key > env var > Claude CLI
 */
function createLLMClient(anthropicKey?: string): LLMClient {
  const key = anthropicKey || process.env.ANTHROPIC_API_KEY;
  if (key) {
    return new AnthropicSdkClient(key);
  }
  return new ClaudeCliClient();
}

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

    const analysis = await runPipeline(prData, {
      analyzeFiles: (files, onProgress) => analyzeFilesBatch(files, client, onProgress),
      clusterFiles: (files) => clusterFiles(files, client),
      rankAndSynthesize: (metadata, clusters) =>
        rankAndSynthesize(metadata, clusters, client),
      onMessage: (msg) => broadcast(wss, msg),
    });

    setAnalysis(analysisId, analysis);
  } catch (err: any) {
    const message = err instanceof Error ? err.message : String(err);
    broadcast(wss, { type: "error", error: message });
    setAnalysis(analysisId, { status: "error", error: message });
  }
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
