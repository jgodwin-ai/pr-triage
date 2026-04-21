import { useState, useEffect, useRef } from "react";
import type { ChangeCluster, FileAnalysis } from "../types.js";
import DiffViewer from "./DiffViewer.js";
import FileImpactChart from "./FileImpactChart.js";
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
  const [isMounted, setIsMounted] = useState(false);

  const viewed = viewedStore.isViewed(cluster.id, file.path);
  const fileId = `file-${cluster.id}-${encodeURIComponent(file.path)}`;
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const autoViewedRef = useRef(false);

  // Lazy-mount the diff body only when the file is near the viewport, so
  // parseDiff + tokenize don't run for every file in the cluster at once.
  useEffect(() => {
    if (isMounted) return;
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsMounted(true);
          observer.disconnect();
        }
      },
      { rootMargin: "1200px 0px 1200px 0px" },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [isMounted]);

  // Force-mount when another component (e.g. the sidebar) jumps to this file.
  useEffect(() => {
    if (isMounted) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { clusterId: string; path: string } | undefined;
      if (detail && detail.clusterId === cluster.id && detail.path === file.path) {
        setIsMounted(true);
      }
    };
    window.addEventListener("pr-triage:mount-file", handler);
    return () => window.removeEventListener("pr-triage:mount-file", handler);
  }, [isMounted, cluster.id, file.path]);

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
      { threshold: 0 },
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

  let additions = 0;
  let deletions = 0;
  for (const line of file.diff.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@")) continue;
    if (line.startsWith("+")) additions++;
    else if (line.startsWith("-")) deletions++;
  }

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
        <span className="file-view__meta">{file.category}</span>
        <span className="file-view__diffstat" aria-label={`${additions} added, ${deletions} removed`}>
          <span className="file-view__diffstat-add">+{additions}</span>
          <span className="file-view__diffstat-del">−{deletions}</span>
        </span>
        <FileImpactChart file={file} />
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
        {isMounted ? (
          <DiffViewer clusterId={cluster.id} file={file} filter={filter} viewType={viewType} />
        ) : (
          <div className="file-view__placeholder" aria-hidden="true">
            Loading diff…
          </div>
        )}
      </div>

      {/* Bottom sentinel: observed to fire markViewed when user scrolls past this file */}
      <div ref={sentinelRef} style={{ height: 0 }} />
    </section>
  );
}
