import { useState } from "react";
import { reviewDraftStore } from "../state/reviewDraft.js";
import { useReviewDraft } from "../hooks/useReviewDraft.js";

interface Props { prUrl: string; }

export default function ReviewSubmitBar({ prUrl }: Props) {
  useReviewDraft();
  const draft = reviewDraftStore.snapshot();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (draft.comments.length === 0 && !result) return null;

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
    <div className="review-submit-bar">
      <div>
        <strong>{draft.comments.length} comment{draft.comments.length === 1 ? "" : "s"}</strong> pending
      </div>
      <select
        value={draft.event}
        onChange={(e) => reviewDraftStore.setEvent(e.target.value as any)}
        disabled={submitting}
      >
        <option value="COMMENT">Comment</option>
        <option value="APPROVE">Approve</option>
        <option value="REQUEST_CHANGES">Request changes</option>
      </select>
      <button className="btn-primary" disabled={submitting} onClick={submit}>
        {submitting ? "Submitting…" : "Submit review"}
      </button>
      {result && <a href={result.url} target="_blank" rel="noreferrer">View on GitHub →</a>}
      {error && <span className="error-bar">{error}</span>}
    </div>
  );
}
