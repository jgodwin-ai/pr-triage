import type { PRAnalysis } from "../types.js";

interface Props {
  analysis: PRAnalysis;
}

export default function ExecutiveSummary({ analysis }: Props) {
  const { pr, executiveSummary, timeSaved } = analysis;

  return (
    <div style={{ marginBottom: 24 }}>
      <h2>{pr.title}</h2>
      <p style={{ color: "#666", fontSize: 14 }}>
        by {pr.author} · {pr.baseBranch} ← {pr.headBranch} ·{" "}
        <span style={{ color: "green" }}>+{pr.additions}</span>{" "}
        <span style={{ color: "red" }}>-{pr.deletions}</span> across {pr.fileCount} files
      </p>
      <p>{executiveSummary}</p>
      {timeSaved && (
        <p style={{ fontSize: 14, color: "#666" }}>
          Estimated time saved: {timeSaved}
        </p>
      )}
    </div>
  );
}
