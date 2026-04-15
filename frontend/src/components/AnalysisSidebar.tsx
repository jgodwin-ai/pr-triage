import type { ChangeCluster } from "../types.js";
import { viewedStore } from "../state/viewedStore.js";
import { activeClusterStore } from "../state/activeClusterStore.js";
import { useViewed } from "../hooks/useViewed.js";
import { useActiveCluster } from "../hooks/useActiveCluster.js";

interface Props {
  clusters: ChangeCluster[];
}

export default function AnalysisSidebar({ clusters }: Props) {
  useViewed(); // subscribe to viewed store for re-renders
  const activeClusterId = useActiveCluster();

  const totalFiles = clusters.reduce((sum, c) => sum + c.files.length, 0);
  const totalViewed = clusters.reduce(
    (sum, c) => sum + c.files.filter((f) => viewedStore.isViewed(c.id, f.path)).length,
    0,
  );

  return (
    <aside className="analysis-sidebar">
      <div className="analysis-sidebar__header">
        <div className="analysis-sidebar__title">Clusters</div>
        <div className="analysis-sidebar__meta">
          {totalViewed}/{totalFiles} viewed
        </div>
      </div>

      {clusters.map((cluster) => {
        const viewedCount = cluster.files.filter((f) =>
          viewedStore.isViewed(cluster.id, f.path)
        ).length;
        const totalCount = cluster.files.length;
        const allViewed = viewedCount === totalCount && totalCount > 0;
        const isActive = cluster.id === activeClusterId;

        const needsReview = cluster.files.some(
          (f) => f.impactScore >= 4 || f.annotations.length > 0
        );

        return (
          <div
            key={cluster.id}
            className={`sidebar-cluster-row${isActive ? " is-active" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => activeClusterStore.set(cluster.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                activeClusterStore.set(cluster.id);
              }
            }}
          >
            <span className={`tag tag--${cluster.tag}`}>{cluster.tag}</span>
            <span className="sidebar-cluster__name">{cluster.name}</span>
            <div className="sidebar-cluster-row__right">
              {needsReview && (
                <span className="sidebar-cluster-row__badge sidebar-cluster-row__badge--warn">
                  ⚠
                </span>
              )}
              <span className={`sidebar-cluster__count${allViewed ? " is-done" : ""}`}>
                {allViewed ? "✓ " : ""}{viewedCount}/{totalCount}
              </span>
            </div>
          </div>
        );
      })}
    </aside>
  );
}
