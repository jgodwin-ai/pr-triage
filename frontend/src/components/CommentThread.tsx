import { useState } from "react";
import type { CommentTarget } from "../types.js";
import { reviewDraftStore } from "../state/reviewDraft.js";
import { useReviewDraft } from "../hooks/useReviewDraft.js";
import CommentBox from "./CommentBox.js";

interface Props {
  target: CommentTarget;
  title?: string;
}

export default function CommentThread({ target, title }: Props) {
  useReviewDraft(); // re-render on store change
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const comments = reviewDraftStore.getComments(target);

  return (
    <div className="comment-thread">
      {title && <div className="comment-thread__title">{title}</div>}
      {comments.map((c) => (
        <div key={c.id} className="comment">
          {editingId === c.id ? (
            <CommentBox
              initialValue={c.body}
              submitLabel="Save"
              onSubmit={(body) => { reviewDraftStore.updateComment(c.id, body); setEditingId(null); }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <>
              <p>{c.body}</p>
              <div className="comment__actions">
                <button className="btn-link" onClick={() => setEditingId(c.id)}>Edit</button>
                <button className="btn-link" onClick={() => reviewDraftStore.removeComment(c.id)}>Delete</button>
              </div>
            </>
          )}
        </div>
      ))}
      {adding ? (
        <CommentBox
          onSubmit={(body) => { reviewDraftStore.addComment(target, body); setAdding(false); }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button className="btn-link" onClick={() => setAdding(true)}>+ Add comment</button>
      )}
    </div>
  );
}
