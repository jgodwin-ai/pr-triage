import type { PRAnalysis } from "../types.js";

// `AnalysisResult` in spec parlance == the existing Phase 1 `PRAnalysis` type.
// Aliased here so callers can use the spec name without redefining the type.
export type AnalysisResult = PRAnalysis;

export interface Level {
  sha: string;
  shortSha: string;
  message: string;
  parentSha: string;
  kind: "feature" | "noise";
  noiseReason?: string;
  files: string[];
  status: "pending" | "analyzing" | "ready" | "error";
  analysis?: AnalysisResult;
}

export interface StackSnapshot {
  prUrl: string | null;
  levels: Level[];
  selectedSha: string | null;
  /**
   * Most recently observed head SHA from the GitHub PR, regardless of which
   * SHA the currently-displayed analysis was built against. Set by code that
   * fetches PR data; the reload banner compares this against the analysis's
   * headSha to surface drift.
   */
  latestKnownHeadSha: string | null;
}

type Listener = (snapshot: StackSnapshot) => void;

function selectedKey(prUrl: string): string {
  return `pr-triage:stack-selected:${prUrl}`;
}

function loadPersistedSelected(prUrl: string): string | null {
  try {
    return window.localStorage.getItem(selectedKey(prUrl));
  } catch {
    return null;
  }
}

function persistSelected(prUrl: string, sha: string | null): void {
  if (!prUrl) return;
  try {
    if (sha === null) {
      window.localStorage.removeItem(selectedKey(prUrl));
    } else {
      window.localStorage.setItem(selectedKey(prUrl), sha);
    }
  } catch {
    // noop
  }
}

const initialState: StackSnapshot = {
  prUrl: null,
  levels: [],
  selectedSha: null,
  latestKnownHeadSha: null,
};

function createStackStore() {
  let state: StackSnapshot = initialState;
  const listeners = new Set<Listener>();
  const notify = () => listeners.forEach((l) => l(state));

  return {
    setStack(prUrl: string, levels: Level[]): void {
      let nextSelected: string | null = null;
      if (levels.length > 0) {
        const persisted = loadPersistedSelected(prUrl);
        if (persisted && levels.some((l) => l.sha === persisted)) {
          nextSelected = persisted;
        } else {
          nextSelected = levels[0].sha;
        }
      }
      state = { ...state, prUrl, levels, selectedSha: nextSelected };
      notify();
    },

    setSelected(sha: string): void {
      if (state.selectedSha === sha) return;
      state = { ...state, selectedSha: sha };
      if (state.prUrl) persistSelected(state.prUrl, sha);
      notify();
    },

    levelAnalysis(sha: string): AnalysisResult | undefined {
      return state.levels.find((l) => l.sha === sha)?.analysis;
    },

    onLevelReady(payload: { sha: string; analysis: AnalysisResult }): void {
      const idx = state.levels.findIndex((l) => l.sha === payload.sha);
      if (idx === -1) return;
      const next = state.levels.slice();
      next[idx] = { ...next[idx], status: "ready", analysis: payload.analysis };
      state = { ...state, levels: next };
      notify();
    },

    onLevelError(payload: { sha: string; error: string }): void {
      const idx = state.levels.findIndex((l) => l.sha === payload.sha);
      if (idx === -1) return;
      const next = state.levels.slice();
      next[idx] = { ...next[idx], status: "error" };
      state = { ...state, levels: next };
      notify();
    },

    setLatestKnownHeadSha(sha: string | null): void {
      if (state.latestKnownHeadSha === sha) return;
      state = { ...state, latestKnownHeadSha: sha };
      notify();
    },

    snapshot(): StackSnapshot {
      return state;
    },

    subscribe(l: Listener): () => void {
      listeners.add(l);
      return () => listeners.delete(l);
    },

    /** Test-only reset. */
    _resetForTest(): void {
      state = initialState;
      notify();
    },
  };
}

export const stackStore = createStackStore();
export type StackStore = typeof stackStore;
