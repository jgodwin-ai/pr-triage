type Listener = () => void;

interface ActiveFileState {
  activeFilePath: string | null;
  activeClusterId: string | null;
}

function createActiveFileStore() {
  let state: ActiveFileState = { activeFilePath: null, activeClusterId: null };
  const listeners = new Set<Listener>();
  const notify = () => listeners.forEach((l) => l());

  return {
    set(next: ActiveFileState): void {
      state = next;
      notify();
    },

    get(): ActiveFileState {
      return state;
    },

    subscribe(l: Listener): () => void {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export const activeFileStore = createActiveFileStore();
