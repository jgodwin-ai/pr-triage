import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { AnalysisCache } from "../../src/services/analysis-cache.js";
import type { PRAnalysis } from "../../src/types.js";

const mkAnalysis = (overrides?: Partial<PRAnalysis>): PRAnalysis => ({
  id: "a1",
  pr: {
    url: "https://github.com/x/y/pull/1",
    title: "t", author: "a", baseBranch: "main", headBranch: "f",
    additions: 1, deletions: 0, fileCount: 1, headSha: "abc123",
  } as any,
  executiveSummary: "ok",
  clusters: [],
  timeSaved: "1m",
  ...overrides,
});

describe("AnalysisCache", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "cache-test-"));
  });

  it("returns null on miss", async () => {
    const c = new AnalysisCache(dir);
    expect(await c.get("https://github.com/x/y/pull/1", "abc123")).toBeNull();
  });

  it("roundtrips an analysis", async () => {
    const c = new AnalysisCache(dir);
    const a = mkAnalysis();
    await c.set("https://github.com/x/y/pull/1", "abc123", a);
    const got = await c.get("https://github.com/x/y/pull/1", "abc123");
    expect(got?.executiveSummary).toBe("ok");
  });

  it("different SHAs are separate entries", async () => {
    const c = new AnalysisCache(dir);
    await c.set("https://github.com/x/y/pull/1", "abc123", mkAnalysis({ executiveSummary: "v1" }));
    await c.set("https://github.com/x/y/pull/1", "def456", mkAnalysis({ executiveSummary: "v2" }));
    expect((await c.get("https://github.com/x/y/pull/1", "abc123"))?.executiveSummary).toBe("v1");
    expect((await c.get("https://github.com/x/y/pull/1", "def456"))?.executiveSummary).toBe("v2");
  });

  it("malformed cache files return null rather than throwing", async () => {
    const c = new AnalysisCache(dir);
    const { writeFileSync } = await import("fs");
    writeFileSync(path.join(dir, c.keyFor("https://github.com/x/y/pull/1", "abc123") + ".json"), "{not json");
    expect(await c.get("https://github.com/x/y/pull/1", "abc123")).toBeNull();
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));
});
