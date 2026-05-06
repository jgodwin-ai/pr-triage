import { describe, it, expect, vi } from "vitest";
import { runStack, annotateStackStatuses } from "../../src/services/stack-runner.js";
import type { CommitStack } from "../../src/services/commit-stack.js";
import type { AnalysisCache } from "../../src/services/analysis-cache.js";
import type { PRAnalysis, PRMetadata, WSMessage } from "../../src/types.js";

const PR_METADATA: PRMetadata = {
  url: "https://github.com/o/r/pull/1",
  title: "test",
  author: "octocat",
  baseBranch: "main",
  headBranch: "feat",
  additions: 0,
  deletions: 0,
  fileCount: 0,
  headSha: "ccc333",
};

function makeStack(overrides?: Partial<CommitStack>): CommitStack {
  return {
    prUrl: "https://github.com/o/r/pull/1",
    baseSha: "base000",
    headSha: "ccc333",
    levels: [
      {
        sha: "aaa111",
        shortSha: "aaa1111",
        message: "feat: real",
        parentSha: "base000",
        kind: "feature",
        files: ["src/a.ts"],
        status: "pending",
      },
      {
        sha: "bbb222",
        shortSha: "bbb2222",
        message: "wip",
        parentSha: "aaa111",
        kind: "noise",
        noiseReason: "wip commit",
        files: ["src/b.ts"],
        status: "pending",
      },
      {
        sha: "ccc333",
        shortSha: "ccc3333",
        message: "feat: another",
        parentSha: "bbb222",
        kind: "feature",
        files: ["src/c.ts"],
        status: "pending",
      },
    ],
    ...overrides,
  };
}

function makeMockOctokit(filesPerCompare: Record<string, any[]> = {}) {
  return {
    rest: {
      repos: {
        compareCommits: vi.fn().mockImplementation(async (args: any) => {
          const key = `${args.base}..${args.head}`;
          const files = filesPerCompare[key] ?? [{ filename: `out-${args.head}.ts`, patch: "@@ p @@" }];
          return { data: { files } };
        }),
      },
    },
  } as any;
}

function makeMockCache(initial: Record<string, PRAnalysis> = {}): AnalysisCache & {
  setCalls: Array<{ url: string; sha: string }>;
} {
  const store = new Map<string, PRAnalysis>(Object.entries(initial));
  const setCalls: Array<{ url: string; sha: string }> = [];
  return {
    get: vi.fn().mockImplementation(async (url: string, sha: string) => store.get(`${url}#${sha}`) ?? null),
    set: vi.fn().mockImplementation(async (url: string, sha: string, a: PRAnalysis) => {
      store.set(`${url}#${sha}`, a);
      setCalls.push({ url, sha });
    }),
    setCalls,
  } as any;
}

const mockAnalysis = (sha: string): PRAnalysis => ({
  id: `analysis-${sha}`,
  pr: { ...PR_METADATA, headSha: sha },
  executiveSummary: `summary-${sha}`,
  clusters: [],
  timeSaved: "1m",
});

describe("runStack", () => {
  it("emits levelReady for each non-noise level on success", async () => {
    const stack = makeStack();
    const cache = makeMockCache();
    const events: WSMessage[] = [];

    const analyzeFiles = vi.fn().mockResolvedValue([]);
    const clusterFiles = vi.fn().mockResolvedValue([]);
    const rankAndSynthesize = vi.fn().mockResolvedValue({
      executiveSummary: "ok",
      timeSaved: "1m",
      clusters: [],
    });

    await runStack(stack, {
      octokit: makeMockOctokit(),
      owner: "o",
      repo: "r",
      cache,
      prMetadata: PR_METADATA,
      analyzeFiles,
      clusterFiles,
      rankAndSynthesize,
      emit: (m) => events.push(m),
    });

    const ready = events.filter((e) => e.type === "levelReady");
    const errors = events.filter((e) => e.type === "levelError");
    expect(ready.map((e) => e.sha).sort()).toEqual(["aaa111", "ccc333"]);
    expect(errors).toHaveLength(0);
    // The noise commit (bbb222) must NOT trigger any event.
    expect(events.find((e) => e.sha === "bbb222")).toBeUndefined();
  });

  it("does not run pipelines for noise levels", async () => {
    const stack = makeStack();
    const cache = makeMockCache();
    const analyzeFiles = vi.fn().mockResolvedValue([]);

    await runStack(stack, {
      octokit: makeMockOctokit(),
      owner: "o",
      repo: "r",
      cache,
      prMetadata: PR_METADATA,
      analyzeFiles,
      clusterFiles: vi.fn().mockResolvedValue([]),
      rankAndSynthesize: vi.fn().mockResolvedValue({
        executiveSummary: "x",
        timeSaved: "1m",
        clusters: [],
      }),
      emit: () => {},
    });

    // analyzeFiles is the first agent in the pipeline — called once per
    // non-noise level (aaa111 + ccc333). Never for bbb222.
    expect(analyzeFiles).toHaveBeenCalledTimes(2);
  });

  it("uses cache and emits levelReady without re-running pipeline", async () => {
    const stack = makeStack();
    const cached = mockAnalysis("aaa111");
    const cache = makeMockCache({
      [`${stack.prUrl}#aaa111`]: cached,
    });

    const events: WSMessage[] = [];
    const analyzeFiles = vi.fn().mockResolvedValue([]);

    await runStack(stack, {
      octokit: makeMockOctokit(),
      owner: "o",
      repo: "r",
      cache,
      prMetadata: PR_METADATA,
      analyzeFiles,
      clusterFiles: vi.fn().mockResolvedValue([]),
      rankAndSynthesize: vi.fn().mockResolvedValue({
        executiveSummary: "x",
        timeSaved: "1m",
        clusters: [],
      }),
      emit: (m) => events.push(m),
    });

    // Pipeline should have run once (for ccc333 only — aaa111 was cached).
    expect(analyzeFiles).toHaveBeenCalledTimes(1);

    const aaaEvent = events.find((e) => e.type === "levelReady" && e.sha === "aaa111");
    expect(aaaEvent).toBeDefined();
    expect(aaaEvent?.analysis?.executiveSummary).toBe("summary-aaa111");
  });

  it("emits levelError for a single failing level and continues with the rest", async () => {
    const stack = makeStack();
    const cache = makeMockCache();
    const events: WSMessage[] = [];

    // Make the analyzeFiles step throw, but only for ccc333. We can detect
    // which level we are running by inspecting the file slice — the mock
    // octokit returns `out-<sha>.ts`.
    const analyzeFiles = vi.fn().mockImplementation(async (files: any[]) => {
      if (files.some((f) => f.filename === "out-ccc333.ts")) {
        throw new Error("LLM blew up");
      }
      return [];
    });

    await runStack(stack, {
      octokit: makeMockOctokit(),
      owner: "o",
      repo: "r",
      cache,
      prMetadata: PR_METADATA,
      analyzeFiles,
      clusterFiles: vi.fn().mockResolvedValue([]),
      rankAndSynthesize: vi.fn().mockResolvedValue({
        executiveSummary: "x",
        timeSaved: "1m",
        clusters: [],
      }),
      emit: (m) => events.push(m),
    });

    const ready = events.filter((e) => e.type === "levelReady");
    const errors = events.filter((e) => e.type === "levelError");
    expect(ready.map((e) => e.sha)).toEqual(["aaa111"]);
    expect(errors).toHaveLength(1);
    expect(errors[0].sha).toBe("ccc333");
    expect(errors[0].error).toContain("LLM blew up");
  });
});

describe("annotateStackStatuses", () => {
  it("marks cached levels ready and uncached levels pending; noise stays pending", async () => {
    const stack = makeStack();
    const cached = mockAnalysis("ccc333");
    const cache = makeMockCache({
      [`${stack.prUrl}#ccc333`]: cached,
    });

    const annotated = await annotateStackStatuses(stack, cache);
    const byShas = Object.fromEntries(annotated.map((l) => [l.sha, l]));
    expect(byShas.aaa111.status).toBe("pending");
    expect(byShas.bbb222.status).toBe("pending");
    expect(byShas.ccc333.status).toBe("ready");
    expect(byShas.ccc333.analysis).toBeDefined();
  });
});
