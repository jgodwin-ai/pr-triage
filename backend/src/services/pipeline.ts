import { v4 as uuidv4 } from "uuid";
import pLimit from "p-limit";
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

interface PipelineDeps {
  analyzeFile: (file: { filename: string; patch: string }) => Promise<FileAnalysis>;
  clusterFiles: (files: FileAnalysis[]) => Promise<ChangeCluster[]>;
  rankAndSynthesize: (
    metadata: PRMetadata,
    clusters: ChangeCluster[]
  ) => Promise<{ executiveSummary: string; timeSaved: string; clusters: ChangeCluster[] }>;
  onMessage: (msg: WSMessage) => void;
}

export async function runPipeline(
  prData: PRData,
  deps: PipelineDeps
): Promise<PRAnalysis> {
  const { metadata, files } = prData;
  const { analyzeFile, clusterFiles, rankAndSynthesize, onMessage } = deps;

  if (files.length === 0) {
    const analysis: PRAnalysis = {
      id: uuidv4(),
      pr: metadata,
      executiveSummary: "This PR has no analyzable file changes.",
      clusters: [],
      timeSaved: "N/A",
    };
    onMessage({ type: "complete", analysis });
    return analysis;
  }

  try {
    // Stage 1: File analysis (parallel)
    onMessage({ type: "status", stage: "file-analysis", progress: `0/${files.length} files` });

    const limit = pLimit(5);
    let completed = 0;
    const fileAnalyses = await Promise.all(
      files.map((file) =>
        limit(async () => {
          const result = await analyzeFile(file);
          completed++;
          onMessage({
            type: "status",
            stage: "file-analysis",
            progress: `${completed}/${files.length} files`,
          });
          return result;
        })
      )
    );

    // Stage 2: Clustering
    onMessage({ type: "status", stage: "clustering", progress: "grouping changes" });
    const clusters = await clusterFiles(fileAnalyses);
    onMessage({ type: "partial", clusters });

    // Stage 3: Ranking & synthesis
    onMessage({ type: "status", stage: "ranking", progress: "ranking clusters" });
    const ranked = await rankAndSynthesize(metadata, clusters);

    const analysis: PRAnalysis = {
      id: uuidv4(),
      pr: metadata,
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
