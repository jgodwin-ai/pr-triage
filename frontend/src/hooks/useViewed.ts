import { useSyncExternalStore } from "react";
import { viewedStore } from "../state/viewedStore.js";

export function useViewed() {
  return useSyncExternalStore(
    (l) => viewedStore.subscribe(l),
    () => viewedStore.snapshot(),
  );
}
