import { Router } from "express";
import { parsePrUrl } from "../services/github.js";
import type { PRAnalysis, AnalyzeRequest } from "../types.js";
import { v4 as uuidv4 } from "uuid";
import type { AnalysisCache } from "../services/analysis-cache.js";

const router = Router();

// In-memory store for analysis results
const analyses = new Map<string, PRAnalysis | { status: "running" } | { status: "error"; error: string }>();

const MAX_ANALYSES = 100;

function pruneAnalyses(): void {
  if (analyses.size <= MAX_ANALYSES) return;
  const toDelete = analyses.size - MAX_ANALYSES;
  let deleted = 0;
  for (const key of analyses.keys()) {
    if (deleted >= toDelete) break;
    analyses.delete(key);
    deleted++;
  }
}

export function getAnalysis(id: string): PRAnalysis | { status: "running" } | { status: "error"; error: string } | undefined {
  return analyses.get(id);
}

export function setAnalysis(id: string, value: PRAnalysis | { status: "running" } | { status: "error"; error: string }): void {
  analyses.set(id, value);
}

router.post("/", (req, res) => {
  pruneAnalyses();
  const { prUrl, anthropicApiKey, githubToken } = req.body as AnalyzeRequest;

  if (!prUrl) {
    res.status(400).json({ error: "prUrl is required" });
    return;
  }

  try {
    parsePrUrl(prUrl);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
    return;
  }

  const effectiveGithubToken = githubToken || process.env.GITHUB_TOKEN;

  if (!effectiveGithubToken) {
    res.status(400).json({ error: "GitHub token required (set GITHUB_TOKEN or pass githubToken)" });
    return;
  }

  // Anthropic key is optional — falls back to Claude CLI if not provided
  const effectiveAnthropicKey = anthropicApiKey || process.env.ANTHROPIC_API_KEY || undefined;

  const analysisId = uuidv4();
  analyses.set(analysisId, { status: "running" });

  if (req.app.locals.startPipeline) {
    req.app.locals.startPipeline(analysisId, prUrl, effectiveGithubToken, effectiveAnthropicKey);
  }

  res.status(202).json({ analysisId });
});

router.get("/samples", async (req, res) => {
  const cache = req.app.locals.analysisCache as AnalysisCache | undefined;
  if (!cache) {
    res.status(503).json({ error: "Cache not configured" });
    return;
  }
  const items = await cache.list();
  res.json({ samples: items });
});

router.get("/samples/:key", async (req, res) => {
  const cache = req.app.locals.analysisCache as AnalysisCache | undefined;
  if (!cache) {
    res.status(503).json({ error: "Cache not configured" });
    return;
  }
  const analysis = await cache.getByKey(req.params.key);
  if (!analysis) {
    res.status(404).json({ error: "Sample not found" });
    return;
  }
  res.json({ analysis });
});

router.get("/:id", (req, res) => {
  const result = analyses.get(req.params.id);
  if (!result) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }
  res.json(result);
});

export default router;
