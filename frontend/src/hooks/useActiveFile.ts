import { useSyncExternalStore } from "react";
import { activeFileStore } from "../state/activeFileStore.js";

export function useActiveFile() {
  return useSyncExternalStore(
    (l) => activeFileStore.subscribe(l),
    () => activeFileStore.get(),
  );
}
