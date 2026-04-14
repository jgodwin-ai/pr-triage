import { useEffect } from "react";
import type { PRAnalysis } from "../types.js";
import ExecutiveSummary from "./ExecutiveSummary.js";
import AnalysisSidebar from "./AnalysisSidebar.js";
import FileView from "./FileView.js";
import ReviewSubmitBar from "./ReviewSubmitBar.js";
import { reviewDraftStore } from "../state/reviewDraft.js";
import { viewedStore } from "../state/viewedStore.js";

interface Props { analysis: PRAnalysis; onBack: () => void; }

export default function AnalysisView({ analysis, onBack }: Props) {
  useEffect(() => {
    reviewDraftStore.loadFor(analysis.pr.url, analysis.pr.headSha);
    viewedStore.loadFor(analysis.pr.url, analysis.pr.headSha);
  }, [analysis.pr.url, analysis.pr.headSha]);

  return (
    <div className="analysis-shell">
      <AnalysisSidebar clusters={analysis.clusters} />
      <main className="analysis-main">
        <button className="btn-link" style={{ paddingTop: "8px" }} onClick={onBack}>← Analyze another PR</button>
        <ExecutiveSummary analysis={analysis} />
        {analysis.clusters.map((cluster) =>
          cluster.files.map((file) => (
            <FileView
              key={`${cluster.id}:${file.path}`}
              cluster={cluster}
              file={file}
            />
          ))
        )}
        <ReviewSubmitBar prUrl={analysis.pr.url} />
      </main>
    </div>
  );
}
