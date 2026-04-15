import { useSyncExternalStore } from "react";
import { activeClusterStore } from "../state/activeClusterStore.js";

export function useActiveCluster(): string | null {
  return useSyncExternalStore(
    (l) => activeClusterStore.subscribe(l),
    () => activeClusterStore.get(),
  );
}
