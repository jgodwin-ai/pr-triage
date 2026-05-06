import { v4 as uuidv4 } from "uuid";
import type {
  PRAnalysis,
  PRMetadata,
  FileAnalysis,
  ChangeCluster,
  WSMessage,
} from "../types.js";

interface PRData {
  metadata: PRMetadata;
  files: Array<{ filename: string; patch: string }>;
}

/**
 * Per-commit pipeline input.
 *
 * Used by the virtual stacked-PR flow (Phase 1.7) where each commit is
 * analyzed against its parent. `files` is the slice of changes for this
 * commit only (commit N vs N-1, or vs PR base for the first commit).
 *
 * The output is the same `PRAnalysis` shape — downstream consumers stay
 * agnostic to whether analysis ran on a slice or the full PR. The
 * returned `pr.headSha` is set to `commitSha` so cache lookups by commit
 * SHA stay coherent.
 */
interface CommitPipelineData {
  metadata: PRMetadata;
  commitSha: string;
  parentSha: string;
  files: Array<{ filename: string; patch: string }>;
}

interface PipelineDeps {
  analyzeFiles: (
    files: Array<{ filename: string; patch: string }>,
    onProgress: (done: number, total: number) => void,
  ) => Promise<FileAnalysis[]>;
  clusterFiles: (files: FileAnalysis[]) => Promise<ChangeCluster[]>;
  rankAndSynthesize: (
    metadata: PRMetadata,
    clusters: ChangeCluster[]
  ) => Promise<{ executiveSummary: string; timeSaved: string; clusters: ChangeCluster[] }>;
  onMessage: (msg: WSMessage) => void;
}

/**
 * Run the three-stage analysis pipeline (file analysis → clustering →
 * ranking) on a set of files and produce a `PRAnalysis`.
 *
 * Used internally by both `runPipeline` (whole-PR) and
 * `runPipelineForCommit` (commit slice). Whole-PR callers pass the PR
 * head SHA as `commitSha` for back-compat with the existing
 * `(prUrl, headSha)` cache key.
 */
async function runPipelineCore(
  metadata: PRMetadata,
  commitSha: string,
  files: Array<{ filename: string; patch: string }>,
  deps: PipelineDeps,
): Promise<PRAnalysis> {
  const { analyzeFiles, clusterFiles, rankAndSynthesize, onMessage } = deps;

  // Carry through PR metadata but pin headSha to the analyzed commit so the
  // result lines up with the per-commit cache key.
  const resultMetadata: PRMetadata = { ...metadata, headSha: commitSha };

  if (files.length === 0) {
    const analysis: PRAnalysis = {
      id: uuidv4(),
      pr: resultMetadata,
      executiveSummary: "This PR has no analyzable file changes.",
      clusters: [],
      timeSaved: "N/A",
    };
    onMessage({ type: "complete", analysis });
    return analysis;
  }

  try {
    // Stage 1: File analysis (fan-out via subagents when supported)
    onMessage({ type: "status", stage: "file-analysis", progress: `0/${files.length} files` });
    const fileAnalyses = await analyzeFiles(files, (done, total) => {
      onMessage({
        type: "status",
        stage: "file-analysis",
        progress: `${done}/${total} files`,
      });
    });

    // Stage 2: Clustering
    onMessage({ type: "status", stage: "clustering", progress: "grouping changes" });
    const clusters = await clusterFiles(fileAnalyses);
    onMessage({ type: "partial", clusters });

    // Stage 3: Ranking & synthesis
    onMessage({ type: "status", stage: "ranking", progress: "ranking clusters" });
    const ranked = await rankAndSynthesize(resultMetadata, clusters);

    const analysis: PRAnalysis = {
      id: uuidv4(),
      pr: resultMetadata,
      executiveSummary: ranked.executiveSummary,
      clusters: ranked.clusters,
      timeSaved: ranked.timeSaved,
    };

    onMessage({ type: "complete", analysis });

    return analysis;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown pipeline error";
    onMessage({ type: "error", stage: "error", error: message });
    throw err;
  }
}

/**
 * Whole-PR entry point — kept for back-compat with the existing
 * `POST /api/analyze` flow. Internally delegates to `runPipelineCore`
 * with `commitSha = metadata.headSha`, which matches the legacy
 * `(prUrl, headSha)` cache key.
 */
export async function runPipeline(
  prData: PRData,
  deps: PipelineDeps
): Promise<PRAnalysis> {
  return runPipelineCore(prData.metadata, prData.metadata.headSha, prData.files, deps);
}

/**
 * Per-commit entry point — used by the stacked-PR flow (JGT-27 will
 * call this from the new stack route). Runs the same three-stage
 * pipeline on the commit's slice of changes and tags the resulting
 * `PRAnalysis.pr.headSha` with the commit SHA so the analysis caches
 * cleanly under `(prUrl, commitSha)`.
 *
 * `parentSha` is accepted (and stored on the input shape) so callers
 * have a single argument bag describing the slice; the pipeline itself
 * does not need to re-derive the diff — the slice is already in `files`.
 */
export async function runPipelineForCommit(
  data: CommitPipelineData,
  deps: PipelineDeps,
): Promise<PRAnalysis> {
  return runPipelineCore(data.metadata, data.commitSha, data.files, deps);
}
