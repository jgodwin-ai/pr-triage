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
  headSha: "abc123",
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
        analyzeFiles: async (files: any) => Promise.all(files.map(mockAnalyzeFile)),
        clusterFiles: mockClusterFiles,
        rankAndSynthesize: mockRankAndSynthesize,
        onMessage,
      }
    );

    expect(mockAnalyzeFile).toHaveBeenCalledTimes(2);
    // (via analyzeFiles wrapper)
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

  it("returns early with empty-PR analysis when files is empty", async () => {
    const messages: any[] = [];
    const onMessage = (msg: any) => messages.push(msg);

    const result = await runPipeline(
      { metadata: mockMetadata, files: [] },
      {
        analyzeFiles: vi.fn(),
        clusterFiles: vi.fn(),
        rankAndSynthesize: vi.fn(),
        onMessage,
      }
    );

    expect(result.executiveSummary).toBe("This PR has no analyzable file changes.");
    expect(result.clusters).toHaveLength(0);
    expect(result.timeSaved).toBe("N/A");
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe("complete");
  });

  it("sends error WSMessage and re-throws when analyzeFile throws", async () => {
    const messages: any[] = [];
    const onMessage = (msg: any) => messages.push(msg);

    const deps = {
      analyzeFiles: vi.fn().mockRejectedValue(new Error("Claude API timeout")),
      clusterFiles: vi.fn(),
      rankAndSynthesize: vi.fn(),
      onMessage,
    };

    await expect(
      runPipeline({ metadata: mockMetadata, files: mockFiles }, deps)
    ).rejects.toThrow("Claude API timeout");

    const errorMsg = messages.find((m) => m.type === "error");
    expect(errorMsg).toBeDefined();
    expect(errorMsg.error).toBe("Claude API timeout");
  });

  it("sends error WSMessage when clusterFiles throws", async () => {
    const messages: any[] = [];
    const onMessage = (msg: any) => messages.push(msg);

    const deps = {
      analyzeFiles: vi.fn().mockResolvedValue([mockFileAnalysis]),
      clusterFiles: vi.fn().mockRejectedValue(new Error("Clustering failed")),
      rankAndSynthesize: vi.fn(),
      onMessage,
    };

    await expect(
      runPipeline({ metadata: mockMetadata, files: mockFiles }, deps)
    ).rejects.toThrow("Clustering failed");

    const errorMsg = messages.find((m) => m.type === "error");
    expect(errorMsg).toBeDefined();
    expect(errorMsg.error).toBe("Clustering failed");
  });

  it("sends error WSMessage when rankAndSynthesize throws", async () => {
    const messages: any[] = [];
    const onMessage = (msg: any) => messages.push(msg);

    const deps = {
      analyzeFiles: vi.fn().mockResolvedValue([mockFileAnalysis]),
      clusterFiles: vi.fn().mockResolvedValue([mockCluster]),
      rankAndSynthesize: vi.fn().mockRejectedValue(new Error("Ranking exploded")),
      onMessage,
    };

    await expect(
      runPipeline({ metadata: mockMetadata, files: mockFiles }, deps)
    ).rejects.toThrow("Ranking exploded");

    const errorMsg = messages.find((m) => m.type === "error");
    expect(errorMsg.error).toBe("Ranking exploded");
  });

  it("complete message contains the final analysis", async () => {
    const messages: any[] = [];
    const onMessage = (msg: any) => messages.push(msg);

    const deps = {
      analyzeFiles: vi.fn().mockResolvedValue([mockFileAnalysis]),
      clusterFiles: vi.fn().mockResolvedValue([mockCluster]),
      rankAndSynthesize: vi.fn().mockResolvedValue({
        executiveSummary: "Final summary",
        timeSaved: "~10 min",
        clusters: [mockCluster],
      }),
      onMessage,
    };

    const result = await runPipeline(
      { metadata: mockMetadata, files: mockFiles },
      deps
    );

    const completeMsg = messages.find((m) => m.type === "complete");
    expect(completeMsg).toBeDefined();
    expect(completeMsg.analysis).toBeDefined();
    expect(completeMsg.analysis.id).toBe(result.id);
    expect(completeMsg.analysis.executiveSummary).toBe("Final summary");
  });
});
