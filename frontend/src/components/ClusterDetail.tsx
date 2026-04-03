import type { ChangeCluster } from "../types.js";
import DiffView from "./DiffView.js";

interface Props {
  cluster: ChangeCluster;
}

export default function ClusterDetail({ cluster }: Props) {
  return (
    <div className="cluster-detail">
      <h3>{cluster.name}</h3>
      <p>{cluster.summary}</p>
      <p className="detail-meta">
        {cluster.files.length} file(s) · priority {cluster.priority}
      </p>

      {cluster.files.map((file) => (
        <div key={file.path} className="file-separator">
          <DiffView file={file} />
        </div>
      ))}
    </div>
  );
}
