import { reviewDraftStore } from "../state/reviewDraft.js";
import { useReviewDraft } from "../hooks/useReviewDraft.js";
import { activeClusterStore } from "../state/activeClusterStore.js";
import { renderEmoji } from "../utils/emoji.js";
import type { CommentTarget } from "../types.js";

function targetLabel(target: CommentTarget): string {
  switch (target.kind) {
    case "cluster": return `cluster · ${target.clusterId}`;
    case "file": return `file · ${basename(target.path)}`;
    case "line": return `line · ${basename(target.path)} L${target.line}`;
    case "annotation": return `annotation · ${basename(target.path)} #${target.annotationIndex}`;
  }
}

function basename(p: string) {
  const idx = p.lastIndexOf("/");
  return idx < 0 ? p : p.slice(idx + 1);
}

function jumpTo(target: CommentTarget) {
  // 1. switch to the target's cluster if needed
  if ("clusterId" in target) activeClusterStore.set(target.clusterId);
  // 2. next tick, scroll to the file card
  setTimeout(() => {
    if (target.kind === "cluster") return;
    const id = `file-${target.clusterId}-${encodeURIComponent(target.path)}`;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    // 3. highlight briefly
    el.classList.add("is-jump-target");
    setTimeout(() => el.classList.remove("is-jump-target"), 1500);
  }, 50);
}

export default function DraftedComments() {
  const draft = useReviewDraft();
  if (draft.comments.length === 0) return null;
  return (
    <div className="drafted-comments">
      <div className="drafted-comments__title">Drafted comments ({draft.comments.length})</div>
      <ul className="drafted-comments__list">
        {draft.comments.map((c) => (
          <li key={c.id} className={`drafted-comments__item ${c.stale ? "is-stale" : ""}`}>
            <div className="drafted-comments__ctx">{targetLabel(c.target)}{c.stale ? " · stale" : ""}</div>
            <div className="drafted-comments__body">{renderEmoji(c.body)}</div>
            <div className="drafted-comments__actions">
              <button className="btn-link" onClick={() => jumpTo(c.target)}>Jump</button>
              <button className="btn-link" onClick={() => reviewDraftStore.removeComment(c.id)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
