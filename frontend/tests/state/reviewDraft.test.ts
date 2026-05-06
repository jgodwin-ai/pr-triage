import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { reviewDraftStore } from "../../src/state/reviewDraft.js";
import { stackStore } from "../../src/state/stack.js";

// Simple in-memory localStorage mock
function makeLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
}

describe("reviewDraftStore", () => {
  beforeEach(() => reviewDraftStore.reset());

  it("adds a comment and returns it by target", () => {
    reviewDraftStore.addComment(
      { kind: "cluster", clusterId: "c1" },
      "Looks good",
    );
    const comments = reviewDraftStore.getComments({ kind: "cluster", clusterId: "c1" });
    expect(comments).toHaveLength(1);
    expect(comments[0].body).toBe("Looks good");
  });

  it("edits a comment", () => {
    const c = reviewDraftStore.addComment({ kind: "cluster", clusterId: "c1" }, "v1");
    reviewDraftStore.updateComment(c.id, "v2");
    expect(reviewDraftStore.getComments(c.target)[0].body).toBe("v2");
  });

  it("removes a comment", () => {
    const c = reviewDraftStore.addComment({ kind: "cluster", clusterId: "c1" }, "x");
    reviewDraftStore.removeComment(c.id);
    expect(reviewDraftStore.all()).toHaveLength(0);
  });

  it("notifies subscribers on change", () => {
    let calls = 0;
    const unsub = reviewDraftStore.subscribe(() => calls++);
    reviewDraftStore.addComment({ kind: "cluster", clusterId: "c1" }, "x");
    expect(calls).toBe(1);
    unsub();
  });
});

describe("reviewDraftStore — localStorage persistence", () => {
  let lsMock: ReturnType<typeof makeLocalStorageMock>;

  beforeEach(() => {
    lsMock = makeLocalStorageMock();
    vi.stubGlobal("localStorage", lsMock);
    reviewDraftStore.reset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loadFor restores previously-saved comments", () => {
    const prUrl = "https://github.com/a/b/pull/1";
    const sha = "abc123";
    reviewDraftStore.loadFor(prUrl, sha);
    reviewDraftStore.addComment({ kind: "cluster", clusterId: "c1" }, "saved comment");

    // Simulate a fresh store by resetting state but keeping localStorage
    // loadFor again to restore
    reviewDraftStore.loadFor(prUrl, sha);

    const comments = reviewDraftStore.all();
    expect(comments).toHaveLength(1);
    expect(comments[0].body).toBe("saved comment");
    expect(comments[0].stale).toBeUndefined();
  });

  it("switching headSha loads comments marked stale", () => {
    const prUrl = "https://github.com/a/b/pull/1";
    const sha1 = "sha-old";
    const sha2 = "sha-new";

    // Save a draft under the old SHA
    reviewDraftStore.loadFor(prUrl, sha1);
    reviewDraftStore.addComment({ kind: "cluster", clusterId: "c1" }, "old commit comment");

    // Now load with a new SHA — same PR, different SHA
    reviewDraftStore.loadFor(prUrl, sha2);

    const comments = reviewDraftStore.all();
    expect(comments).toHaveLength(1);
    expect(comments[0].body).toBe("old commit comment");
    expect(comments[0].stale).toBe(true);
  });

  it("addComment persists; reload picks up the new comment", () => {
    const prUrl = "https://github.com/a/b/pull/2";
    const sha = "deadbeef";

    reviewDraftStore.loadFor(prUrl, sha);
    reviewDraftStore.addComment({ kind: "file", clusterId: "c2", path: "src/foo.ts" }, "file note");

    // Reload from storage
    reviewDraftStore.loadFor(prUrl, sha);

    const comments = reviewDraftStore.all();
    expect(comments).toHaveLength(1);
    expect(comments[0].body).toBe("file note");
    expect(comments[0].target.kind).toBe("file");
  });

  it("reset removes the persisted entry", () => {
    const prUrl = "https://github.com/a/b/pull/3";
    const sha = "cafebabe";

    reviewDraftStore.loadFor(prUrl, sha);
    reviewDraftStore.addComment({ kind: "cluster", clusterId: "c3" }, "to be deleted");

    const key = `pr-triage:draft:${prUrl}:${sha}`;
    expect(lsMock.getItem(key)).not.toBeNull();

    reviewDraftStore.reset();
    expect(lsMock.getItem(key)).toBeNull();
  });

  it("handles corrupt JSON gracefully (acts like fresh draft)", () => {
    const prUrl = "https://github.com/a/b/pull/4";
    const sha = "badf00d";
    const key = `pr-triage:draft:${prUrl}:${sha}`;

    // Inject corrupt JSON
    lsMock.setItem(key, "{ not valid json {{{{");

    reviewDraftStore.loadFor(prUrl, sha);

    expect(reviewDraftStore.all()).toHaveLength(0);
    expect(reviewDraftStore.snapshot().prUrl).toBe(prUrl);
  });

  it("noop gracefully when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("no storage"); },
      setItem: () => { throw new Error("no storage"); },
      removeItem: () => { throw new Error("no storage"); },
    });

    expect(() => {
      reviewDraftStore.loadFor("https://github.com/a/b/pull/5", "sha123");
      reviewDraftStore.addComment({ kind: "cluster", clusterId: "c1" }, "hello");
    }).not.toThrow();
  });
});

describe("reviewDraftStore — commitId-keyed drafts (JGT-31)", () => {
  let lsMock: ReturnType<typeof makeLocalStorageMock>;
  const PR_URL = "https://github.com/a/b/pull/100";
  const SHA_HEAD = "headsha0";
  const SHA_LEVEL_A = "aaaaaaaa";
  const SHA_LEVEL_B = "bbbbbbbb";

  beforeEach(() => {
    lsMock = makeLocalStorageMock();
    vi.stubGlobal("localStorage", lsMock);
    stackStore._resetForTest();
    reviewDraftStore.reset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("auto-injects commitId from stackStore.selectedSha for file/line/annotation kinds", () => {
    stackStore.setStack(PR_URL, [
      { sha: SHA_LEVEL_A, shortSha: "aaaa", message: "feat A", parentSha: "0", kind: "feature", files: [], status: "ready" },
      { sha: SHA_LEVEL_B, shortSha: "bbbb", message: "feat B", parentSha: "0", kind: "feature", files: [], status: "ready" },
    ]);
    stackStore.setSelected(SHA_LEVEL_A);
    reviewDraftStore.loadFor(PR_URL, SHA_HEAD);

    const fileC = reviewDraftStore.addComment(
      { kind: "file", clusterId: "c1", path: "src/foo.ts" },
      "file note",
    );
    const lineC = reviewDraftStore.addComment(
      { kind: "line", clusterId: "c1", path: "src/foo.ts", line: 10, side: "RIGHT" },
      "line note",
    );
    const annC = reviewDraftStore.addComment(
      { kind: "annotation", clusterId: "c1", path: "src/foo.ts", annotationIndex: 0 },
      "ann note",
    );

    expect((fileC.target as { commitId?: string }).commitId).toBe(SHA_LEVEL_A);
    expect((lineC.target as { commitId?: string }).commitId).toBe(SHA_LEVEL_A);
    expect((annC.target as { commitId?: string }).commitId).toBe(SHA_LEVEL_A);
  });

  it("does not inject commitId for cluster-kind targets (cluster comments are PR-wide)", () => {
    stackStore.setStack(PR_URL, [
      { sha: SHA_LEVEL_A, shortSha: "aaaa", message: "feat A", parentSha: "0", kind: "feature", files: [], status: "ready" },
    ]);
    stackStore.setSelected(SHA_LEVEL_A);
    reviewDraftStore.loadFor(PR_URL, SHA_HEAD);

    const cluster = reviewDraftStore.addComment(
      { kind: "cluster", clusterId: "c1" },
      "cluster note",
    );
    expect((cluster.target as { commitId?: string }).commitId).toBeUndefined();
  });

  it("respects an explicit commitId on the target (does not overwrite)", () => {
    stackStore.setStack(PR_URL, [
      { sha: SHA_LEVEL_A, shortSha: "aaaa", message: "feat A", parentSha: "0", kind: "feature", files: [], status: "ready" },
    ]);
    stackStore.setSelected(SHA_LEVEL_A);
    reviewDraftStore.loadFor(PR_URL, SHA_HEAD);

    const c = reviewDraftStore.addComment(
      { kind: "file", clusterId: "c1", path: "src/foo.ts", commitId: SHA_LEVEL_B } as any,
      "explicit",
    );
    expect((c.target as any).commitId).toBe(SHA_LEVEL_B);
  });

  it("getComments scopes by commitId for file/line/annotation kinds", () => {
    stackStore.setStack(PR_URL, [
      { sha: SHA_LEVEL_A, shortSha: "aaaa", message: "feat A", parentSha: "0", kind: "feature", files: [], status: "ready" },
      { sha: SHA_LEVEL_B, shortSha: "bbbb", message: "feat B", parentSha: "0", kind: "feature", files: [], status: "ready" },
    ]);
    reviewDraftStore.loadFor(PR_URL, SHA_HEAD);

    stackStore.setSelected(SHA_LEVEL_A);
    reviewDraftStore.addComment(
      { kind: "file", clusterId: "c1", path: "src/foo.ts" },
      "level-A note",
    );
    stackStore.setSelected(SHA_LEVEL_B);
    reviewDraftStore.addComment(
      { kind: "file", clusterId: "c1", path: "src/foo.ts" },
      "level-B note",
    );

    const fromA = reviewDraftStore.getComments({
      kind: "file",
      clusterId: "c1",
      path: "src/foo.ts",
      commitId: SHA_LEVEL_A,
    } as any);
    const fromB = reviewDraftStore.getComments({
      kind: "file",
      clusterId: "c1",
      path: "src/foo.ts",
      commitId: SHA_LEVEL_B,
    } as any);
    expect(fromA).toHaveLength(1);
    expect(fromA[0].body).toBe("level-A note");
    expect(fromB).toHaveLength(1);
    expect(fromB[0].body).toBe("level-B note");
  });

  it("falls back to PR head SHA when no level is selected (legacy single-PR flow)", () => {
    // No stack set -> selectedSha is null. addComment should default
    // commitId to currentHeadSha (set via loadFor).
    reviewDraftStore.loadFor(PR_URL, SHA_HEAD);
    const c = reviewDraftStore.addComment(
      { kind: "file", clusterId: "c1", path: "src/foo.ts" },
      "legacy note",
    );
    expect((c.target as any).commitId).toBe(SHA_HEAD);
  });

  it("loadFor backfills missing commitId on persisted file/line/annotation drafts using head SHA", () => {
    // Simulate a pre-JGT-31 persisted draft (no commitId on targets).
    const key = `pr-triage:draft:${PR_URL}:${SHA_HEAD}`;
    lsMock.setItem(
      key,
      JSON.stringify({
        prUrl: PR_URL,
        event: "COMMENT",
        summary: "",
        comments: [
          {
            id: "old-1",
            target: { kind: "file", clusterId: "c1", path: "src/foo.ts" },
            body: "legacy file",
            createdAt: 1,
          },
          {
            id: "old-2",
            target: { kind: "cluster", clusterId: "c1" },
            body: "legacy cluster (no commitId expected)",
            createdAt: 2,
          },
        ],
      }),
    );
    // Manifest entry so loadFor finds the persisted draft.
    lsMock.setItem(
      "pr-triage:draft:manifest",
      JSON.stringify([{ prUrl: PR_URL, headSha: SHA_HEAD, updatedAt: Date.now() }]),
    );

    reviewDraftStore.loadFor(PR_URL, SHA_HEAD);
    const all = reviewDraftStore.all();
    const fileC = all.find((c) => c.id === "old-1")!;
    const clusterC = all.find((c) => c.id === "old-2")!;
    expect((fileC.target as any).commitId).toBe(SHA_HEAD);
    expect((clusterC.target as any).commitId).toBeUndefined();
  });
});
