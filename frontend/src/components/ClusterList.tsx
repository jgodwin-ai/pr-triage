import type { ChangeCluster } from "../types.js";

interface Props {
  clusters: ChangeCluster[];
  onSelectCluster: (cluster: ChangeCluster) => void;
}

export default function ClusterList({ clusters, onSelectCluster }: Props) {
  return (
    <div className="cluster-list">
      <h3>Change Clusters</h3>
      {clusters.map((cluster) => (
        <div
          key={cluster.id}
          className="cluster-card"
          role="button"
          tabIndex={0}
          onClick={() => onSelectCluster(cluster)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelectCluster(cluster);
            }
          }}
        >
          <div className="cluster-header">
            <strong>{cluster.name}</strong>
            <span className={`tag tag--${cluster.tag}`}>{cluster.tag}</span>
          </div>
          <p className="cluster-summary">{cluster.summary}</p>
          <p className="cluster-meta">
            {cluster.files.length} file(s) · priority {cluster.priority}
          </p>
        </div>
      ))}
    </div>
  );
}
