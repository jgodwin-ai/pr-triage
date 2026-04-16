import { useEffect, useState, useRef, useCallback } from "react";
import type { PRAnalysis } from "../types.js";
import AnalysisSidebar from "./AnalysisSidebar.js";
import FileView from "./FileView.js";
import RightRail from "./RightRail.js";
import ResizeHandle from "./ResizeHandle.js";
import AnnotationFilterBar from "./AnnotationFilterBar.js";
import { reviewDraftStore } from "../state/reviewDraft.js";
import { viewedStore } from "../state/viewedStore.js";
import { activeClusterStore } from "../state/activeClusterStore.js";
import { activeFileStore } from "../state/activeFileStore.js";
import { useActiveCluster } from "../hooks/useActiveCluster.js";
import { useAnnotationFilter } from "../hooks/useAnnotationFilter.js";
import { annotationFilterStore } from "../state/annotationFilterStore.js";

const STORAGE_KEY = "pr-triage:panelWidths";
const LEFT_MIN = 180;
const LEFT_MAX = 500;
const RIGHT_MIN = 260;
const RIGHT_MAX = 600;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function loadWidths(): { leftW: number; rightW: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        leftW: clamp(parsed.leftW ?? 280, LEFT_MIN, LEFT_MAX),
        rightW: clamp(parsed.rightW ?? 360, RIGHT_MIN, RIGHT_MAX),
      };
    }
  } catch {
    // ignore
  }
  return { leftW: 280, rightW: 360 };
}

interface Props { analysis: PRAnalysis; onBack: () => void; }

export default function AnalysisView({ analysis, onBack }: Props) {
  const activeClusterId = useActiveCluster();
  const filter = useAnnotationFilter();

  const initial = loadWidths();
  const [leftW, setLeftW] = useState(initial.leftW);
  const [rightW, setRightW] = useState(initial.rightW);

  // Snapshots at drag start
  const leftSnap = useRef(leftW);
  const rightSnap = useRef(rightW);

  const persistWidths = useCallback((lw: number, rw: number) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ leftW: lw, rightW: rw }));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    reviewDraftStore.loadFor(analysis.pr.url, analysis.pr.headSha);
    viewedStore.loadFor(analysis.pr.url, analysis.pr.headSha);
    // Reset right rail to Summary tab on new analysis
    try { localStorage.setItem("pr-triage:rightRailTab", "summary"); } catch {}
  }, [analysis.pr.url, analysis.pr.headSha]);

  // Set default active cluster when analysis mounts or changes
  useEffect(() => {
    const firstId = analysis.clusters[0]?.id ?? null;
    activeClusterStore.set(firstId);
    // Also reset active file to first file of first cluster
    const firstFile = analysis.clusters[0]?.files[0];
    if (firstId && firstFile) {
      activeFileStore.set({ activeClusterId: firstId, activeFilePath: firstFile.path });
    } else {
      activeFileStore.set({ activeClusterId: null, activeFilePath: null });
    }
  }, [analysis]);

  const activeCluster =
    analysis.clusters.find((c) => c.id === activeClusterId) ?? analysis.clusters[0];

  const handleLeftDrag = useCallback((deltaX: number) => {
    const newW = clamp(leftSnap.current + deltaX, LEFT_MIN, LEFT_MAX);
    setLeftW(newW);
    persistWidths(newW, rightSnap.current);
  }, [persistWidths]);

  const handleRightDrag = useCallback((deltaX: number) => {
    const newW = clamp(rightSnap.current - deltaX, RIGHT_MIN, RIGHT_MAX);
    setRightW(newW);
    persistWidths(leftSnap.current, newW);
  }, [persistWidths]);

  return (
    <div className="analysis-shell">
      <AnalysisSidebar clusters={analysis.clusters} style={{ width: leftW }} />
      <ResizeHandle
        onDragStart={() => { leftSnap.current = leftW; rightSnap.current = rightW; }}
        onDrag={handleLeftDrag}
      />
      <main className="analysis-main">
        <button className="btn-link" style={{ paddingTop: "8px" }} onClick={onBack}>← Analyze another PR</button>
        {activeCluster?.files.map((file) => (
          <FileView
            key={`${activeCluster.id}:${file.path}`}
            cluster={activeCluster}
            file={file}
          />
        ))}
        <div className="analysis-main__filter-float">
          <AnnotationFilterBar
            value={filter}
            onChange={(next) => annotationFilterStore.set(next)}
          />
        </div>
      </main>
      <ResizeHandle
        onDragStart={() => { leftSnap.current = leftW; rightSnap.current = rightW; }}
        onDrag={handleRightDrag}
      />
      <RightRail analysis={analysis} prUrl={analysis.pr.url} style={{ width: rightW }} />
    </div>
  );
}
