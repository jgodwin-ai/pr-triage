import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { stackStore, type Level } from "../../src/state/stack.js";
import type { PRAnalysis } from "../../src/types.js";

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

function makeLevels(): Level[] {
  return [
    {
      sha: "aaa1111",
      shortSha: "aaa1111",
      message: "first",
      parentSha: "base000",
      kind: "feature",
      files: ["src/a.ts"],
      status: "pending",
    },
    {
      sha: "bbb2222",
      shortSha: "bbb2222",
      message: "second",
      parentSha: "aaa1111",
      kind: "feature",
      files: ["src/b.ts"],
      status: "pending",
    },
    {
      sha: "ccc3333",
      shortSha: "ccc3333",
      message: "lint",
      parentSha: "bbb2222",
      kind: "noise",
      noiseReason: "lint-only",
      files: ["src/c.ts"],
      status: "pending",
    },
  ];
}

function makeAnalysis(id: string): PRAnalysis {
  return {
    id,
    pr: {
      url: "",
      title: "",
      author: "",
      baseBranch: "",
      headBranch: "",
      additions: 0,
      deletions: 0,
      fileCount: 0,
      headSha: id,
    },
    executiveSummary: `summary for ${id}`,
    clusters: [],
    timeSaved: "0m",
  };
}

describe("stackStore — basic operations", () => {
  beforeEach(() => {
    // Reset to empty by setting empty stack on a throwaway URL
    stackStore.setStack("https://github.com/reset/repo/pull/0", []);
  });

  it("setStack populates levels and prUrl", () => {
    const url = "https://github.com/a/b/pull/1";
    const levels = makeLevels();
    stackStore.setStack(url, levels);
    const snap = stackStore.snapshot();
    expect(snap.prUrl).toBe(url);
    expect(snap.levels).toHaveLength(3);
    expect(snap.levels[0].sha).toBe("aaa1111");
  });

  it("setStack defaults selectedSha to first level when no persisted value", () => {
    const url = "https://github.com/a/b/pull/100";
    stackStore.setStack(url, makeLevels());
    expect(stackStore.snapshot().selectedSha).toBe("aaa1111");
  });

  it("setStack with empty levels yields null selectedSha", () => {
    stackStore.setStack("https://github.com/a/b/pull/101", []);
    expect(stackStore.snapshot().selectedSha).toBeNull();
  });

  it("setSelected updates selectedSha", () => {
    stackStore.setStack("https://github.com/a/b/pull/2", makeLevels());
    stackStore.setSelected("bbb2222");
    expect(stackStore.snapshot().selectedSha).toBe("bbb2222");
  });

  it("notifies subscribers on setStack", () => {
    let calls = 0;
    const unsub = stackStore.subscribe(() => calls++);
    stackStore.setStack("https://github.com/a/b/pull/3", makeLevels());
    expect(calls).toBe(1);
    unsub();
  });

  it("notifies subscribers on setSelected", () => {
    stackStore.setStack("https://github.com/a/b/pull/4", makeLevels());
    let calls = 0;
    const unsub = stackStore.subscribe(() => calls++);
    stackStore.setSelected("bbb2222");
    expect(calls).toBe(1);
    unsub();
  });

  it("setSelected to same value is a no-op (no notify)", () => {
    stackStore.setStack("https://github.com/a/b/pull/5", makeLevels());
    stackStore.setSelected("bbb2222");
    let calls = 0;
    const unsub = stackStore.subscribe(() => calls++);
    stackStore.setSelected("bbb2222");
    expect(calls).toBe(0);
    unsub();
  });

  it("onLevelReady sets matching level's status to ready and stashes analysis", () => {
    stackStore.setStack("https://github.com/a/b/pull/6", makeLevels());
    const analysis = makeAnalysis("bbb2222");
    stackStore.onLevelReady({ sha: "bbb2222", analysis });
    const lvl = stackStore.snapshot().levels.find((l) => l.sha === "bbb2222")!;
    expect(lvl.status).toBe("ready");
    expect(lvl.analysis).toEqual(analysis);
  });

  it("onLevelReady on unknown sha is a no-op", () => {
    stackStore.setStack("https://github.com/a/b/pull/7", makeLevels());
    const before = stackStore.snapshot().levels;
    stackStore.onLevelReady({ sha: "zzz9999", analysis: makeAnalysis("zzz9999") });
    expect(stackStore.snapshot().levels).toEqual(before);
  });

  it("onLevelError sets matching level's status to error", () => {
    stackStore.setStack("https://github.com/a/b/pull/8", makeLevels());
    stackStore.onLevelError({ sha: "ccc3333", error: "boom" });
    const lvl = stackStore.snapshot().levels.find((l) => l.sha === "ccc3333")!;
    expect(lvl.status).toBe("error");
  });

  it("levelAnalysis returns the cached analysis after onLevelReady", () => {
    stackStore.setStack("https://github.com/a/b/pull/9", makeLevels());
    const analysis = makeAnalysis("aaa1111");
    stackStore.onLevelReady({ sha: "aaa1111", analysis });
    expect(stackStore.levelAnalysis("aaa1111")).toEqual(analysis);
  });

  it("levelAnalysis returns undefined for unknown / pending sha", () => {
    stackStore.setStack("https://github.com/a/b/pull/10", makeLevels());
    expect(stackStore.levelAnalysis("aaa1111")).toBeUndefined();
    expect(stackStore.levelAnalysis("nope")).toBeUndefined();
  });

  it("onLevelReady notifies subscribers", () => {
    stackStore.setStack("https://github.com/a/b/pull/11", makeLevels());
    let calls = 0;
    const unsub = stackStore.subscribe(() => calls++);
    stackStore.onLevelReady({ sha: "bbb2222", analysis: makeAnalysis("bbb2222") });
    expect(calls).toBe(1);
    unsub();
  });

  it("onLevelError notifies subscribers", () => {
    stackStore.setStack("https://github.com/a/b/pull/12", makeLevels());
    let calls = 0;
    const unsub = stackStore.subscribe(() => calls++);
    stackStore.onLevelError({ sha: "bbb2222", error: "x" });
    expect(calls).toBe(1);
    unsub();
  });
});

describe("stackStore — localStorage persistence of selectedSha", () => {
  let lsMock: ReturnType<typeof makeLocalStorageMock>;

  beforeEach(() => {
    lsMock = makeLocalStorageMock();
    vi.stubGlobal("localStorage", lsMock);
    // Reset store state
    stackStore.setStack("https://github.com/reset/repo/pull/0", []);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("setSelected persists per prUrl to localStorage", () => {
    const url = "https://github.com/a/b/pull/20";
    stackStore.setStack(url, makeLevels());
    stackStore.setSelected("bbb2222");
    const key = `pr-triage:stack-selected:${url}`;
    expect(lsMock.getItem(key)).toBe("bbb2222");
  });

  it("setStack restores previously persisted selectedSha for the same prUrl", () => {
    const url = "https://github.com/a/b/pull/21";
    const key = `pr-triage:stack-selected:${url}`;
    lsMock.setItem(key, "ccc3333");

    stackStore.setStack(url, makeLevels());
    expect(stackStore.snapshot().selectedSha).toBe("ccc3333");
  });

  it("falls back to first level if persisted sha is no longer in the stack", () => {
    const url = "https://github.com/a/b/pull/22";
    const key = `pr-triage:stack-selected:${url}`;
    lsMock.setItem(key, "stale-sha-not-in-stack");

    stackStore.setStack(url, makeLevels());
    expect(stackStore.snapshot().selectedSha).toBe("aaa1111");
  });

  it("different prUrl does not share selection", () => {
    const url1 = "https://github.com/a/b/pull/23";
    const url2 = "https://github.com/a/b/pull/24";

    stackStore.setStack(url1, makeLevels());
    stackStore.setSelected("bbb2222");

    stackStore.setStack(url2, makeLevels());
    expect(stackStore.snapshot().selectedSha).toBe("aaa1111");
  });

  it("noop gracefully when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("no storage"); },
      setItem: () => { throw new Error("no storage"); },
      removeItem: () => { throw new Error("no storage"); },
    });

    expect(() => {
      stackStore.setStack("https://github.com/a/b/pull/25", makeLevels());
      stackStore.setSelected("bbb2222");
    }).not.toThrow();
  });
});
