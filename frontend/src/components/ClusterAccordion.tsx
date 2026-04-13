import { useState } from "react";
import type { ChangeCluster } from "../types.js";
import CommentThread from "./CommentThread.js";
import DiffViewer from "./DiffViewer.js";
import AnnotationFilterBar, { type AnnotationFilter } from "./AnnotationFilterBar.js";

interface Props {
  clusters: ChangeCluster[];
}

export default function ClusterAccordion({ clusters }: Props) {
  const [openId, setOpenId] = useState<string | null>(clusters[0]?.id ?? null);
  const [filter, setFilter] = useState<AnnotationFilter>({
    warning: true,
    info: true,
    suggestion: true,
  });

  return (
    <div className="cluster-accordion">
      {clusters.map((cluster) => {
        const open = openId === cluster.id;
        return (
          <section
            key={cluster.id}
            className={`cluster-accordion__item ${open ? "is-open" : ""}`}
          >
            <header
              className="cluster-accordion__header"
              role="button"
              tabIndex={0}
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : cluster.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpenId(open ? null : cluster.id);
                }
              }}
            >
              {cluster.tag && (
                <span className={`tag tag--${cluster.tag}`}>{cluster.tag}</span>
              )}
              <strong>{cluster.name}</strong>
              <span className="cluster-accordion__count">
                {cluster.files.length} file{cluster.files.length === 1 ? "" : "s"}
              </span>
            </header>
            {open && (
              <div className="cluster-accordion__body">
                <p className="cluster-summary">{cluster.summary}</p>
                <CommentThread
                  target={{ kind: "cluster", clusterId: cluster.id }}
                  title="Comments on this cluster"
                />
                <AnnotationFilterBar value={filter} onChange={setFilter} />
                {cluster.files.map((file) => (
                  <DiffViewer
                    key={file.path}
                    clusterId={cluster.id}
                    file={file}
                    filter={filter}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
