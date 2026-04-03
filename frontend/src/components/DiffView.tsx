import type { FileAnalysis } from "../types.js";

interface Props {
  file: FileAnalysis;
}

export default function DiffView({ file }: Props) {
  const lines = file.diff.split("\n");

  return (
    <div>
      <h4>{file.path}</h4>
      <p style={{ fontSize: 14, color: "#666" }}>
        {file.summary} · {file.category} · impact: {file.impactScore}/5
      </p>

      {file.annotations.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <strong>Annotations:</strong>
          <ul>
            {file.annotations.map((ann, i) => (
              <li key={i} style={{ fontSize: 14 }}>
                <span
                  style={{
                    color:
                      ann.type === "warning"
                        ? "#cc6600"
                        : ann.type === "suggestion"
                          ? "#0066cc"
                          : "#666",
                  }}
                >
                  [{ann.type}]
                </span>{" "}
                L{ann.lineStart}-{ann.lineEnd}: {ann.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <pre
        style={{
          background: "#f6f8fa",
          padding: 12,
          borderRadius: 4,
          overflow: "auto",
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        {lines.map((line, i) => {
          let bg = "transparent";
          if (line.startsWith("+")) bg = "#e6ffec";
          else if (line.startsWith("-")) bg = "#ffebe9";
          return (
            <div key={i} style={{ background: bg }}>
              {line}
            </div>
          );
        })}
      </pre>
    </div>
  );
}
