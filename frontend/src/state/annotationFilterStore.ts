import type { AnnotationFilter } from "../components/AnnotationFilterBar.js";

type Listener = (filter: AnnotationFilter) => void;

function createStore() {
  let filter: AnnotationFilter = { warning: true, info: true, suggestion: true };
  const listeners = new Set<Listener>();
  const notify = () => listeners.forEach((l) => l(filter));

  return {
    get(): AnnotationFilter { return filter; },
    set(next: AnnotationFilter) { filter = next; notify(); },
    subscribe(l: Listener) { listeners.add(l); return () => listeners.delete(l); },
  };
}

export const annotationFilterStore = createStore();
