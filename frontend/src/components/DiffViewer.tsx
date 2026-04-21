import { useMemo, useState, type ReactNode } from "react";
import { parseDiff, Diff, Hunk, tokenize } from "react-diff-view";
import { refractor } from "refractor";
import jsxLang from "refractor/jsx";
import tsxLang from "refractor/tsx";
import "react-diff-view/style/index.css";
import "prismjs/themes/prism.css";

refractor.register(jsxLang);
refractor.register(tsxLang);

// react-diff-view v3 expects refractor.highlight() to return an array of children
// (old refractor API). v5 returns a `{type:'root', children:[]}` node — shim it.
const refractorShim = {
  highlight: (text: string, lang: string) => {
    const root = refractor.highlight(text, lang) as any;
    return root?.children ?? [];
  },
};
import type { FileAnalysis } from "../types.js";
import type { AnnotationFilter } from "./AnnotationFilterBar.js";
import { renderEmoji } from "../utils/emoji.js";
import DiffLineAnnotation from "./DiffLineAnnotation.js";
import CommentThread from "./CommentThread.js";
import CommentBox from "./CommentBox.js";
import { reviewDraftStore } from "../state/reviewDraft.js";
import { useReviewDraft } from "../hooks/useReviewDraft.js";

interface Props {
  clusterId: string;
  file: FileAnalysis;
  filter: AnnotationFilter;
  viewType: "unified" | "split";
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

export default function DiffViewer({ clusterId, file, filter, viewType }: Props) {
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
      return tokenize(files[0].hunks, { highlight: true, refractor: refractorShim, language: detectLanguage(file.path) });
    } catch { return undefined; }
  }, [files, file.path]);

  // Partition annotations into ones whose line numbers fall inside a hunk's
  // new-file range (renderable as widgets) vs out-of-range / reversed ones
  // (rendered as a fallback list below the diff). The LLM occasionally emits
  // line numbers past the end of the file or with lineStart > lineEnd.
  const { inRangeAnnotations, outOfRangeAnnotations } = useMemo(() => {
    const inRange: Array<{ ann: (typeof file.annotations)[number]; idx: number }> = [];
    const outOfRange: Array<{ ann: (typeof file.annotations)[number]; idx: number }> = [];
    const hunks = files[0]?.hunks ?? [];
    const checkLine = (line: number): boolean => {
      for (const h of hunks) {
        const max = h.newStart + h.newLines - 1;
        if (line >= h.newStart && line <= max) return true;
      }
      return false;
    };
    file.annotations.forEach((ann, idx) => {
      const lo = Math.min(ann.lineStart, ann.lineEnd);
      const hi = Math.max(ann.lineStart, ann.lineEnd);
      const valid = hunks.length > 0 && lo > 0 && checkLine(hi);
      (valid ? inRange : outOfRange).push({ ann, idx });
    });
    return { inRangeAnnotations: inRange, outOfRangeAnnotations: outOfRange };
  }, [file.annotations, files]);

  const widgets = useMemo(() => {
    const w: Record<string, ReactNode> = {};

    // Annotation widgets (only for in-range annotations)
    inRangeAnnotations.forEach(({ ann, idx }) => {
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
      const anchorId = `line-${clusterId}-${encodeURIComponent(file.path)}-${side}-${line}`;
      const node = (
        <div key={c.id} id={anchorId} className="diff-line-comment">
          <p>{renderEmoji(c.body)}</p>
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
  }, [inRangeAnnotations, filter, clusterId, file.path, lineCommentTarget, draft.comments]);

  // When parseDiff fails entirely, fall back to rendering every filtered annotation below the raw patch.
  const parseDiffFailed = !files[0] || !files[0].hunks?.length;
  const fallbackAnnotations = parseDiffFailed
    ? file.annotations.map((ann, idx) => ({ ann, idx })).filter(({ ann }) => filter[ann.type])
    : outOfRangeAnnotations.filter(({ ann }) => filter[ann.type]);

  return (
    <div className="diff-viewer">
      <CommentThread target={{ kind: "file", clusterId, path: file.path }} title="File-level comments" />

      {files[0] && files[0].hunks && files[0].hunks.length > 0 ? (
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

      {fallbackAnnotations.length > 0 && (
        <div className="diff-viewer__fallback-annotations">
          {!parseDiffFailed && (
            <div className="diff-viewer__fallback-heading">
              General comments (line numbers outside the diff)
            </div>
          )}
          {fallbackAnnotations.map(({ ann, idx }) => (
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
