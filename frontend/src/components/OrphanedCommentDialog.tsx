import type { OrphanedComment } from "../types.js";

interface Props {
  orphans: OrphanedComment[];
  onPromote: (orphan: OrphanedComment) => void;
  onDrop: (orphan: OrphanedComment) => void;
  onClose: () => void;
}

const EXCERPT_LEN = 80;

function excerpt(body: string): string {
  if (body.length <= EXCERPT_LEN) return body;
  return body.slice(0, EXCERPT_LEN).trimEnd() + "…";
}

function orphanKey(o: OrphanedComment): string {
  return `${o.commit_id}:${o.path}:${o.line}`;
}

/**
 * Presentational dialog listing inline review comments that GitHub rejected as
 * orphans (line/file gone at the anchored commit). Per-row actions:
 * - "Promote to file-level": parent re-submits as a file-level comment.
 * - "Drop": parent removes from local state.
 *
 * The dialog renders nothing when `orphans` is empty; the parent normally also
 * unmounts it once the user resolves the last row.
 */
export default function OrphanedCommentDialog({
  orphans,
  onPromote,
  onDrop,
  onClose,
}: Props) {
  if (orphans.length === 0) return null;

  return (
    <div
      className="orphan-dialog__backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="orphan-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="orphan-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="orphan-dialog__header">
          <h3 id="orphan-dialog-title" className="orphan-dialog__title">
            Orphaned comments ({orphans.length})
          </h3>
          <button
            type="button"
            className="orphan-dialog__close"
            onClick={onClose}
            aria-label="Close"
          >
            Close
          </button>
        </div>
        <p className="orphan-dialog__intro">
          GitHub rejected these inline comments because the line or file no longer
          exists at the anchored commit. You can promote each one to a file-level
          comment or drop it.
        </p>
        <ul className="orphan-dialog__list">
          {orphans.map((o) => (
            <li key={orphanKey(o)} className="orphan-dialog__row">
              <div className="orphan-dialog__row-header">
                <span className="orphan-dialog__path">{o.path}</span>
                <span className="orphan-dialog__line">:{o.line}</span>
              </div>
              <div className="orphan-dialog__body">{excerpt(o.body)}</div>
              <div className="orphan-dialog__reason">Reason: {o.reason}</div>
              <div className="orphan-dialog__row-actions">
                <button
                  type="button"
                  className="orphan-dialog__promote"
                  onClick={() => onPromote(o)}
                >
                  Promote to file-level
                </button>
                <button
                  type="button"
                  className="orphan-dialog__drop"
                  onClick={() => onDrop(o)}
                >
                  Drop
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
