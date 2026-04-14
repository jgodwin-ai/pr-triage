import { useState } from "react";
import { reviewDraftStore } from "../state/reviewDraft.js";
import { useReviewDraft } from "../hooks/useReviewDraft.js";

interface Props { prUrl: string; }

const events = [
  { value: "COMMENT", label: "Comment", desc: "Submit general feedback without explicit approval." },
  { value: "APPROVE", label: "Approve", desc: "Submit feedback and approve merging these changes." },
  { value: "REQUEST_CHANGES", label: "Request changes", desc: "Submit feedback that must be addressed before merging." },
] as const;

type EventValue = typeof events[number]["value"];

function eventClass(ev: EventValue): string {
  if (ev === "COMMENT") return "comment";
  if (ev === "APPROVE") return "approve";
  return "request-changes";
}

function submitLabel(ev: EventValue): string {
  if (ev === "APPROVE") return "Approve review";
  if (ev === "REQUEST_CHANGES") return "Request changes";
  return "Submit review";
}

export default function ReviewSubmitBar({ prUrl }: Props) {
  const draft = useReviewDraft();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const staleCount = draft.comments.filter((c) => c.stale).length;

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
      <h3 className="review-form__heading">Finish your review</h3>
      <textarea
        className="review-form__summary"
        placeholder="Leave a comment"
        value={draft.summary}
        onChange={(e) => reviewDraftStore.setSummary(e.target.value)}
        disabled={submitting}
      />
      {staleCount > 0 && (
        <div className="review-form__stale">
          {staleCount} comment{staleCount === 1 ? "" : "s"} from an earlier commit — review before submitting.
        </div>
      )}
      <div className="review-form__pending">
        {draft.comments.length} comment{draft.comments.length === 1 ? "" : "s"} pending
      </div>
      <div className="review-form__radios" role="radiogroup" aria-label="Review type">
        {events.map((e) => (
          <label key={e.value} className={`review-form__radio ${draft.event === e.value ? "is-active" : ""}`}>
            <input
              className="review-form__radio-input"
              type="radio"
              name="review-event"
              value={e.value}
              checked={draft.event === e.value}
              onChange={() => reviewDraftStore.setEvent(e.value)}
              disabled={submitting}
            />
            <span>
              <span className="review-form__radio-label">{e.label}</span>
              <div className="review-form__radio-desc">{e.desc}</div>
            </span>
          </label>
        ))}
      </div>
      <button
        className={`review-form__submit review-form__submit--${eventClass(draft.event)}`}
        disabled={submitting}
        onClick={submit}
      >
        {submitting ? "Submitting…" : submitLabel(draft.event)}
      </button>
      {result && (
        <div className="review-form__result">
          <a href={result.url} target="_blank" rel="noreferrer">View on GitHub →</a>
        </div>
      )}
      {error && <div className="error-bar">{error}</div>}
    </div>
  );
}
