import type { CSSProperties } from "react";
import type { ChangeCluster, FileAnalysis } from "../types.js";
import { viewedStore } from "../state/viewedStore.js";
import { activeClusterStore } from "../state/activeClusterStore.js";
import { useViewed } from "../hooks/useViewed.js";
import { useActiveCluster } from "../hooks/useActiveCluster.js";
import { useReviewDraft } from "../hooks/useReviewDraft.js";
import FileImpactChart from "./FileImpactChart.js";

interface Props {
  clusters: ChangeCluster[];
  style?: CSSProperties;
}

interface SidebarFileProps {
  cluster: ChangeCluster;
  file: FileAnalysis;
  commentCount: number;
}

function SidebarFile({ cluster, file, commentCount }: SidebarFileProps) {
  useViewed(); // re-render when viewed state changes
  const viewed = viewedStore.isViewed(cluster.id, file.path);

  const handleClick = () => {
    const id = `file-${cluster.id}-${encodeURIComponent(file.path)}`;
    window.dispatchEvent(
      new CustomEvent("pr-triage:mount-file", {
        detail: { clusterId: cluster.id, path: file.path },
      }),
    );
    // Give the diff a frame to mount so scrollIntoView targets the right height.
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("is-jump-target");
      setTimeout(() => el.classList.remove("is-jump-target"), 1500);
    });
  };

  const toggleViewed = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewed) {
      viewedStore.unmarkViewed(cluster.id, file.path);
    } else {
      viewedStore.markViewed(cluster.id, file.path);
    }
  };

  const basename = (p: string) => {
    const idx = p.lastIndexOf("/");
    return idx < 0 ? p : p.slice(idx + 1);
  };

  return (
    <li
      className={`sidebar-file${viewed ? " is-viewed" : ""}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <input
        type="checkbox"
        className="sidebar-file__check"
        checked={viewed}
        aria-label={viewed ? "Mark as unviewed" : "Mark as viewed"}
        onClick={toggleViewed}
        onChange={() => {/* handled by onClick */}}
      />
      <span className="sidebar-file__path" title={file.path}>{basename(file.path)}</span>
      <span className="sidebar-file__badges">
        {commentCount > 0 && (
          <span className="sidebar-file__badge sidebar-file__badge--comment">{commentCount}</span>
        )}
      </span>
      <FileImpactChart file={file} />
    </li>
  );
}

export default function AnalysisSidebar({ clusters, style }: Props) {
  useViewed(); // subscribe to viewed store for re-renders
  const activeClusterId = useActiveCluster();
  const draft = useReviewDraft();

  const totalFiles = clusters.reduce((sum, c) => sum + c.files.length, 0);
  const totalViewed = clusters.reduce(
    (sum, c) => sum + c.files.filter((f) => viewedStore.isViewed(c.id, f.path)).length,
    0,
  );

  // Build a map of comment counts per file (clusterId:path)
  const commentCountMap = new Map<string, number>();
  for (const comment of draft.comments) {
    const t = comment.target;
    if (t.kind === "file" || t.kind === "line" || t.kind === "annotation") {
      const key = `${t.clusterId}:${t.path}`;
      commentCountMap.set(key, (commentCountMap.get(key) ?? 0) + 1);
    }
  }

  return (
    <aside className="analysis-sidebar" style={style}>
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
            className={`sidebar-cluster${isActive ? " is-open" : ""}`}
          >
            <div
              className={`sidebar-cluster-row${isActive ? " is-active" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={cluster.name}
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
            {isActive && (
              <ul className="sidebar-cluster__files">
                {[...cluster.files]
                  .sort((a, b) => b.impactScore - a.impactScore)
                  .map((file) => (
                    <SidebarFile
                      key={file.path}
                      cluster={cluster}
                      file={file}
                      commentCount={commentCountMap.get(`${cluster.id}:${file.path}`) ?? 0}
                    />
                  ))}
              </ul>
            )}
          </div>
        );
      })}
    </aside>
  );
}
