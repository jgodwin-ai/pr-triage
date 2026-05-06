/**
 * stack-runner — orchestrates per-commit pipelines for a virtual stacked PR.
 *
 * Given a `CommitStack` (built by `commit-stack.ts`), this service:
 *   1. Filters out noise levels — they are NOT analyzed and emit no events.
 *   2. Looks up each remaining level in the analysis cache by
 *      `(prUrl, commitSha)` and emits a synthetic `levelReady` event for
 *      cache hits so frontends can render the cached analysis immediately.
 *   3. For cache misses, fetches the per-commit diff slice (via
 *      `octokit.rest.repos.compareCommits`, between the level's `parentSha`
 *      and `sha`), runs `runPipelineForCommit`, and emits `levelReady` on
 *      success or `levelError` on failure.
 *   4. Caps concurrency at 3 — per-commit pipelines are LLM-heavy.
 *
 * Pipeline status / progress events emitted by `runPipelineCore` (`status`,
 * `partial`, `complete`, `error`) are intentionally swallowed here — they
 * carry no SHA context and would confuse single-PR consumers listening on
 * the same socket. Stack consumers only care about `levelReady` /
 * `levelError`. The whole-PR `/api/analyze` flow continues to use the
 * existing forwarding in `index.ts` and is unaffected.
 */

import type { Octokit } from "octokit";
import type { CommitStack, StackLevel } from "./commit-stack.js";
import type { AnalysisCache } from "./analysis-cache.js";
import type { PRAnalysis, PRMetadata, WSMessage } from "../types.js";
import { runPipelineForCommit } from "./pipeline.js";
import type { FileAnalysis, ChangeCluster } from "../types.js";

export interface StackRunnerDeps {
  /** Used to fetch per-commit diff slices via compareCommits. */
  octokit: Octokit;
  owner: string;
  repo: string;
  /** Cache for `(prUrl, commitSha)` analyses. */
  cache: AnalysisCache;
  /** PR metadata to thread through to the pipeline (cluster names, etc.). */
  prMetadata: PRMetadata;
  /** Pipeline agent dependencies — injected so callers control LLM client. */
  analyzeFiles: (
    files: Array<{ filename: string; patch: string }>,
    onProgress: (done: number, total: number) => void,
  ) => Promise<FileAnalysis[]>;
  clusterFiles: (files: FileAnalysis[]) => Promise<ChangeCluster[]>;
  rankAndSynthesize: (
    metadata: PRMetadata,
    clusters: ChangeCluster[],
  ) => Promise<{ executiveSummary: string; timeSaved: string; clusters: ChangeCluster[] }>;
  /** Emitter for per-level WS events. */
  emit: (msg: WSMessage) => void;
  /** Concurrency cap for per-commit pipelines. Defaults to 3. */
  concurrency?: number;
}

/**
 * Fetch the per-commit diff slice between `parentSha` and `sha` and shape
 * it into the `{ filename, patch }[]` form the pipeline expects.
 *
 * Uses `compareCommits` so the slice always lines up with the stack's
 * logical parent chain (which is the previous PR commit, not necessarily
 * the git parent).
 */
async function fetchLevelDiff(
  octokit: Octokit,
  owner: string,
  repo: string,
  parentSha: string,
  sha: string,
): Promise<Array<{ filename: string; patch: string }>> {
  const res = await octokit.rest.repos.compareCommits({
    owner,
    repo,
    base: parentSha,
    head: sha,
  });
  const files: Array<{ filename?: string; patch?: string }> = (res.data as any).files ?? [];
  return files
    .filter((f) => typeof f.filename === "string" && typeof f.patch === "string")
    .map((f) => ({ filename: f.filename as string, patch: f.patch as string }));
}

/**
 * Run pipelines for every non-noise level of `stack`, honoring the cache
 * and emitting `levelReady` / `levelError` events as each finishes.
 *
 * Resolves once every dispatched pipeline has settled. Failures of one
 * level do not abort the others — each is captured and emitted as a
 * `levelError` event.
 */
export async function runStack(stack: CommitStack, deps: StackRunnerDeps): Promise<void> {
  const concurrency = deps.concurrency ?? 3;
  const pLimit = (await import("p-limit")).default;
  const limit = pLimit(concurrency);

  const tasks: Array<Promise<void>> = [];

  for (const level of stack.levels) {
    if (level.kind === "noise") continue; // skip — not analyzed
    tasks.push(
      limit(async () => {
        try {
          // Cache check — emit synthetic levelReady so the UI can paint
          // immediately without waiting on a re-run.
          const cached = await deps.cache.get(stack.prUrl, level.sha);
          if (cached) {
            deps.emit({ type: "levelReady", sha: level.sha, analysis: cached });
            return;
          }

          const files = await fetchLevelDiff(
            deps.octokit,
            deps.owner,
            deps.repo,
            level.parentSha,
            level.sha,
          );

          // Pipeline events are intentionally dropped here — the stack
          // consumer only cares about level-grain success/failure. See
          // file header for rationale.
          const analysis: PRAnalysis = await runPipelineForCommit(
            {
              metadata: deps.prMetadata,
              commitSha: level.sha,
              parentSha: level.parentSha,
              files,
            },
            {
              analyzeFiles: deps.analyzeFiles,
              clusterFiles: deps.clusterFiles,
              rankAndSynthesize: deps.rankAndSynthesize,
              onMessage: () => {
                /* noop — see header */
              },
            },
          );

          await deps.cache.set(stack.prUrl, level.sha, analysis);
          deps.emit({ type: "levelReady", sha: level.sha, analysis });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          deps.emit({ type: "levelError", sha: level.sha, error: message });
        }
      }),
    );
  }

  await Promise.all(tasks);
}

/**
 * Shape of a level on the immediate HTTP response. Mirrors `StackLevel`
 * but with `status` reflecting cache state (`"ready"` if already analyzed,
 * `"pending"` otherwise) and an optional `analysis` payload for cache hits.
 *
 * Noise levels always report `status: "pending"` — they will never be
 * analyzed, so the frontend should treat them as terminal (see commit-stack
 * docs for the noise classifier behavior). They are NOT marked `"ready"`
 * because no analysis exists for them.
 */
export interface StackLevelResponse extends Omit<StackLevel, "status"> {
  status: "pending" | "ready";
  analysis?: PRAnalysis;
}

/**
 * Annotate stack levels for the immediate HTTP response based on cache state.
 */
export async function annotateStackStatuses(
  stack: CommitStack,
  cache: AnalysisCache,
): Promise<StackLevelResponse[]> {
  const out: StackLevelResponse[] = [];
  for (const level of stack.levels) {
    const { status: _ignored, ...rest } = level;
    if (level.kind === "noise") {
      out.push({ ...rest, status: "pending" });
      continue;
    }
    const cached = await cache.get(stack.prUrl, level.sha);
    if (cached) {
      out.push({ ...rest, status: "ready", analysis: cached });
    } else {
      out.push({ ...rest, status: "pending" });
    }
  }
  return out;
}
