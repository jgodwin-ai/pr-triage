import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { reviewDraftStore } from "../../src/state/reviewDraft.js";

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
