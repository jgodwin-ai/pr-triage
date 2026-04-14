import { useState } from "react";
import { reviewDraftStore } from "../state/reviewDraft.js";
import { useReviewDraft } from "../hooks/useReviewDraft.js";

interface Props { prUrl: string; }

export default function ReviewSubmitBar({ prUrl }: Props) {
  const draft = useReviewDraft();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const staleCount = draft.comments.filter((c) => c.stale).length;
  const totalCount = draft.comments.length;

  const breakdown: string[] = [];
  const lineCount = draft.comments.filter((c) => c.target.kind === "line").length;
  const clusterCount = draft.comments.filter((c) => c.target.kind === "cluster").length;
  const fileCount = draft.comments.filter((c) => c.target.kind === "file").length;
  const annotationCount = draft.comments.filter((c) => c.target.kind === "annotation").length;
  if (lineCount) breakdown.push(`${lineCount} line`);
  if (clusterCount) breakdown.push(`${clusterCount} cluster`);
  if (fileCount) breakdown.push(`${fileCount} file`);
  if (annotationCount) breakdown.push(`${annotationCount} annotation`);

  const submit = async () => {
    setSubmitting(true); setError(null);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prUrl,
          summary: draft.summary,
          event: draft.event,
          comments: draft.comments,
        }),
      });
      if (!res.ok) {
        let msg = "Failed";
        try { msg = (await res.json()).error || msg; } catch { /* ignore */ }
        throw new Error(msg);
      }
      const data = await res.json();
      setResult({ url: data.htmlUrl });
      reviewDraftStore.reset();
    } catch (e: any) {
      setError(e.message ?? "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="review-form">
      <h2 className="review-form__heading">Finish review</h2>

      <textarea
        className="review-form__summary form-input"
        placeholder="Leave a general comment about this PR (optional)"
        value={draft.summary}
        onChange={(e) => reviewDraftStore.setSummary(e.target.value)}
        rows={4}
        disabled={submitting}
      />

      <div className="review-form__status">
        <span>
          <strong>{totalCount} comment{totalCount === 1 ? "" : "s"}</strong> pending
          {breakdown.length > 0 && ` (${breakdown.join(", ")})`}
        </span>
        {staleCount > 0 && (
          <span className="review-form__stale-warning">
            {staleCount} comment{staleCount === 1 ? "" : "s"} from a previous commit
          </span>
        )}
      </div>

      <div className="review-form__radio-group" role="group" aria-label="Review type">
        {(["COMMENT", "APPROVE", "REQUEST_CHANGES"] as const).map((ev) => {
          const labels: Record<string, string> = {
            COMMENT: "Comment",
            APPROVE: "Approve",
            REQUEST_CHANGES: "Request changes",
          };
          return (
            <label
              key={ev}
              className={`review-form__radio review-form__radio--${ev.toLowerCase().replace("_", "-")} ${draft.event === ev ? "is-selected" : ""}`}
            >
              <input
                type="radio"
                name="review-event"
                value={ev}
                checked={draft.event === ev}
                onChange={() => reviewDraftStore.setEvent(ev)}
                disabled={submitting}
              />
              {labels[ev]}
            </label>
          );
        })}
      </div>

      <div className="review-form__actions">
        <button className="btn-primary" disabled={submitting} onClick={submit}>
          {submitting ? "Submitting…" : "Submit review"}
        </button>
        {result && (
          <a href={result.url} target="_blank" rel="noreferrer" className="review-form__gh-link">
            View on GitHub →
          </a>
        )}
        {error && <span className="error-bar review-form__error">{error}</span>}
      </div>
    </div>
  );
}
