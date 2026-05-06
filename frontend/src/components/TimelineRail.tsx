import { useMemo, useState, useSyncExternalStore } from "react";
import { stackStore, type Level, type StackSnapshot } from "../state/stack.js";
import { reviewDraftStore } from "../state/reviewDraft.js";
import type { ReviewDraft } from "../types.js";

/**
 * Slim far-left rail rendering the virtual stack. Each non-noise level becomes
 * a clickable node; noise levels are dimmed and hidden behind an inline
 * "▾ N hidden" expander between adjacent feature levels.
 *
 * Oldest level is at the bottom (matches the "build up understanding" mental
 * model). The Level array from the store is ordered newest → oldest, so we
 * render in the natural order: index 0 sits at the top.
 *
 * Reads state from `stackStore` and `reviewDraftStore` directly (no props) so
 * callers can drop the rail in without plumbing.
 */
export default function TimelineRail() {
  const snapshot = useSyncExternalStore<StackSnapshot>(
    (l) => stackStore.subscribe(l),
    () => stackStore.snapshot(),
    () => stackStore.snapshot(),
  );
  const draft = useSyncExternalStore<ReviewDraft>(
    (l) => reviewDraftStore.subscribe(l),
    () => reviewDraftStore.snapshot(),
    () => reviewDraftStore.snapshot(),
  );

  const { levels, selectedSha } = snapshot;

  // Per-SHA draft counts. `commitId` will be attached to comment targets in
  // JGT-31; until then this map is empty and badges render as 0.
  const draftCountBySha = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of draft.comments) {
      const commitId = (c.target as { commitId?: string }).commitId;
      if (!commitId) continue;
      counts.set(commitId, (counts.get(commitId) ?? 0) + 1);
    }
    return counts;
  }, [draft.comments]);

  // Group consecutive noise levels into runs, anchored by their preceding and
  // following indices in `levels`. Each run becomes an expander placed
  // between two feature nodes.
  const runs = useMemo(() => groupNoiseRuns(levels), [levels]);

  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (runStart: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(runStart)) next.delete(runStart);
      else next.add(runStart);
      return next;
    });
  };

  // Walk the levels in order. For each feature level emit a node; whenever we
  // hit the start of a noise run that's flanked by features on both sides,
  // emit an expander (and the noise nodes if expanded).
  const items: React.ReactNode[] = [];
  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];
    if (level.kind === "feature") {
      items.push(
        <FeatureNode
          key={level.sha}
          level={level}
          selected={selectedSha === level.sha}
          draftCount={draftCountBySha.get(level.sha) ?? 0}
        />,
      );
      continue;
    }
    // Noise. Find the run start.
    const run = runs.find((r) => r.start === i);
    if (!run) continue; // mid-run; handled by run.start iteration
    const isOpen = expanded.has(run.start);
    items.push(
      <button
        key={`expander-${run.start}`}
        type="button"
        className={`timeline-rail__expander${isOpen ? " is-open" : ""}`}
        onClick={() => toggle(run.start)}
        aria-expanded={isOpen}
      >
        <span className="timeline-rail__expander-caret">{isOpen ? "▴" : "▾"}</span>
        <span className="timeline-rail__expander-count">
          {run.end - run.start + 1} hidden
        </span>
      </button>,
    );
    if (isOpen) {
      for (let j = run.start; j <= run.end; j++) {
        const noise = levels[j];
        items.push(
          <FeatureNode
            key={noise.sha}
            level={noise}
            selected={selectedSha === noise.sha}
            draftCount={draftCountBySha.get(noise.sha) ?? 0}
            dimmed
          />,
        );
      }
    }
    // Skip the noise indices we just rendered (or hid).
    i = run.end;
  }

  return (
    <nav className="timeline-rail" aria-label="Commit stack timeline">
      {items}
    </nav>
  );
}

interface FeatureNodeProps {
  level: Level;
  selected: boolean;
  draftCount: number;
  dimmed?: boolean;
}

function FeatureNode({ level, selected, draftCount, dimmed }: FeatureNodeProps) {
  const cls = [
    "timeline-rail__node",
    `timeline-rail__node--${level.kind}`,
    selected ? "is-selected" : "",
    dimmed ? "is-dimmed" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      data-testid="timeline-rail__node"
      className={cls}
      title={level.message}
      aria-pressed={selected}
      onClick={() => stackStore.setSelected(level.sha)}
    >
      <span
        className={`timeline-rail__dot timeline-rail__dot--${level.status}`}
        aria-hidden="true"
      />
      <span className="timeline-rail__sha">{level.shortSha}</span>
      {draftCount > 0 && (
        <span className="timeline-rail__badge" aria-label={`${draftCount} drafts`}>
          {draftCount}
        </span>
      )}
    </button>
  );
}

interface NoiseRun {
  start: number;
  end: number; // inclusive
}

function groupNoiseRuns(levels: Level[]): NoiseRun[] {
  const runs: NoiseRun[] = [];
  let i = 0;
  while (i < levels.length) {
    if (levels[i].kind === "noise") {
      const start = i;
      while (i < levels.length && levels[i].kind === "noise") i++;
      runs.push({ start, end: i - 1 });
    } else {
      i++;
    }
  }
  return runs;
}
