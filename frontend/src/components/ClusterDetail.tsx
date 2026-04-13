import type { ChangeCluster } from "../types.js";
import DiffViewer from "./DiffViewer.js";

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
          <DiffViewer
            clusterId={"tmp"}
            file={file}
            filter={{ warning: true, info: true, suggestion: true }}
          />
        </div>
      ))}
    </div>
  );
}
