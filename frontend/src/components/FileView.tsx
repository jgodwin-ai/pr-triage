import { useState, useEffect, useRef } from "react";
import type { ChangeCluster, FileAnalysis } from "../types.js";
import type { AnnotationFilter } from "./AnnotationFilterBar.js";
import AnnotationFilterBar from "./AnnotationFilterBar.js";
import DiffViewer from "./DiffViewer.js";
import ChatPanel from "./ChatPanel.js";
import { viewedStore } from "../state/viewedStore.js";
import { useViewed } from "../hooks/useViewed.js";

interface Props {
  cluster: ChangeCluster;
  file: FileAnalysis;
}

export default function FileView({ cluster, file }: Props) {
  useViewed(); // subscribe to re-render on viewed state changes
  const [filter, setFilter] = useState<AnnotationFilter>({
    warning: true,
    info: true,
    suggestion: true,
  });

  const viewed = viewedStore.isViewed(cluster.id, file.path);
  const fileId = `file-${cluster.id}-${encodeURIComponent(file.path)}`;
  const containerRef = useRef<HTMLElement | null>(null);
  const autoViewedRef = useRef(false);

  // IntersectionObserver: auto-mark viewed when scrolled 40% into viewport for 800ms
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !autoViewedRef.current) {
          timer = setTimeout(() => {
            autoViewedRef.current = true;
            viewedStore.markViewed(cluster.id, file.path);
          }, 800);
        } else {
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
        }
      },
      { threshold: 0.4 }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [cluster.id, file.path]);

  // Sync autoViewedRef when already viewed
  useEffect(() => {
    if (viewed) autoViewedRef.current = true;
  }, [viewed]);

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
      ref={containerRef}
    >
      <div className="file-view__header">
        <span className="file-view__path">{file.path}</span>
        <span className="file-view__meta">
          {file.category} · impact {file.impactScore}/5
          {file.annotations.length > 0 && ` · ${file.annotations.length} annotation${file.annotations.length === 1 ? "" : "s"}`}
        </span>
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
        <div className="file-view__filters">
          <AnnotationFilterBar value={filter} onChange={setFilter} />
        </div>
        <DiffViewer clusterId={cluster.id} file={file} filter={filter} />
        <div className="file-view__chat">
          <ChatPanel filePath={file.path} diff={file.diff} summary={file.summary} />
        </div>
      </div>
    </section>
  );
}
