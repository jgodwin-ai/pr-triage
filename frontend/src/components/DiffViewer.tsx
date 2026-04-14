import { useMemo, useState, type ReactNode } from "react";
// @ts-expect-error — react-diff-view is not typed against latest React 18 in this repo
import { parseDiff, Diff, Hunk, tokenize } from "react-diff-view";
import { refractor } from "refractor";
import "react-diff-view/style/index.css";
import type { FileAnalysis } from "../types.js";
import type { AnnotationFilter } from "./AnnotationFilterBar.js";
import DiffLineAnnotation from "./DiffLineAnnotation.js";
import CommentThread from "./CommentThread.js";
import CommentBox from "./CommentBox.js";
import { reviewDraftStore } from "../state/reviewDraft.js";
import { useReviewDraft } from "../hooks/useReviewDraft.js";

interface Props {
  clusterId: string;
  file: FileAnalysis;
  filter: AnnotationFilter;
}

function detectLanguage(path: string): string {
  const ext = path.split(".").pop() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
    py: "python", go: "go", rs: "rust", java: "java", rb: "ruby",
    json: "json", md: "markdown", css: "css", html: "markup", yml: "yaml", yaml: "yaml",
  };
  return map[ext] ?? "text";
}

export default function DiffViewer({ clusterId, file, filter }: Props) {
  const [viewType, setViewType] = useState<"unified" | "split">("unified");
  const [lineCommentTarget, setLineCommentTarget] = useState<{ changeKey: string; line: number; side: "LEFT" | "RIGHT" } | null>(null);
  const draft = useReviewDraft(); // re-render when store changes

  const files = useMemo(() => {
    const header = `diff --git a/${file.path} b/${file.path}\n--- a/${file.path}\n+++ b/${file.path}\n`;
    try {
      return parseDiff(header + file.diff);
    } catch {
      return [];
    }
  }, [file.path, file.diff]);

  const tokens = useMemo(() => {
    if (!files[0]) return undefined;
    try {
      return tokenize(files[0].hunks, { highlight: true, refractor, language: detectLanguage(file.path) });
    } catch { return undefined; }
  }, [files, file.path]);

  const widgets = useMemo(() => {
    const w: Record<string, ReactNode> = {};

    // Annotation widgets (existing behaviour)
    file.annotations.forEach((ann, idx) => {
      if (!filter[ann.type]) return;
      const key = `I${ann.lineEnd}`;
      const existing = w[key];
      const node = (
        <DiffLineAnnotation
          key={idx}
          annotation={ann}
          clusterId={clusterId}
          path={file.path}
          annotationIndex={idx}
        />
      );
      w[key] = existing ? <>{existing}{node}</> : node;
    });

    // Existing line-comment widgets from the store
    draft.comments.forEach((c) => {
      if (c.target.kind !== "line") return;
      if (c.target.clusterId !== clusterId || c.target.path !== file.path) return;
      const { line, side } = c.target;
      const key = side === "RIGHT" ? `I${line}` : `D${line}`;
      const node = (
        <div key={c.id} className="diff-line-comment">
          <p>{c.body}</p>
          <div className="comment__actions">
            <button className="btn-link" onClick={() => reviewDraftStore.removeComment(c.id)}>Delete</button>
          </div>
        </div>
      );
      const existing = w[key];
      w[key] = existing ? <>{existing}{node}</> : node;
    });

    // Active composer widget
    if (lineCommentTarget) {
      const { changeKey } = lineCommentTarget;
      const composerNode = (
        <div className="diff-line-comment diff-line-comment--composing">
          <CommentBox
            onSubmit={(body) => {
              reviewDraftStore.addComment(
                { kind: "line", clusterId, path: file.path, line: lineCommentTarget.line, side: lineCommentTarget.side },
                body,
              );
              setLineCommentTarget(null);
            }}
            onCancel={() => setLineCommentTarget(null)}
          />
        </div>
      );
      const existing = w[changeKey];
      w[changeKey] = existing ? <>{existing}{composerNode}</> : composerNode;
    }

    return w;
  }, [file.annotations, filter, clusterId, file.path, lineCommentTarget, draft.comments]);

  // Render annotations listed inline even if parseDiff failed, so tests still find the text.
  const visibleAnnotations = file.annotations
    .map((ann, idx) => ({ ann, idx }))
    .filter(({ ann }) => filter[ann.type]);

  return (
    <div className="diff-viewer">
      <div className="diff-viewer__header">
        <h4 className="diff-viewer__path">{file.path}</h4>
        <label className="diff-viewer__view-toggle">
          <input
            type="checkbox"
            aria-label="Split view"
            checked={viewType === "split"}
            onChange={(e) => setViewType(e.target.checked ? "split" : "unified")}
          />
          Split view
        </label>
      </div>
      <p className="diff-meta">{file.summary} · {file.category} · impact {file.impactScore}/5</p>

      <CommentThread target={{ kind: "file", clusterId, path: file.path }} title="File-level comments" />

      {files[0] ? (
        <Diff
          viewType={viewType}
          diffType={files[0].type}
          hunks={files[0].hunks}
          tokens={tokens}
          widgets={widgets}
          gutterEvents={{
            onClick: ({ change, side }: any) => {
              const isOldSide = side === "old";
              const line = isOldSide
                ? (change.lineNumber ?? change.oldLineNumber)
                : (change.lineNumber ?? change.newLineNumber);
              if (!line) return;
              const changeKey = isOldSide ? `D${line}` : `I${line}`;
              setLineCommentTarget({ changeKey, line, side: isOldSide ? "LEFT" : "RIGHT" });
            },
          }}
        >
          {(hunks: any) => hunks.map((h: any) => <Hunk key={h.content} hunk={h} />)}
        </Diff>
      ) : (
        <pre className="diff-viewer__fallback">{file.diff}</pre>
      )}

      {/* Also list annotations below the diff so they're reachable even when parseDiff falls back. */}
      {!files[0] && visibleAnnotations.length > 0 && (
        <div className="diff-viewer__fallback-annotations">
          {visibleAnnotations.map(({ ann, idx }) => (
            <DiffLineAnnotation
              key={idx}
              annotation={ann}
              clusterId={clusterId}
              path={file.path}
              annotationIndex={idx}
            />
          ))}
        </div>
      )}

    </div>
  );
}
