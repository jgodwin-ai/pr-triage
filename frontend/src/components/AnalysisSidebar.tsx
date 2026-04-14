import { useState } from "react";
import type { ChangeCluster } from "../types.js";
import { viewedStore } from "../state/viewedStore.js";
import { useViewed } from "../hooks/useViewed.js";
import { useReviewDraft } from "../hooks/useReviewDraft.js";

interface Props {
  clusters: ChangeCluster[];
}

export default function AnalysisSidebar({ clusters }: Props) {
  useViewed(); // subscribe to viewed store for re-renders
  const draft = useReviewDraft();
  const [collapsedClusters, setCollapsedClusters] = useState<Set<string>>(new Set());

  const toggleCluster = (clusterId: string) => {
    setCollapsedClusters((prev) => {
      const next = new Set(prev);
      if (next.has(clusterId)) {
        next.delete(clusterId);
      } else {
        next.add(clusterId);
      }
      return next;
    });
  };

  const totalFiles = clusters.reduce((sum, c) => sum + c.files.length, 0);
  const totalViewed = clusters.reduce(
    (sum, c) => sum + c.files.filter((f) => viewedStore.isViewed(c.id, f.path)).length,
    0,
  );

  return (
    <aside className="analysis-sidebar">
      <div className="analysis-sidebar__header">
        <div className="analysis-sidebar__title">Files</div>
        <div className="analysis-sidebar__meta">
          {totalViewed}/{totalFiles} viewed
        </div>
      </div>

      {clusters.map((cluster) => {
        const isCollapsed = collapsedClusters.has(cluster.id);
        const viewedCount = cluster.files.filter((f) =>
          viewedStore.isViewed(cluster.id, f.path)
        ).length;
        const totalCount = cluster.files.length;
        const allViewed = viewedCount === totalCount && totalCount > 0;

        return (
          <div key={cluster.id} className="sidebar-cluster">
            <div
              className="sidebar-cluster__header"
              role="button"
              tabIndex={0}
              onClick={() => toggleCluster(cluster.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleCluster(cluster.id);
                }
              }}
            >
              <span className={`tag tag--${cluster.tag}`}>{cluster.tag}</span>
              <span className="sidebar-cluster__name">{cluster.name}</span>
              <span className={`sidebar-cluster__count${allViewed ? " is-done" : ""}`}>
                {allViewed ? "✓ " : ""}{viewedCount}/{totalCount}
              </span>
              <span>{isCollapsed ? "▸" : "▾"}</span>
            </div>

            {!isCollapsed && cluster.files.map((file) => {
              const viewed = viewedStore.isViewed(cluster.id, file.path);
              const annotationCount = file.annotations.length;

              // Count comments for this file+cluster from the draft
              const commentCount = draft.comments.filter((c) => {
                const t = c.target;
                if (t.kind === "cluster") return false;
                return t.clusterId === cluster.id && t.path === file.path;
              }).length;

              const anchor = `#file-${cluster.id}-${encodeURIComponent(file.path)}`;

              const handleClick = () => {
                const el = document.getElementById(
                  `file-${cluster.id}-${encodeURIComponent(file.path)}`
                );
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              };

              const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                e.stopPropagation();
                if (e.target.checked) {
                  viewedStore.markViewed(cluster.id, file.path);
                } else {
                  viewedStore.unmarkViewed(cluster.id, file.path);
                }
              };

              return (
                <a
                  key={file.path}
                  href={anchor}
                  className={`sidebar-file${viewed ? " is-viewed" : ""}`}
                  onClick={(e) => { e.preventDefault(); handleClick(); }}
                >
                  <input
                    type="checkbox"
                    className="sidebar-file__check"
                    checked={viewed}
                    aria-label={`Mark ${file.path} as viewed`}
                    onChange={handleCheckboxChange}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="sidebar-file__path" title={file.path}>
                    {file.path}
                  </span>
                  <span className="sidebar-file__badges">
                    {annotationCount > 0 && (
                      <span className="sidebar-file__badge sidebar-file__badge--warn">
                        ⚠ {annotationCount}
                      </span>
                    )}
                    {commentCount > 0 && (
                      <span className="sidebar-file__badge sidebar-file__badge--comment">
                        💬 {commentCount}
                      </span>
                    )}
                  </span>
                </a>
              );
            })}
          </div>
        );
      })}
    </aside>
  );
}
