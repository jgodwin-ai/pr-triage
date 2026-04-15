import { useState, useEffect, useRef } from "react";
import type { ChangeCluster, FileAnalysis } from "../types.js";
import DiffViewer from "./DiffViewer.js";
import { viewedStore } from "../state/viewedStore.js";
import { activeFileStore } from "../state/activeFileStore.js";
import { useViewed } from "../hooks/useViewed.js";
import { useAnnotationFilter } from "../hooks/useAnnotationFilter.js";

interface Props {
  cluster: ChangeCluster;
  file: FileAnalysis;
}

export default function FileView({ cluster, file }: Props) {
  useViewed(); // subscribe to re-render on viewed state changes
  const filter = useAnnotationFilter();
  const [viewType, setViewType] = useState<"unified" | "split">("unified");

  const viewed = viewedStore.isViewed(cluster.id, file.path);
  const fileId = `file-${cluster.id}-${encodeURIComponent(file.path)}`;
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const autoViewedRef = useRef(false);

  // Sync autoViewedRef when already viewed (e.g. loaded from persisted store)
  useEffect(() => {
    if (viewed) autoViewedRef.current = true;
  }, [viewed]);

  // IntersectionObserver on bottom sentinel: auto-mark viewed when user scrolls past the file
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !autoViewedRef.current) {
          autoViewedRef.current = true;
          viewedStore.markViewed(cluster.id, file.path);
          observer.disconnect();
        }
      },
      { threshold: 0, rootMargin: "0px 0px -50px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [cluster.id, file.path]);

  // IntersectionObserver on section: track active file for the right-rail chat
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          activeFileStore.set({ activeClusterId: cluster.id, activeFilePath: file.path });
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [cluster.id, file.path]);

  const toggleViewed = () => {
    if (viewed) {
      autoViewedRef.current = false;
      viewedStore.unmarkViewed(cluster.id, file.path);
    } else {
      autoViewedRef.current = true;
      viewedStore.markViewed(cluster.id, file.path);
    }
  };

  return (
    <section
      id={fileId}
      className="file-view"
      ref={sectionRef}
    >
      <div className="file-view__header">
        <span className="file-view__path">{file.path}</span>
        <span className="file-view__meta">
          {file.category} · impact {file.impactScore}/5
          {file.annotations.length > 0 && ` · ${file.annotations.length} annotation${file.annotations.length === 1 ? "" : "s"}`}
        </span>
        <label className="file-view__view-type-toggle">
          <input
            type="checkbox"
            aria-label="Split view"
            checked={viewType === "split"}
            onChange={(e) => setViewType(e.target.checked ? "split" : "unified")}
          />
          Split view
        </label>
        <label className="file-view__viewed-toggle">
          <input
            type="checkbox"
            checked={viewed}
            onChange={toggleViewed}
            aria-label={viewed ? "Mark as unviewed" : "Mark as viewed"}
          />
          {viewed ? "Viewed" : "Mark as viewed"}
        </label>
      </div>

      <div className="file-view__body">
        <DiffViewer clusterId={cluster.id} file={file} filter={filter} viewType={viewType} />
      </div>

      {/* Bottom sentinel: observed to fire markViewed when user scrolls past this file */}
      <div ref={sentinelRef} style={{ height: 0 }} />
    </section>
  );
}
