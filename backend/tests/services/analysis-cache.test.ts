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

  it("keyFor includes both prUrl identity and the commit sha", async () => {
    const c = new AnalysisCache(dir);
    const k1 = c.keyFor("https://github.com/x/y/pull/1", "abc123");
    const k2 = c.keyFor("https://github.com/x/y/pull/1", "def456");
    const k3 = c.keyFor("https://github.com/x/y/pull/2", "abc123");
    // Different commit SHAs on the same PR ⇒ different keys (per-commit cache)
    expect(k1).not.toBe(k2);
    // Different PRs ⇒ different keys
    expect(k1).not.toBe(k3);
    // Both keys include the SHA fragment so per-commit lookups stay isolated
    expect(k1).toContain("abc123");
    expect(k2).toContain("def456");
  });

  it("per-commit caching: intermediate commit SHAs (not just PR head) round-trip cleanly", async () => {
    const c = new AnalysisCache(dir);
    const prUrl = "https://github.com/x/y/pull/9";
    // Simulate a 3-commit stack: cache analysis for each commit independently
    await c.set(prUrl, "sha-c1", mkAnalysis({ executiveSummary: "commit 1" }));
    await c.set(prUrl, "sha-c2", mkAnalysis({ executiveSummary: "commit 2" }));
    await c.set(prUrl, "sha-c3", mkAnalysis({ executiveSummary: "commit 3 (head)" }));

    expect((await c.get(prUrl, "sha-c1"))?.executiveSummary).toBe("commit 1");
    expect((await c.get(prUrl, "sha-c2"))?.executiveSummary).toBe("commit 2");
    expect((await c.get(prUrl, "sha-c3"))?.executiveSummary).toBe("commit 3 (head)");
    // A SHA we never cached must still miss
    expect(await c.get(prUrl, "sha-unknown")).toBeNull();
  });

  it("single-PR callers passing head SHA keep the legacy round-trip working", async () => {
    // Back-compat: the single-PR /api/analyze flow caches by (prUrl, headSha)
    // which is the head-commit SHA. That call site MUST keep working unchanged.
    const c = new AnalysisCache(dir);
    const prUrl = "https://github.com/x/y/pull/42";
    const headSha = "headsha000";
    const a = mkAnalysis({ executiveSummary: "single-pr roundtrip" });
    await c.set(prUrl, headSha, a);
    const got = await c.get(prUrl, headSha);
    expect(got?.executiveSummary).toBe("single-pr roundtrip");
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));
});
