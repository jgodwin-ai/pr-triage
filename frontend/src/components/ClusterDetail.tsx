import type { ChangeCluster } from "../types.js";
import DiffView from "./DiffView.js";

interface Props {
  cluster: ChangeCluster;
}

export default function ClusterDetail({ cluster }: Props) {
  return (
    <div>
      <h3>{cluster.name}</h3>
      <p>{cluster.summary}</p>
      <p style={{ fontSize: 14, color: "#666" }}>
        {cluster.files.length} file(s) · priority {cluster.priority}
      </p>

      {cluster.files.map((file) => (
        <div key={file.path} style={{ marginTop: 16, borderTop: "1px solid #eee", paddingTop: 16 }}>
          <DiffView file={file} />
        </div>
      ))}
    </div>
  );
}
