import { useEffect } from "react";
import type { PRAnalysis } from "../types.js";
import ExecutiveSummary from "./ExecutiveSummary.js";
import AnalysisSidebar from "./AnalysisSidebar.js";
import FileView from "./FileView.js";
import ReviewSubmitBar from "./ReviewSubmitBar.js";
import AnnotationFilterBar from "./AnnotationFilterBar.js";
import RightRail from "./RightRail.js";
import { reviewDraftStore } from "../state/reviewDraft.js";
import { viewedStore } from "../state/viewedStore.js";
import { annotationFilterStore } from "../state/annotationFilterStore.js";
import { activeClusterStore } from "../state/activeClusterStore.js";
import { activeFileStore } from "../state/activeFileStore.js";
import { useAnnotationFilter } from "../hooks/useAnnotationFilter.js";
import { useActiveCluster } from "../hooks/useActiveCluster.js";

interface Props { analysis: PRAnalysis; onBack: () => void; }

export default function AnalysisView({ analysis, onBack }: Props) {
  const filter = useAnnotationFilter();
  const activeClusterId = useActiveCluster();

  useEffect(() => {
    reviewDraftStore.loadFor(analysis.pr.url, analysis.pr.headSha);
    viewedStore.loadFor(analysis.pr.url, analysis.pr.headSha);
  }, [analysis.pr.url, analysis.pr.headSha]);

  // Set default active cluster when analysis mounts or changes
  useEffect(() => {
    const firstId = analysis.clusters[0]?.id ?? null;
    activeClusterStore.set(firstId);
    // Also reset active file to first file of first cluster
    const firstFile = analysis.clusters[0]?.files[0];
    if (firstId && firstFile) {
      activeFileStore.set({ activeClusterId: firstId, activeFilePath: firstFile.path });
    } else {
      activeFileStore.set({ activeClusterId: null, activeFilePath: null });
    }
  }, [analysis]);

  const activeCluster =
    analysis.clusters.find((c) => c.id === activeClusterId) ?? analysis.clusters[0];

  return (
    <div className="analysis-shell">
      <AnalysisSidebar clusters={analysis.clusters} />
      <main className="analysis-main">
        <button className="btn-link" style={{ paddingTop: "8px" }} onClick={onBack}>← Analyze another PR</button>
        <ExecutiveSummary analysis={analysis} />
        <div className="analysis-main__filter-bar">
          <AnnotationFilterBar
            value={filter}
            onChange={(next) => annotationFilterStore.set(next)}
          />
        </div>
        {activeCluster?.files.map((file) => (
          <FileView
            key={`${activeCluster.id}:${file.path}`}
            cluster={activeCluster}
            file={file}
          />
        ))}
        <ReviewSubmitBar prUrl={analysis.pr.url} />
      </main>
      <RightRail analysis={analysis} />
    </div>
  );
}
