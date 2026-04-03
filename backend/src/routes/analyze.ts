import { Router } from "express";
import { parsePrUrl } from "../services/github.js";
import type { PRAnalysis, AnalyzeRequest } from "../types.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// In-memory store for analysis results
const analyses = new Map<string, PRAnalysis | { status: "running" }>();

export function getAnalysis(id: string): PRAnalysis | { status: "running" } | undefined {
  return analyses.get(id);
}

export function setAnalysis(id: string, value: PRAnalysis | { status: "running" }): void {
  analyses.set(id, value);
}

router.post("/", (req, res) => {
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

  const effectiveAnthropicKey = anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  const effectiveGithubToken = githubToken || process.env.GITHUB_TOKEN;

  if (!effectiveAnthropicKey) {
    res.status(400).json({ error: "Anthropic API key required (set ANTHROPIC_API_KEY or pass anthropicApiKey)" });
    return;
  }

  if (!effectiveGithubToken) {
    res.status(400).json({ error: "GitHub token required (set GITHUB_TOKEN or pass githubToken)" });
    return;
  }

  const analysisId = uuidv4();
  analyses.set(analysisId, { status: "running" });

  // Fire-and-forget: the actual pipeline runs async and updates via WS + store
  if (req.app.locals.startPipeline) {
    req.app.locals.startPipeline(analysisId, prUrl, effectiveAnthropicKey, effectiveGithubToken);
  }

  res.status(202).json({ analysisId });
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
