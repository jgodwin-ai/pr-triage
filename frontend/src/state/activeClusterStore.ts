type Listener = () => void;

function createActiveClusterStore() {
  let activeClusterId: string | null = null;
  const listeners = new Set<Listener>();
  const notify = () => listeners.forEach((l) => l());

  return {
    set(id: string | null): void {
      activeClusterId = id;
      notify();
    },

    get(): string | null {
      return activeClusterId;
    },

    subscribe(l: Listener): () => void {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export const activeClusterStore = createActiveClusterStore();
