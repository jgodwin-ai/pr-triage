import { describe, it, expect, vi } from "vitest";
import { runPipeline, runPipelineForCommit } from "../../src/services/pipeline.js";
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

  it("back-compat: existing whole-PR runPipeline call sites keep working unchanged", async () => {
    // This test pins the legacy signature so JGT-27 (route changes) won't drift.
    const messages: any[] = [];
    const onMessage = (msg: any) => messages.push(msg);

    const deps = {
      analyzeFiles: vi.fn().mockResolvedValue([mockFileAnalysis]),
      clusterFiles: vi.fn().mockResolvedValue([mockCluster]),
      rankAndSynthesize: vi.fn().mockResolvedValue({
        executiveSummary: "whole PR",
        timeSaved: "~5 min",
        clusters: [mockCluster],
      }),
      onMessage,
    };

    const result = await runPipeline(
      { metadata: mockMetadata, files: mockFiles },
      deps
    );

    expect(result.pr.headSha).toBe(mockMetadata.headSha);
    expect(result.executiveSummary).toBe("whole PR");
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

describe("runPipelineForCommit", () => {
  it("accepts a (commitSha, parentSha, files[]) triple and emits the existing PRAnalysis shape", async () => {
    const messages: any[] = [];
    const onMessage = (msg: any) => messages.push(msg);

    const commitFiles = [{ filename: "src/x.ts", patch: "@@ commit slice @@" }];

    const deps = {
      analyzeFiles: vi.fn().mockResolvedValue([mockFileAnalysis]),
      clusterFiles: vi.fn().mockResolvedValue([mockCluster]),
      rankAndSynthesize: vi.fn().mockResolvedValue({
        executiveSummary: "Commit-level summary",
        timeSaved: "~2 min",
        clusters: [mockCluster],
      }),
      onMessage,
    };

    const result = await runPipelineForCommit(
      {
        metadata: mockMetadata,
        commitSha: "commitSha-2",
        parentSha: "commitSha-1",
        files: commitFiles,
      },
      deps
    );

    // Output shape is the existing PRAnalysis — downstream code stays agnostic.
    expect(result).toMatchObject({
      executiveSummary: "Commit-level summary",
      timeSaved: "~2 min",
      clusters: expect.any(Array),
    });
    expect(result.id).toBeTypeOf("string");
    // The metadata.headSha on the returned analysis reflects the commit being
    // analyzed (not the PR head) so cache lookups by commit SHA stay coherent.
    expect(result.pr.headSha).toBe("commitSha-2");
    // Other PR metadata fields are carried through unchanged.
    expect(result.pr.url).toBe(mockMetadata.url);
    expect(result.pr.title).toBe(mockMetadata.title);

    // The pipeline ran on the per-commit slice, not the full PR.
    expect(deps.analyzeFiles).toHaveBeenCalledOnce();
    const filesArg = deps.analyzeFiles.mock.calls[0][0];
    expect(filesArg).toEqual(commitFiles);

    // Stages still emitted in order.
    const stages = messages.filter((m) => m.type === "status").map((m) => m.stage);
    expect(stages).toContain("file-analysis");
    expect(stages).toContain("clustering");
    expect(stages).toContain("ranking");
  });

  it("returns the empty-PR analysis shape when the commit slice is empty", async () => {
    const messages: any[] = [];
    const result = await runPipelineForCommit(
      {
        metadata: mockMetadata,
        commitSha: "commitSha-2",
        parentSha: "commitSha-1",
        files: [],
      },
      {
        analyzeFiles: vi.fn(),
        clusterFiles: vi.fn(),
        rankAndSynthesize: vi.fn(),
        onMessage: (m: any) => messages.push(m),
      }
    );

    expect(result.clusters).toHaveLength(0);
    expect(result.executiveSummary).toBe("This PR has no analyzable file changes.");
    expect(result.timeSaved).toBe("N/A");
    // Even on the empty-slice path the metadata reflects the commit SHA so
    // the cache key is consistent with the non-empty path.
    expect(result.pr.headSha).toBe("commitSha-2");
  });

  it("propagates pipeline errors and emits an error WSMessage", async () => {
    const messages: any[] = [];
    const deps = {
      analyzeFiles: vi.fn().mockRejectedValue(new Error("commit-slice analyze failed")),
      clusterFiles: vi.fn(),
      rankAndSynthesize: vi.fn(),
      onMessage: (m: any) => messages.push(m),
    };

    await expect(
      runPipelineForCommit(
        {
          metadata: mockMetadata,
          commitSha: "commitSha-2",
          parentSha: "commitSha-1",
          files: [{ filename: "src/x.ts", patch: "@@ p @@" }],
        },
        deps
      )
    ).rejects.toThrow("commit-slice analyze failed");

    const errorMsg = messages.find((m: any) => m.type === "error");
    expect(errorMsg).toBeDefined();
    expect(errorMsg.error).toBe("commit-slice analyze failed");
  });
});
