import { useState } from "react";
import type { PRAnalysis, ChangeCluster } from "../types.js";
import Breadcrumbs from "./Breadcrumbs.js";
import ExecutiveSummary from "./ExecutiveSummary.js";
import ClusterList from "./ClusterList.js";
import ClusterDetail from "./ClusterDetail.js";

interface Crumb {
  label: string;
  onClick?: () => void;
}

interface Props {
  analysis: PRAnalysis;
  onBack: () => void;
}

export default function AnalysisView({ analysis, onBack }: Props) {
  const [selectedCluster, setSelectedCluster] = useState<ChangeCluster | null>(null);

  const crumbs: Crumb[] = [
    { label: "New Analysis", onClick: onBack },
    {
      label: "PR Summary",
      onClick: selectedCluster ? () => setSelectedCluster(null) : undefined,
    },
  ];

  if (selectedCluster) {
    crumbs.push({ label: selectedCluster.name });
  }

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: "0 20px" }}>
      <Breadcrumbs crumbs={crumbs} />
      <ExecutiveSummary analysis={analysis} />

      {selectedCluster ? (
        <ClusterDetail cluster={selectedCluster} />
      ) : (
        <ClusterList
          clusters={analysis.clusters}
          onSelectCluster={setSelectedCluster}
        />
      )}
    </div>
  );
}
