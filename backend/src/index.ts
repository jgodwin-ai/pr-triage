import express from "express";
import http from "http";
import Anthropic from "@anthropic-ai/sdk";
import configRouter from "./routes/config.js";
import analyzeRouter, { setAnalysis } from "./routes/analyze.js";
import { setupWebSocket, broadcast } from "./ws.js";
import { parsePrUrl, fetchPR, createOctokit } from "./services/github.js";
import { analyzeFile } from "./services/agents/file-analyzer.js";
import { clusterFiles } from "./services/agents/clustering.js";
import { rankAndSynthesize } from "./services/agents/ranking.js";
import { runPipeline } from "./services/pipeline.js";

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

// Wire up the pipeline launcher
app.locals.startPipeline = async (
  analysisId: string,
  prUrl: string,
  anthropicKey: string,
  githubToken: string
) => {
  try {
    const client = new Anthropic({ apiKey: anthropicKey });
    const octokit = createOctokit(githubToken);
    const parts = parsePrUrl(prUrl);

    broadcast(wss, { type: "status", stage: "fetching-pr", progress: "loading PR data" });
    const prData = await fetchPR(parts, octokit);

    const analysis = await runPipeline(prData, {
      analyzeFile: (file) => analyzeFile(file, client),
      clusterFiles: (files) => clusterFiles(files, client),
      rankAndSynthesize: (metadata, clusters) =>
        rankAndSynthesize(metadata, clusters, client),
      onMessage: (msg) => broadcast(wss, msg),
    });

    setAnalysis(analysisId, analysis);
  } catch (err: any) {
    broadcast(wss, { type: "error", error: err.message });
  }
};

const server = httpServer.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});

export { app, server };
