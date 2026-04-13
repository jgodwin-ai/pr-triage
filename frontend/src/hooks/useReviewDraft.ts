import { useSyncExternalStore } from "react";
import { reviewDraftStore } from "../state/reviewDraft.js";

export function useReviewDraft() {
  return useSyncExternalStore(
    (l) => reviewDraftStore.subscribe(l),
    () => reviewDraftStore.snapshot(),
  );
}
