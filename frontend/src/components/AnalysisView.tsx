import { useEffect } from "react";
import type { PRAnalysis } from "../types.js";
import ExecutiveSummary from "./ExecutiveSummary.js";
import ClusterAccordion from "./ClusterAccordion.js";
import ReviewSubmitBar from "./ReviewSubmitBar.js";
import ScrollHint from "./ScrollHint.js";
import { reviewDraftStore } from "../state/reviewDraft.js";

interface Props {
  analysis: PRAnalysis;
  onBack: () => void;
}

export default function AnalysisView({ analysis, onBack }: Props) {
  useEffect(() => {
    reviewDraftStore.loadFor(analysis.pr.url, analysis.pr.headSha);
  }, [analysis.pr.url, analysis.pr.headSha]);

  return (
    <div className="analysis-container">
      <button className="btn-link" onClick={onBack}>
        ← Analyze another PR
      </button>
      <ExecutiveSummary analysis={analysis} />
      <ClusterAccordion clusters={analysis.clusters} />
      <ReviewSubmitBar prUrl={analysis.pr.url} />
      <ScrollHint />
    </div>
  );
}
