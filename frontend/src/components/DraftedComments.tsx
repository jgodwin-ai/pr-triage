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
  if ("clusterId" in target) activeClusterStore.set(target.clusterId);
  // Ask the target file to mount eagerly so its inner anchors (line comments,
  // annotation widgets) actually exist by the time we scroll.
  if (target.kind !== "cluster") {
    window.dispatchEvent(
      new CustomEvent("pr-triage:mount-file", {
        detail: { clusterId: target.clusterId, path: target.path },
      }),
    );
  }
  setTimeout(() => {
    if (target.kind === "cluster") return;

    const path = encodeURIComponent(target.path);
    const candidates: string[] = [];
    if (target.kind === "line") {
      candidates.push(`line-${target.clusterId}-${path}-${target.side}-${target.line}`);
    } else if (target.kind === "annotation") {
      candidates.push(`ann-${target.clusterId}-${path}-${target.annotationIndex}`);
    }
    candidates.push(`file-${target.clusterId}-${path}`);

    let el: HTMLElement | null = null;
    for (const id of candidates) {
      el = document.getElementById(id);
      if (el) break;
    }
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("is-jump-target");
    setTimeout(() => el?.classList.remove("is-jump-target"), 1500);
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
