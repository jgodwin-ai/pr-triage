import type { FileAnalysis } from "../types.js";

interface Props {
  file: FileAnalysis;
}

export default function DiffView({ file }: Props) {
  const lines = file.diff.split("\n");

  return (
    <div className="diff-view">
      <h4>{file.path}</h4>
      <p className="diff-meta">
        {file.summary} · {file.category}
        <span className="impact">{file.impactScore}/5</span>
      </p>

      {file.annotations.length > 0 && (
        <div className="annotations">
          <strong>Annotations</strong>
          <ul>
            {file.annotations.map((ann, i) => (
              <li key={i}>
                <span className={`annotation-type annotation-type--${ann.type}`}>
                  {ann.type}
                </span>
                L{ann.lineStart}-{ann.lineEnd}: {ann.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="diff-code">
        {lines.map((line, i) => {
          let cls = "diff-line";
          if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@")) {
            // header — no special color
          } else if (line.startsWith("+")) {
            cls += " diff-line--added";
          } else if (line.startsWith("-")) {
            cls += " diff-line--removed";
          }
          return (
            <div key={i} className={cls}>
              {line}
            </div>
          );
        })}
      </div>
    </div>
  );
}
