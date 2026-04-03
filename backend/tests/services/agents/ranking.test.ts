import { describe, it, expect, vi } from "vitest";
import { rankAndSynthesize, buildRankingPrompt } from "../../../src/services/agents/ranking.js";
import type { ChangeCluster, PRMetadata } from "../../../src/types.js";

const sampleMetadata: PRMetadata = {
  url: "https://github.com/octocat/hello-world/pull/42",
  title: "Add auth and update docs",
  author: "octocat",
  baseBranch: "main",
  headBranch: "feature/auth",
  additions: 150,
  deletions: 20,
  fileCount: 5,
};

const sampleClusters: ChangeCluster[] = [
  {
    id: "auth",
    name: "Auth changes",
    summary: "Adds login validation",
    tag: "needs-review",
    priority: 1,
    files: [],
    insights: [],
  },
  {
    id: "docs",
    name: "Docs update",
    summary: "Updates README",
    tag: "low-risk",
    priority: 2,
    files: [],
    insights: [],
  },
];

describe("buildRankingPrompt", () => {
  it("includes PR metadata and cluster summaries", () => {
    const prompt = buildRankingPrompt(sampleMetadata, sampleClusters);
    expect(prompt).toContain("Add auth and update docs");
    expect(prompt).toContain("Auth changes");
    expect(prompt).toContain("Docs update");
  });
});

describe("rankAndSynthesize", () => {
  it("returns executive summary and re-ranked clusters", async () => {
    const mockClient = {
      complete: vi.fn().mockResolvedValue(JSON.stringify({
        executiveSummary:
          "This PR adds authentication with password validation and session management. Review auth changes carefully. Docs update is low-risk.",
        timeSaved: "~15 min",
        clusterUpdates: [
          { id: "auth", priority: 1, tag: "needs-review" },
          { id: "docs", priority: 2, tag: "low-risk" },
        ],
      })),
    };

    const result = await rankAndSynthesize(
      sampleMetadata,
      sampleClusters,
      mockClient as any
    );

    expect(result.executiveSummary).toContain("authentication");
    expect(result.timeSaved).toBe("~15 min");
    expect(result.clusters[0].id).toBe("auth");
    expect(result.clusters[0].priority).toBe(1);
  });

  it("skips unknown cluster IDs without crashing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mockClient = {
      complete: vi.fn().mockResolvedValue(JSON.stringify({
        executiveSummary: "Summary",
        timeSaved: "~10 min",
        clusterUpdates: [
          { id: "auth", priority: 1, tag: "needs-review" },
          { id: "unknown-cluster", priority: 2, tag: "low-risk" },
        ],
      })),
    };

    const result = await rankAndSynthesize(sampleMetadata, sampleClusters, mockClient as any);
    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0].id).toBe("auth");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("unknown cluster ID: unknown-cluster")
    );
    warnSpy.mockRestore();
  });

  it("returns fewer clusters when LLMClient returns fewer clusterUpdates", async () => {
    const mockClient = {
      complete: vi.fn().mockResolvedValue(JSON.stringify({
        executiveSummary: "Only auth matters",
        timeSaved: "~5 min",
        clusterUpdates: [
          { id: "auth", priority: 1, tag: "needs-review" },
        ],
      })),
    };

    const result = await rankAndSynthesize(sampleMetadata, sampleClusters, mockClient as any);
    expect(result.clusters).toHaveLength(1);
  });

  it("throws when LLMClient returns invalid JSON", async () => {
    const mockClient = {
      complete: vi.fn().mockResolvedValue("Here is my ranking..."),
    };

    await expect(
      rankAndSynthesize(sampleMetadata, sampleClusters, mockClient as any)
    ).rejects.toThrow("Failed to parse LLM response as JSON");
  });

  it("sorts clusters by priority correctly", async () => {
    const mockClient = {
      complete: vi.fn().mockResolvedValue(JSON.stringify({
        executiveSummary: "Review docs first",
        timeSaved: "~8 min",
        clusterUpdates: [
          { id: "docs", priority: 1, tag: "needs-review" },
          { id: "auth", priority: 3, tag: "low-risk" },
        ],
      })),
    };

    const result = await rankAndSynthesize(sampleMetadata, sampleClusters, mockClient as any);
    expect(result.clusters[0].id).toBe("docs");
    expect(result.clusters[0].priority).toBe(1);
    expect(result.clusters[1].id).toBe("auth");
    expect(result.clusters[1].priority).toBe(3);
  });
});
