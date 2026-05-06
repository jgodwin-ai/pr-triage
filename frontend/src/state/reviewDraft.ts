import { v4 as uuidv4 } from "uuid";
import type { ReviewComment, CommentTarget, ReviewDraft } from "../types.js";
import { stackStore } from "./stack.js";

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
    case "file": return `file:${t.commitId ?? ""}:${t.clusterId}:${t.path}`;
    case "line": return `line:${t.commitId ?? ""}:${t.clusterId}:${t.path}:${t.side}:${t.line}`;
    case "annotation": return `ann:${t.commitId ?? ""}:${t.clusterId}:${t.path}:${t.annotationIndex}`;
  }
}

/**
 * For file/line/annotation kinds, attach a `commitId` to the target so
 * later operations (key lookup, per-level scoping, submit-time anchoring) can
 * route the draft to the correct commit. Resolution order:
 *   1. explicit `commitId` already on the target (caller-supplied) — kept.
 *   2. `stackStore.snapshot().selectedSha` if a stack is loaded.
 *   3. `fallbackHeadSha` (the PR head SHA the draft was loaded against) so
 *      legacy single-PR flows still anchor to a real commit.
 * Cluster-kind targets are PR-wide and never receive a commitId.
 */
/**
 * Back-compat for drafts authored before JGT-31 added `commitId` to
 * file/line/annotation targets. When loading a persisted draft, fill in any
 * missing `commitId` with the SHA the draft was persisted against. Cluster
 * comments are PR-wide and stay un-attributed.
 */
function backfillCommitId(comments: ReviewComment[], fallbackSha: string): ReviewComment[] {
  if (!fallbackSha) return comments;
  return comments.map((c) => {
    if (c.target.kind === "cluster") return c;
    const t = c.target as { commitId?: string } & CommentTarget;
    if (t.commitId) return c;
    const target = { ...t, commitId: fallbackSha } as CommentTarget;
    return { ...c, target, commit_id: c.commit_id ?? fallbackSha };
  });
}

function resolveTargetCommitId(target: CommentTarget, fallbackHeadSha: string): CommentTarget {
  if (target.kind === "cluster") return target;
  const existing = (target as { commitId?: string }).commitId;
  if (existing) return target;
  const selected = stackStore.snapshot().selectedSha;
  const commitId = selected ?? fallbackHeadSha;
  if (!commitId) return target;
  return { ...target, commitId };
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
      const resolvedTarget = resolveTargetCommitId(target, currentHeadSha);
      const commitId =
        resolvedTarget.kind === "cluster"
          ? undefined
          : (resolvedTarget as { commitId?: string }).commitId;
      const c: ReviewComment = {
        id: uuidv4(),
        target: resolvedTarget,
        body,
        createdAt: Date.now(),
        ...(commitId ? { commit_id: commitId } : {}),
      };
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
        draft = { ...exact, prUrl, comments: backfillCommitId(exact.comments, headSha) };
        notify();
        return;
      }

      // Look for same prUrl but different headSha
      const manifest = readManifest();
      const staleEntry = manifest.find((e) => e.prUrl === prUrl && e.headSha !== headSha);
      if (staleEntry) {
        const staleDraft = loadDraft(prUrl, staleEntry.headSha);
        if (staleDraft) {
          // Stale comments belong to the *previous* head SHA — backfill against that.
          const filled = backfillCommitId(staleDraft.comments, staleEntry.headSha);
          const staleComments = filled.map((c) => ({ ...c, stale: true }));
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
