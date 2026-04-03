import Anthropic from "@anthropic-ai/sdk";
import type { FileAnalysis, ChangeCluster } from "../../types.js";

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
      "tag": "needs-review" | "low-risk" | "boilerplate" | "style-only",
      "priority": <number, 1=highest priority for reviewer>,
      "filePaths": ["path/to/file1.ts", "path/to/file2.ts"]
    }
  ]
}

Clustering guidelines:
- Group files that work together to accomplish one logical change
- A file should appear in exactly one cluster
- Tag clusters based on the highest-impact file in the group
- "needs-review" = contains logic changes that could introduce bugs
- "low-risk" = config, docs, or simple changes unlikely to break anything
- "boilerplate" = generated or repetitive code
- "style-only" = formatting, naming, no behavior change
- Priority 1 = most important for reviewer, higher numbers = less important`;
}

export async function clusterFiles(
  files: FileAnalysis[],
  client: Anthropic
): Promise<ChangeCluster[]> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      { role: "user", content: buildClusteringPrompt(files) },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const parsed = JSON.parse(text);

  const filesByPath = new Map(files.map((f) => [f.path, f]));

  return parsed.clusters.map(
    (c: { id: string; name: string; summary: string; tag: string; priority: number; filePaths: string[] }) => ({
      id: c.id,
      name: c.name,
      summary: c.summary,
      tag: c.tag as ChangeCluster["tag"],
      priority: c.priority,
      files: c.filePaths.map((p: string) => filesByPath.get(p)).filter(Boolean) as FileAnalysis[],
      insights: [],
    })
  );
}
