import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import supertest from "supertest";
import { stackRouter } from "../../src/routes/analyze.js";
import type { CommitStack } from "../../src/services/commit-stack.js";
import type { AnalysisCache } from "../../src/services/analysis-cache.js";
import type { PRAnalysis } from "../../src/types.js";

// Mock buildCommitStack so we control the stack shape without hitting GitHub.
vi.mock("../../src/services/commit-stack.js", async () => {
  return {
    buildCommitStack: vi.fn(),
  };
});

import { buildCommitStack } from "../../src/services/commit-stack.js";

function makeApp(opts: {
  cache?: Partial<AnalysisCache>;
  startStackRun?: (...args: any[]) => void;
}): express.Express {
  const app = express();
  app.use(express.json());
  if (opts.cache) app.locals.analysisCache = opts.cache;
  if (opts.startStackRun) app.locals.startStackRun = opts.startStackRun;
  app.use("/api/pr", stackRouter);
  return app;
}

const SAMPLE_STACK: CommitStack = {
  prUrl: "https://github.com/o/r/pull/1",
  baseSha: "base000",
  headSha: "ccc333",
  levels: [
    {
      sha: "aaa111",
      shortSha: "aaa1111",
      message: "feat: real feature",
      parentSha: "base000",
      kind: "feature",
      files: ["src/a.ts"],
      status: "pending",
    },
    {
      sha: "bbb222",
      shortSha: "bbb2222",
      message: "wip: experimenting",
      parentSha: "aaa111",
      kind: "noise",
      noiseReason: "wip commit",
      files: ["src/b.ts"],
      status: "pending",
    },
    {
      sha: "ccc333",
      shortSha: "ccc3333",
      message: "feat: another real feature",
      parentSha: "bbb222",
      kind: "feature",
      files: ["src/c.ts"],
      status: "pending",
    },
  ],
};

describe("GET /api/pr/:owner/:repo/:num/stack", () => {
  beforeEach(() => {
    process.env.GITHUB_TOKEN = "ghp_test";
    vi.mocked(buildCommitStack).mockReset();
  });

  afterEach(() => {
    delete process.env.GITHUB_TOKEN;
  });

  it("returns 200 with stack metadata immediately, all levels pending when uncached", async () => {
    vi.mocked(buildCommitStack).mockResolvedValue(SAMPLE_STACK);

    const cache: Partial<AnalysisCache> = {
      get: vi.fn().mockResolvedValue(null),
    };

    const startStackRun = vi.fn();
    const app = makeApp({ cache, startStackRun });

    const res = await supertest(app).get("/api/pr/o/r/1/stack");

    expect(res.status).toBe(200);
    expect(res.body.prUrl).toBe(SAMPLE_STACK.prUrl);
    expect(res.body.baseSha).toBe(SAMPLE_STACK.baseSha);
    expect(res.body.headSha).toBe(SAMPLE_STACK.headSha);
    expect(res.body.levels).toHaveLength(3);
    expect(res.body.levels.map((l: any) => l.status)).toEqual(["pending", "pending", "pending"]);
    expect(res.body.levels.map((l: any) => l.kind)).toEqual(["feature", "noise", "feature"]);
    // No `analysis` payload on any level since the cache was empty.
    for (const lvl of res.body.levels) {
      expect(lvl.analysis).toBeUndefined();
    }
    expect(startStackRun).toHaveBeenCalledOnce();
  });

  it("marks cached non-noise levels as `ready` and inlines the cached analysis", async () => {
    vi.mocked(buildCommitStack).mockResolvedValue(SAMPLE_STACK);

    const cachedAaa: PRAnalysis = {
      id: "cached-aaa",
      pr: { ...{} as any, headSha: "aaa111" },
      executiveSummary: "cached summary",
      clusters: [],
      timeSaved: "0m",
    };

    const cache: Partial<AnalysisCache> = {
      get: vi.fn().mockImplementation(async (_url: string, sha: string) =>
        sha === "aaa111" ? cachedAaa : null,
      ),
    };

    const app = makeApp({ cache, startStackRun: vi.fn() });

    const res = await supertest(app).get("/api/pr/o/r/1/stack");
    expect(res.status).toBe(200);

    const aaa = res.body.levels.find((l: any) => l.sha === "aaa111");
    const ccc = res.body.levels.find((l: any) => l.sha === "ccc333");
    const bbb = res.body.levels.find((l: any) => l.sha === "bbb222");

    expect(aaa.status).toBe("ready");
    expect(aaa.analysis.executiveSummary).toBe("cached summary");
    expect(ccc.status).toBe("pending");
    expect(ccc.analysis).toBeUndefined();

    // Noise level — never queried, never marked ready.
    expect(bbb.status).toBe("pending");
    expect(bbb.analysis).toBeUndefined();
  });

  it("returns 502 when buildCommitStack fails", async () => {
    vi.mocked(buildCommitStack).mockRejectedValue(new Error("PR not found"));
    const cache: Partial<AnalysisCache> = { get: vi.fn() };
    const app = makeApp({ cache, startStackRun: vi.fn() });

    const res = await supertest(app).get("/api/pr/o/r/999/stack");
    expect(res.status).toBe(502);
    expect(res.body.error).toContain("PR not found");
  });

  it("returns 400 for non-numeric PR number", async () => {
    const app = makeApp({});
    const res = await supertest(app).get("/api/pr/o/r/notanumber/stack");
    expect(res.status).toBe(400);
  });

  it("returns 400 when no GitHub token is configured", async () => {
    delete process.env.GITHUB_TOKEN;
    const app = makeApp({});
    const res = await supertest(app).get("/api/pr/o/r/1/stack");
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("GitHub token");
  });
});
