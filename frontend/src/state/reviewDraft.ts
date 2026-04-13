import { v4 as uuidv4 } from "uuid";
import type { ReviewComment, CommentTarget, ReviewDraft } from "../types.js";

type Listener = (draft: ReviewDraft) => void;

function targetKey(t: CommentTarget): string {
  switch (t.kind) {
    case "cluster": return `cluster:${t.clusterId}`;
    case "file": return `file:${t.clusterId}:${t.path}`;
    case "line": return `line:${t.clusterId}:${t.path}:${t.side}:${t.line}`;
    case "annotation": return `ann:${t.clusterId}:${t.path}:${t.annotationIndex}`;
  }
}

function createStore() {
  let draft: ReviewDraft = { prUrl: "", comments: [], event: "COMMENT", summary: "" };
  const listeners = new Set<Listener>();
  const notify = () => listeners.forEach((l) => l(draft));

  return {
    setPrUrl(url: string) { draft = { ...draft, prUrl: url }; notify(); },
    setEvent(event: ReviewDraft["event"]) { draft = { ...draft, event }; notify(); },
    setSummary(summary: string) { draft = { ...draft, summary }; notify(); },
    addComment(target: CommentTarget, body: string): ReviewComment {
      const c: ReviewComment = { id: uuidv4(), target, body, createdAt: Date.now() };
      draft = { ...draft, comments: [...draft.comments, c] };
      notify();
      return c;
    },
    updateComment(id: string, body: string) {
      draft = { ...draft, comments: draft.comments.map((c) => (c.id === id ? { ...c, body } : c)) };
      notify();
    },
    removeComment(id: string) {
      draft = { ...draft, comments: draft.comments.filter((c) => c.id !== id) };
      notify();
    },
    getComments(target: CommentTarget): ReviewComment[] {
      const key = targetKey(target);
      return draft.comments.filter((c) => targetKey(c.target) === key);
    },
    all(): ReviewComment[] { return draft.comments; },
    snapshot(): ReviewDraft { return draft; },
    reset() { draft = { prUrl: "", comments: [], event: "COMMENT", summary: "" }; notify(); },
    subscribe(l: Listener) { listeners.add(l); return () => listeners.delete(l); },
  };
}

export const reviewDraftStore = createStore();
