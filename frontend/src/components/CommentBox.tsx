import { useState } from "react";

interface Props {
  onSubmit: (body: string) => void;
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  onCancel?: () => void;
}

export default function CommentBox({
  onSubmit,
  placeholder = "Leave a comment…",
  initialValue = "",
  submitLabel = "Add comment",
  onCancel,
}: Props) {
  const [body, setBody] = useState(initialValue);
  const submit = () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setBody("");
  };
  return (
    <div className="comment-box">
      <textarea
        className="comment-box__input"
        value={body}
        placeholder={placeholder}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
      />
      <div className="comment-box__actions">
        {onCancel && <button type="button" className="btn-link" onClick={onCancel}>Cancel</button>}
        <button type="button" className="btn-primary" onClick={submit}>{submitLabel}</button>
      </div>
    </div>
  );
}
