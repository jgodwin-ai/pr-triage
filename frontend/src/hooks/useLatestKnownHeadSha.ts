import { useSyncExternalStore } from "react";
import { stackStore } from "../state/stack.js";

export function useLatestKnownHeadSha(): string | null {
  return useSyncExternalStore(
    (l) => stackStore.subscribe(l),
    () => stackStore.snapshot().latestKnownHeadSha,
    () => stackStore.snapshot().latestKnownHeadSha,
  );
}
