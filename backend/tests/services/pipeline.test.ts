import { describe, it, expect, vi } from "vitest";
import { runPipeline } from "../../src/services/pipeline.js";
import type { PRMetadata, FileAnalysis, ChangeCluster } from "../../src/types.js";

const mockMetadata: PRMetadata = {
  url: "https://github.com/octocat/repo/pull/1",
  title: "Test PR",
  author: "octocat",
  baseBranch: "main",
  headBranch: "feature",
  additions: 50,
  deletions: 10,
  fileCount: 2,
};

const mockFiles = [
  { filename: "src/a.ts", patch: "@@ diff a @@" },
  { filename: "src/b.ts", patch: "@@ diff b @@" },
];

const mockFileAnalysis: FileAnalysis = {
  path: "src/a.ts",
  summary: "Changes logic",
  category: "logic",
  impactScore: 3,
  diff: "@@ diff a @@",
  annotations: [],
};

const mockCluster: ChangeCluster = {
  id: "main-changes",
  name: "Main logic changes",
  summary: "Core changes",
  tag: "needs-review",
  priority: 1,
  files: [mockFileAnalysis],
  insights: [],
};

describe("runPipeline", () => {
  it("runs all 3 agents in sequence and returns PRAnalysis", async () => {
    const mockAnalyzeFile = vi.fn().mockResolvedValue(mockFileAnalysis);
    const mockClusterFiles = vi.fn().mockResolvedValue([mockCluster]);
    const mockRankAndSynthesize = vi.fn().mockResolvedValue({
      executiveSummary: "This PR makes logic changes.",
      timeSaved: "~5 min",
      clusters: [mockCluster],
    });

    const messages: any[] = [];
    const onMessage = (msg: any) => messages.push(msg);

    const result = await runPipeline(
      { metadata: mockMetadata, files: mockFiles },
      {
        analyzeFile: mockAnalyzeFile,
        clusterFiles: mockClusterFiles,
        rankAndSynthesize: mockRankAndSynthesize,
        onMessage,
      }
    );

    expect(mockAnalyzeFile).toHaveBeenCalledTimes(2);
    expect(mockClusterFiles).toHaveBeenCalledOnce();
    expect(mockRankAndSynthesize).toHaveBeenCalledOnce();

    expect(result.executiveSummary).toBe("This PR makes logic changes.");
    expect(result.clusters).toHaveLength(1);
    expect(result.pr).toEqual(mockMetadata);

    // Check that status messages were emitted
    const stages = messages.filter((m) => m.type === "status").map((m) => m.stage);
    expect(stages).toContain("file-analysis");
    expect(stages).toContain("clustering");
    expect(stages).toContain("ranking");
  });
});
