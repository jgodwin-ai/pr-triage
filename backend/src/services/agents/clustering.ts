import type { LLMClient } from "../llm-client.js";
import type { FileAnalysis, ChangeCluster } from "../../types.js";
import { extractJSON } from "./extract-json.js";
import { deriveTag } from "./derive-tag.js";

export function buildClusteringPrompt(files: FileAnalysis[]): string {
  const fileSummaries = files
    .map(
      (f) =>
        `- ${f.path} [${f.category}, impact=${f.impactScore}]: ${f.summary}`
    )
    .join("\n");

  return `Group these PR file changes into logical clusters of related changes.

Files analyzed:
${fileSummaries}

Respond with JSON only — no markdown fences, no commentary. Use this exact schema:
{
  "clusters": [
    {
      "id": "short-kebab-id",
      "name": "Human readable cluster name",
      "summary": "2-3 sentences explaining what this group of changes does together",
      "priority": <number, 1=highest priority for reviewer>,
      "filePaths": ["path/to/file1.ts", "path/to/file2.ts"]
    }
  ]
}

Clustering guidelines:
- Group files that work together to accomplish one logical change
- A file should appear in exactly one cluster
- Priority 1 = most important for reviewer, higher numbers = less important`;
}

export async function clusterFiles(
  files: FileAnalysis[],
  client: LLMClient
): Promise<ChangeCluster[]> {
  const text = await client.complete(buildClusteringPrompt(files));
  const parsed = extractJSON(text) as any;

  const filesByPath = new Map(files.map((f) => [f.path, f]));

  return parsed.clusters.map(
    (c: { id: string; name: string; summary: string; priority: number; filePaths: string[] }) => {
      const clusterFiles = c.filePaths
        .map((p: string) => filesByPath.get(p))
        .filter(Boolean) as FileAnalysis[];
      return {
        id: c.id,
        name: c.name,
        summary: c.summary,
        tag: deriveTag(clusterFiles),
        priority: c.priority,
        files: clusterFiles,
        insights: [],
      };
    }
  );
}
