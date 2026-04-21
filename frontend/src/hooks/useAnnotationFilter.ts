import { useSyncExternalStore } from "react";
import { annotationFilterStore } from "../state/annotationFilterStore.js";

export function useAnnotationFilter() {
  return useSyncExternalStore(
    (l) => annotationFilterStore.subscribe(l),
    () => annotationFilterStore.get(),
  );
}
