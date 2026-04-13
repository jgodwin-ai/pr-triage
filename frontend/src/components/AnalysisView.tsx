import type { PRAnalysis } from "../types.js";
import ExecutiveSummary from "./ExecutiveSummary.js";
import ClusterAccordion from "./ClusterAccordion.js";

interface Props {
  analysis: PRAnalysis;
  onBack: () => void;
}

export default function AnalysisView({ analysis, onBack }: Props) {
  return (
    <div className="analysis-container">
      <button className="btn-link" onClick={onBack}>
        ← Analyze another PR
      </button>
      <ExecutiveSummary analysis={analysis} />
      <ClusterAccordion clusters={analysis.clusters} />
    </div>
  );
}
