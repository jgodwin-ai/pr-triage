import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { viewedStore } from "../../src/state/viewedStore.js";

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

describe("viewedStore — basic operations", () => {
  beforeEach(() => {
    // Reset by loading a fresh key
    viewedStore.loadFor("https://github.com/reset/repo/pull/0", "sha-reset");
  });

  it("markViewed adds a file", () => {
    viewedStore.markViewed("c1", "src/foo.ts");
    expect(viewedStore.isViewed("c1", "src/foo.ts")).toBe(true);
  });

  it("unmarkViewed removes a file", () => {
    viewedStore.markViewed("c1", "src/foo.ts");
    viewedStore.unmarkViewed("c1", "src/foo.ts");
    expect(viewedStore.isViewed("c1", "src/foo.ts")).toBe(false);
  });

  it("isViewed returns false for unknown file", () => {
    expect(viewedStore.isViewed("c1", "src/nothere.ts")).toBe(false);
  });

  it("all() returns the current viewed set", () => {
    viewedStore.markViewed("c1", "a.ts");
    viewedStore.markViewed("c2", "b.ts");
    const all = viewedStore.all();
    expect(all.has("c1:a.ts")).toBe(true);
    expect(all.has("c2:b.ts")).toBe(true);
  });

  it("notifies subscribers on markViewed", () => {
    let calls = 0;
    const unsub = viewedStore.subscribe(() => calls++);
    viewedStore.markViewed("c1", "x.ts");
    expect(calls).toBe(1);
    unsub();
  });

  it("notifies subscribers on unmarkViewed", () => {
    viewedStore.markViewed("c1", "x.ts");
    let calls = 0;
    const unsub = viewedStore.subscribe(() => calls++);
    viewedStore.unmarkViewed("c1", "x.ts");
    expect(calls).toBe(1);
    unsub();
  });

  it("markViewed is idempotent (no duplicate notify)", () => {
    viewedStore.markViewed("c1", "x.ts");
    let calls = 0;
    const unsub = viewedStore.subscribe(() => calls++);
    viewedStore.markViewed("c1", "x.ts"); // already viewed — no-op
    expect(calls).toBe(0);
    unsub();
  });
});

describe("viewedStore — localStorage persistence", () => {
  let lsMock: ReturnType<typeof makeLocalStorageMock>;

  beforeEach(() => {
    lsMock = makeLocalStorageMock();
    vi.stubGlobal("localStorage", lsMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loadFor restores previously-saved viewed files", () => {
    const prUrl = "https://github.com/a/b/pull/1";
    const sha = "abc123";

    viewedStore.loadFor(prUrl, sha);
    viewedStore.markViewed("c1", "src/app.ts");

    // Reload
    viewedStore.loadFor(prUrl, sha);

    expect(viewedStore.isViewed("c1", "src/app.ts")).toBe(true);
  });

  it("different headSha starts fresh", () => {
    const prUrl = "https://github.com/a/b/pull/1";

    viewedStore.loadFor(prUrl, "sha-old");
    viewedStore.markViewed("c1", "src/app.ts");

    viewedStore.loadFor(prUrl, "sha-new");

    expect(viewedStore.isViewed("c1", "src/app.ts")).toBe(false);
  });

  it("persists to localStorage key pr-triage:viewed:{prUrl}:{headSha}", () => {
    const prUrl = "https://github.com/a/b/pull/2";
    const sha = "deadbeef";

    viewedStore.loadFor(prUrl, sha);
    viewedStore.markViewed("c1", "src/foo.ts");

    const key = `pr-triage:viewed:${prUrl}:${sha}`;
    const stored = lsMock.getItem(key);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed).toContain("c1:src/foo.ts");
  });

  it("handles corrupt JSON gracefully (acts like empty viewed set)", () => {
    const prUrl = "https://github.com/a/b/pull/3";
    const sha = "badf00d";
    const key = `pr-triage:viewed:${prUrl}:${sha}`;

    lsMock.setItem(key, "{ not valid json {{{{");

    viewedStore.loadFor(prUrl, sha);

    expect(viewedStore.all().size).toBe(0);
  });

  it("noop gracefully when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("no storage"); },
      setItem: () => { throw new Error("no storage"); },
      removeItem: () => { throw new Error("no storage"); },
    });

    expect(() => {
      viewedStore.loadFor("https://github.com/a/b/pull/4", "sha123");
      viewedStore.markViewed("c1", "src/foo.ts");
    }).not.toThrow();
  });
});
