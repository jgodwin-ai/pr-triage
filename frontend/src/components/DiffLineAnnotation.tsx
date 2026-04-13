import type { FileAnalysis } from "../types.js";
import CommentThread from "./CommentThread.js";

type FileAnnotation = FileAnalysis["annotations"][number];

interface Props {
  annotation: FileAnnotation;
  clusterId: string;
  path: string;
  annotationIndex: number;
}

export default function DiffLineAnnotation({ annotation, clusterId, path, annotationIndex }: Props) {
  return (
    <div className={`diff-annotation diff-annotation--${annotation.type}`}>
      <div className="diff-annotation__header">
        <span className={`annotation-type annotation-type--${annotation.type}`}>{annotation.type}</span>
        <span>L{annotation.lineStart}{annotation.lineEnd !== annotation.lineStart ? `-${annotation.lineEnd}` : ""}</span>
      </div>
      <p className="diff-annotation__message">{annotation.message}</p>
      <CommentThread target={{ kind: "annotation", clusterId, path, annotationIndex }} />
    </div>
  );
}
