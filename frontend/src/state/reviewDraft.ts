import { v4 as uuidv4 } from "uuid";
import type { ReviewComment, CommentTarget, ReviewDraft } from "../types.js";

type Listener = (draft: ReviewDraft) => void;

const MANIFEST_KEY = "pr-triage:draft:manifest";
const MAX_MANIFEST = 20;

interface ManifestEntry {
  prUrl: string;
  headSha: string;
  updatedAt: number;
}

function draftKey(prUrl: string, headSha: string): string {
  return `pr-triage:draft:${prUrl}:${headSha}`;
}

function targetKey(t: CommentTarget): string {
  switch (t.kind) {
    case "cluster": return `cluster:${t.clusterId}`;
    case "file": return `file:${t.clusterId}:${t.path}`;
    case "line": return `line:${t.clusterId}:${t.path}:${t.side}:${t.line}`;
    case "annotation": return `ann:${t.clusterId}:${t.path}:${t.annotationIndex}`;
  }
}

function readManifest(): ManifestEntry[] {
  try {
    const raw = window.localStorage.getItem(MANIFEST_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ManifestEntry[];
  } catch {
    return [];
  }
}

function writeManifest(entries: ManifestEntry[]): void {
  try {
    window.localStorage.setItem(MANIFEST_KEY, JSON.stringify(entries));
  } catch {
    // noop
  }
}

function upsertManifest(prUrl: string, headSha: string): void {
  try {
    const entries = readManifest().filter(
      (e) => !(e.prUrl === prUrl && e.headSha === headSha),
    );
    entries.unshift({ prUrl, headSha, updatedAt: Date.now() });
    writeManifest(entries.slice(0, MAX_MANIFEST));
  } catch {
    // noop
  }
}

function removeFromManifest(prUrl: string, headSha: string): void {
  try {
    const entries = readManifest().filter(
      (e) => !(e.prUrl === prUrl && e.headSha === headSha),
    );
    writeManifest(entries);
  } catch {
    // noop
  }
}

function persistDraft(draft: ReviewDraft, headSha: string): void {
  if (!draft.prUrl || !headSha) return;
  try {
    const key = draftKey(draft.prUrl, headSha);
    window.localStorage.setItem(key, JSON.stringify(draft));
    upsertManifest(draft.prUrl, headSha);
  } catch {
    // noop
  }
}

function loadDraft(prUrl: string, headSha: string): ReviewDraft | null {
  try {
    const raw = window.localStorage.getItem(draftKey(prUrl, headSha));
    if (!raw) return null;
    return JSON.parse(raw) as ReviewDraft;
  } catch {
    return null;
  }
}

function createStore() {
  let draft: ReviewDraft = { prUrl: "", comments: [], event: "COMMENT", summary: "" };
  let currentHeadSha = "";
  const listeners = new Set<Listener>();
  const notify = () => listeners.forEach((l) => l(draft));

  const persist = () => persistDraft(draft, currentHeadSha);

  return {
    setPrUrl(url: string) { draft = { ...draft, prUrl: url }; notify(); },
    setEvent(event: ReviewDraft["event"]) { draft = { ...draft, event }; notify(); persist(); },
    setSummary(summary: string) { draft = { ...draft, summary }; notify(); persist(); },
    addComment(target: CommentTarget, body: string): ReviewComment {
      const c: ReviewComment = { id: uuidv4(), target, body, createdAt: Date.now() };
      draft = { ...draft, comments: [...draft.comments, c] };
      notify();
      persist();
      return c;
    },
    updateComment(id: string, body: string) {
      draft = { ...draft, comments: draft.comments.map((c) => (c.id === id ? { ...c, body } : c)) };
      notify();
      persist();
    },
    removeComment(id: string) {
      draft = { ...draft, comments: draft.comments.filter((c) => c.id !== id) };
      notify();
      persist();
    },
    getComments(target: CommentTarget): ReviewComment[] {
      const key = targetKey(target);
      return draft.comments.filter((c) => targetKey(c.target) === key);
    },
    all(): ReviewComment[] { return draft.comments; },
    snapshot(): ReviewDraft { return draft; },
    reset() {
      const { prUrl } = draft;
      const sha = currentHeadSha;
      draft = { prUrl: "", comments: [], event: "COMMENT", summary: "" };
      currentHeadSha = "";
      notify();
      // Remove persisted entry
      if (prUrl && sha) {
        try {
          window.localStorage.removeItem(draftKey(prUrl, sha));
          removeFromManifest(prUrl, sha);
        } catch {
          // noop
        }
      }
    },
    loadFor(prUrl: string, headSha: string): void {
      currentHeadSha = headSha;

      // Try exact match first
      const exact = loadDraft(prUrl, headSha);
      if (exact) {
        draft = { ...exact, prUrl };
        notify();
        return;
      }

      // Look for same prUrl but different headSha
      const manifest = readManifest();
      const staleEntry = manifest.find((e) => e.prUrl === prUrl && e.headSha !== headSha);
      if (staleEntry) {
        const staleDraft = loadDraft(prUrl, staleEntry.headSha);
        if (staleDraft) {
          const staleComments = staleDraft.comments.map((c) => ({ ...c, stale: true }));
          draft = { ...staleDraft, prUrl, comments: staleComments };
          notify();
          return;
        }
      }

      // Fresh start
      draft = { prUrl, comments: [], event: "COMMENT", summary: "" };
      notify();
    },
    subscribe(l: Listener) { listeners.add(l); return () => listeners.delete(l); },
  };
}

export const reviewDraftStore = createStore();
