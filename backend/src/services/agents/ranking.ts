import Anthropic from "@anthropic-ai/sdk";
import type { ChangeCluster, PRMetadata } from "../../types.js";

interface RankingResult {
  executiveSummary: string;
  timeSaved: string;
  clusters: ChangeCluster[];
}

export function buildRankingPrompt(
  metadata: PRMetadata,
  clusters: ChangeCluster[]
): string {
  const clusterSummaries = clusters
    .map(
      (c) =>
        `- [${c.id}] "${c.name}" (tag=${c.tag}, priority=${c.priority}, ${c.files.length} files): ${c.summary}`
    )
    .join("\n");

  return `You are the final reviewer agent. Given this PR and its change clusters, produce an executive summary, rank the clusters, and estimate time saved.

PR: "${metadata.title}" by ${metadata.author}
${metadata.url}
+${metadata.additions} -${metadata.deletions} across ${metadata.fileCount} files
Base: ${metadata.baseBranch} ← Head: ${metadata.headBranch}

Change clusters:
${clusterSummaries}

Respond with JSON only — no markdown fences, no commentary. Use this exact schema:
{
  "executiveSummary": "2-3 sentences: what the PR does, what needs attention, what can be skimmed",
  "timeSaved": "estimated review time saved (e.g. '~20 min')",
  "clusterUpdates": [
    {
      "id": "cluster-id",
      "priority": <final rank, 1=most important>,
      "tag": "needs-review" | "low-risk" | "boilerplate" | "style-only"
    }
  ]
}

Ranking guidelines:
- Priority 1 = the cluster reviewers should look at first
- Clusters with logic changes and high impact files rank higher
- Boilerplate and style-only clusters rank lowest
- The executive summary should tell a reviewer where to spend their time`;
}

export async function rankAndSynthesize(
  metadata: PRMetadata,
  clusters: ChangeCluster[],
  client: Anthropic
): Promise<RankingResult> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      { role: "user", content: buildRankingPrompt(metadata, clusters) },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const parsed = JSON.parse(text);

  const clusterMap = new Map(clusters.map((c) => [c.id, c]));

  const updatedClusters = parsed.clusterUpdates.map(
    (update: { id: string; priority: number; tag: string }) => {
      const original = clusterMap.get(update.id)!;
      return {
        ...original,
        priority: update.priority,
        tag: update.tag as ChangeCluster["tag"],
      };
    }
  );

  updatedClusters.sort((a: ChangeCluster, b: ChangeCluster) => a.priority - b.priority);

  return {
    executiveSummary: parsed.executiveSummary,
    timeSaved: parsed.timeSaved,
    clusters: updatedClusters,
  };
}
