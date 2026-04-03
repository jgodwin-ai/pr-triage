import type { PRAnalysis } from "../types.js";

interface Props {
  analysis: PRAnalysis;
}

export default function ExecutiveSummary({ analysis }: Props) {
  const { pr, executiveSummary, timeSaved } = analysis;

  return (
    <div className="executive-summary">
      <h2>{pr.title}</h2>
      <div className="pr-meta">
        <span>by {pr.author}</span>
        <span>·</span>
        <span>{pr.baseBranch} ← {pr.headBranch}</span>
        <span>·</span>
        <span className="additions">+{pr.additions}</span>
        <span className="deletions">-{pr.deletions}</span>
        <span>across {pr.fileCount} files</span>
      </div>
      <p className="summary-text">{executiveSummary}</p>
      {timeSaved && (
        <span className="time-saved">Estimated time saved: {timeSaved}</span>
      )}
    </div>
  );
}
