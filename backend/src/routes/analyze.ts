import { Router } from "express";
import { parsePrUrl } from "../services/github.js";
import type { PRAnalysis, AnalyzeRequest } from "../types.js";
import { v4 as uuidv4 } from "uuid";
import type { AnalysisCache } from "../services/analysis-cache.js";
import { buildCommitStack } from "../services/commit-stack.js";
import type { CommitStack } from "../services/commit-stack.js";
import { annotateStackStatuses } from "../services/stack-runner.js";

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

/**
 * Stack endpoint router — mounted at `/api/pr` in index.ts.
 *
 * `GET /api/pr/:owner/:repo/:num/stack` builds the commit stack for a PR,
 * returns the metadata immediately (with cache-aware per-level statuses),
 * and fans out per-level pipelines in the background. Per-level results
 * arrive via WebSocket as `levelReady` / `levelError` events.
 *
 * The actual pipeline orchestration is wired into `app.locals.startStackRun`
 * in index.ts so this router stays thin and the LLM client / WS broadcaster
 * remain controlled by the app entrypoint (matching the existing pattern
 * for `startPipeline`).
 */
export const stackRouter = Router();

stackRouter.get("/:owner/:repo/:num/stack", async (req, res) => {
  const { owner, repo, num } = req.params;
  const number = parseInt(num, 10);

  if (!Number.isFinite(number) || number <= 0) {
    res.status(400).json({ error: "PR number must be a positive integer" });
    return;
  }

  // Same auth conventions as POST /api/analyze.
  const headerToken =
    typeof req.headers["x-github-token"] === "string"
      ? (req.headers["x-github-token"] as string)
      : undefined;
  const effectiveGithubToken = headerToken || process.env.GITHUB_TOKEN;
  if (!effectiveGithubToken) {
    res.status(400).json({ error: "GitHub token required (set GITHUB_TOKEN or pass x-github-token)" });
    return;
  }
  const effectiveAnthropicKey =
    (typeof req.headers["x-anthropic-key"] === "string"
      ? (req.headers["x-anthropic-key"] as string)
      : undefined) || process.env.ANTHROPIC_API_KEY || undefined;

  const cache = req.app.locals.analysisCache as AnalysisCache | undefined;

  let stack: CommitStack;
  try {
    stack = await buildCommitStack({
      owner,
      repo,
      number,
      githubToken: effectiveGithubToken,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // Mirror the existing analyze.ts error shape.
    res.status(502).json({ error: `Failed to build commit stack: ${message}` });
    return;
  }

  // Cache-aware per-level statuses. If we have no cache (shouldn't happen in
  // production), every level is "pending".
  const levels = cache
    ? await annotateStackStatuses(stack, cache)
    : stack.levels.map(({ status: _s, ...rest }) => ({ ...rest, status: "pending" as const }));

  // Send the response immediately — pipeline runs proceed in the background.
  res.json({
    prUrl: stack.prUrl,
    baseSha: stack.baseSha,
    headSha: stack.headSha,
    levels,
  });

  // Kick off the pipeline runs *after* the response, via the app-level
  // launcher (mirrors `startPipeline` for the single-PR flow). If the
  // launcher isn't wired (e.g. a test that doesn't need it), skip silently.
  const startStackRun = req.app.locals.startStackRun as
    | ((stack: CommitStack, owner: string, repo: string, githubToken: string, anthropicKey?: string) => void)
    | undefined;
  if (startStackRun) {
    startStackRun(stack, owner, repo, effectiveGithubToken, effectiveAnthropicKey);
  }
});

export default router;
