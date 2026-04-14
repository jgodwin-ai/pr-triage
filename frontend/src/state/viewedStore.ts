type Listener = (viewed: Set<string>) => void;

interface ViewedState {
  viewedFiles: Set<string>;
}

function viewedKey(prUrl: string, headSha: string): string {
  return `pr-triage:viewed:${prUrl}:${headSha}`;
}

function fileKey(clusterId: string, filePath: string): string {
  return `${clusterId}:${filePath}`;
}

function persistViewed(viewedFiles: Set<string>, prUrl: string, headSha: string): void {
  if (!prUrl || !headSha) return;
  try {
    const key = viewedKey(prUrl, headSha);
    window.localStorage.setItem(key, JSON.stringify([...viewedFiles]));
  } catch {
    // noop
  }
}

function loadViewed(prUrl: string, headSha: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(viewedKey(prUrl, headSha));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function createViewedStore() {
  let state: ViewedState = { viewedFiles: new Set() };
  let currentPrUrl = "";
  let currentHeadSha = "";
  const listeners = new Set<Listener>();
  const notify = () => listeners.forEach((l) => l(state.viewedFiles));

  const persist = () => persistViewed(state.viewedFiles, currentPrUrl, currentHeadSha);

  return {
    loadFor(prUrl: string, headSha: string): void {
      currentPrUrl = prUrl;
      currentHeadSha = headSha;
      state = { viewedFiles: loadViewed(prUrl, headSha) };
      notify();
    },

    markViewed(clusterId: string, filePath: string): void {
      const key = fileKey(clusterId, filePath);
      if (state.viewedFiles.has(key)) return;
      state = { viewedFiles: new Set([...state.viewedFiles, key]) };
      notify();
      persist();
    },

    unmarkViewed(clusterId: string, filePath: string): void {
      const key = fileKey(clusterId, filePath);
      if (!state.viewedFiles.has(key)) return;
      const next = new Set(state.viewedFiles);
      next.delete(key);
      state = { viewedFiles: next };
      notify();
      persist();
    },

    isViewed(clusterId: string, filePath: string): boolean {
      return state.viewedFiles.has(fileKey(clusterId, filePath));
    },

    all(): Set<string> {
      return state.viewedFiles;
    },

    snapshot(): ViewedState {
      return state;
    },

    subscribe(l: Listener) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export const viewedStore = createViewedStore();
