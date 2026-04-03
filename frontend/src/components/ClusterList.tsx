import type { ChangeCluster } from "../types.js";

interface Props {
  clusters: ChangeCluster[];
  onSelectCluster: (cluster: ChangeCluster) => void;
}

const TAG_COLORS: Record<string, string> = {
  "needs-review": "#cc3300",
  "low-risk": "#339900",
  boilerplate: "#999",
  "style-only": "#666",
};

export default function ClusterList({ clusters, onSelectCluster }: Props) {
  return (
    <div>
      <h3>Change Clusters</h3>
      {clusters.map((cluster) => (
        <div
          key={cluster.id}
          role="button"
          tabIndex={0}
          onClick={() => onSelectCluster(cluster)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelectCluster(cluster);
            }
          }}
          style={{
            border: "1px solid #ddd",
            borderRadius: 4,
            padding: 12,
            marginBottom: 8,
            cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>{cluster.name}</strong>
            <span
              style={{
                fontSize: 12,
                padding: "2px 8px",
                borderRadius: 4,
                color: "white",
                background: TAG_COLORS[cluster.tag] ?? "#999",
              }}
            >
              {cluster.tag}
            </span>
          </div>
          <p style={{ fontSize: 14, color: "#666", margin: "4px 0 0" }}>
            {cluster.summary}
          </p>
          <p style={{ fontSize: 12, color: "#999", margin: "4px 0 0" }}>
            {cluster.files.length} file(s) · priority {cluster.priority}
          </p>
        </div>
      ))}
    </div>
  );
}
