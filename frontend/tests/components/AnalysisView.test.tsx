import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import AnalysisView from "../../src/components/AnalysisView.js";
import { activeClusterStore } from "../../src/state/activeClusterStore.js";
import { stackStore, type Level } from "../../src/state/stack.js";
import { makeAnalysis, makeCluster, makeFileAnalysis } from "../helpers.js";

function makeLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
}

// Stub IntersectionObserver for jsdom
beforeEach(() => {
  vi.stubGlobal("localStorage", makeLocalStorageMock());
  vi.stubGlobal(
    "IntersectionObserver",
    vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    })),
  );
  // Reset active cluster and stack between tests
  activeClusterStore.set(null);
  stackStore._resetForTest();
});

afterEach(() => {
  activeClusterStore.set(null);
  stackStore._resetForTest();
});

describe("AnalysisView", () => {
  it("renders sidebar with cluster names", () => {
    const analysis = makeAnalysis();
    render(<AnalysisView analysis={analysis} onBack={vi.fn()} />);
    expect(screen.getByText("Core Logic Changes")).toBeTruthy();
    expect(screen.getByText("Style Updates")).toBeTruthy();
  });

  it('renders "Analyze another PR" back button', () => {
    const analysis = makeAnalysis();
    render(<AnalysisView analysis={analysis} onBack={vi.fn()} />);
    expect(screen.getByRole("button", { name: /analyze another pr/i })).toBeTruthy();
  });

  it('clicking "Analyze another PR" calls onBack', () => {
    const onBack = vi.fn();
    const analysis = makeAnalysis();
    render(<AnalysisView analysis={analysis} onBack={onBack} />);
    fireEvent.click(screen.getByRole("button", { name: /analyze another pr/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("renders only files of the active cluster (first cluster by default)", () => {
    const analysis = makeAnalysis({
      clusters: [
        makeCluster({
          id: "c1",
          name: "Cluster A",
          files: [
            makeFileAnalysis({ path: "src/foo.ts" }),
            makeFileAnalysis({ path: "src/bar.ts" }),
          ],
        }),
        makeCluster({
          id: "c2",
          name: "Cluster B",
          files: [makeFileAnalysis({ path: "src/baz.ts" })],
        }),
      ],
    });
    render(<AnalysisView analysis={analysis} onBack={vi.fn()} />);
    // First cluster's files should be visible
    expect(document.getElementById("file-c1-" + encodeURIComponent("src/foo.ts"))).toBeTruthy();
    expect(document.getElementById("file-c1-" + encodeURIComponent("src/bar.ts"))).toBeTruthy();
    // Second cluster's files should NOT be visible
    expect(document.getElementById("file-c2-" + encodeURIComponent("src/baz.ts"))).toBeNull();
  });

  it("switches visible files when active cluster changes", () => {
    const analysis = makeAnalysis({
      clusters: [
        makeCluster({
          id: "c1",
          name: "Cluster A",
          files: [makeFileAnalysis({ path: "src/foo.ts" })],
        }),
        makeCluster({
          id: "c2",
          name: "Cluster B",
          files: [makeFileAnalysis({ path: "src/baz.ts" })],
        }),
      ],
    });
    render(<AnalysisView analysis={analysis} onBack={vi.fn()} />);

    // Initially c1 files shown
    expect(document.getElementById("file-c1-" + encodeURIComponent("src/foo.ts"))).toBeTruthy();
    expect(document.getElementById("file-c2-" + encodeURIComponent("src/baz.ts"))).toBeNull();

    // Switch active cluster to c2
    act(() => {
      activeClusterStore.set("c2");
    });

    expect(document.getElementById("file-c2-" + encodeURIComponent("src/baz.ts"))).toBeTruthy();
    expect(document.getElementById("file-c1-" + encodeURIComponent("src/foo.ts"))).toBeNull();
  });

  it("does not render breadcrumbs or old cluster accordion heading", () => {
    const analysis = makeAnalysis();
    render(<AnalysisView analysis={analysis} onBack={vi.fn()} />);
    expect(screen.queryByText("Change Clusters")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).toBeNull();
  });

  it("renders the right rail chat panel", () => {
    const analysis = makeAnalysis();
    render(<AnalysisView analysis={analysis} onBack={vi.fn()} />);
    // Right rail collapse button should be present
    expect(screen.getByRole("button", { name: /collapse chat panel/i })).toBeTruthy();
  });

  it("does not render ReviewSubmitBar in the main pane", () => {
    const analysis = makeAnalysis();
    const { container } = render(<AnalysisView analysis={analysis} onBack={vi.fn()} />);
    const main = container.querySelector(".analysis-main");
    expect(main).toBeTruthy();
    // review-form should NOT be a child of analysis-main
    expect(main!.querySelector(".review-form")).toBeNull();
  });

  it("renders review form in the right rail when Review tab is clicked", () => {
    const analysis = makeAnalysis();
    render(<AnalysisView analysis={analysis} onBack={vi.fn()} />);
    const reviewTabBtn = screen.getByRole("button", { name: /^review/i });
    fireEvent.click(reviewTabBtn);
    expect(screen.getByText(/finish your review/i)).toBeTruthy();
  });
});

function lvl(overrides: Partial<Level> & { sha: string }): Level {
  return {
    sha: overrides.sha,
    shortSha: overrides.shortSha ?? overrides.sha.slice(0, 7),
    message: overrides.message ?? `commit ${overrides.sha}`,
    parentSha: overrides.parentSha ?? "0000000",
    kind: overrides.kind ?? "feature",
    files: overrides.files ?? [],
    status: overrides.status ?? "ready",
    noiseReason: overrides.noiseReason,
    analysis: overrides.analysis,
  };
}

describe("AnalysisView — per-level analysis resolution (JGT-31)", () => {
  it("renders the selected level's analysis when a stack is loaded", () => {
    const analysisA = makeAnalysis({
      id: "level-A",
      clusters: [
        makeCluster({
          id: "ca",
          name: "Level A cluster",
          files: [makeFileAnalysis({ path: "a.ts" })],
        }),
      ],
    });
    const analysisB = makeAnalysis({
      id: "level-B",
      clusters: [
        makeCluster({
          id: "cb",
          name: "Level B cluster",
          files: [makeFileAnalysis({ path: "b.ts" })],
        }),
      ],
    });
    stackStore.setStack("https://github.com/o/r/pull/1", [
      lvl({ sha: "shaA0001", analysis: analysisA }),
      lvl({ sha: "shaB0002", analysis: analysisB }),
    ]);
    // setStack auto-selects the first level (shaA).
    // Pass the prop analysis as level-A's so the legacy prop fallback never matters.
    render(
      <AnalysisView analysis={analysisA} onBack={vi.fn()} />,
    );
    expect(screen.getByText("Level A cluster")).toBeTruthy();
    // Switch to level B
    act(() => {
      stackStore.setSelected("shaB0002");
    });
    expect(screen.getByText("Level B cluster")).toBeTruthy();
    expect(screen.queryByText("Level A cluster")).toBeNull();
  });

  it("falls back to prop analysis when no stack is loaded (legacy single-PR flow)", () => {
    // No stack set; AnalysisView must use the prop analysis.
    const analysis = makeAnalysis({
      clusters: [
        makeCluster({
          id: "legacy",
          name: "Legacy single-PR cluster",
          files: [makeFileAnalysis({ path: "x.ts" })],
        }),
      ],
    });
    render(<AnalysisView analysis={analysis} onBack={vi.fn()} />);
    expect(screen.getByText("Legacy single-PR cluster")).toBeTruthy();
  });

  it("falls back to prop analysis when the selected level has no analysis yet", () => {
    const propAnalysis = makeAnalysis({
      clusters: [
        makeCluster({
          id: "fallback",
          name: "Fallback cluster",
          files: [makeFileAnalysis({ path: "f.ts" })],
        }),
      ],
    });
    stackStore.setStack("https://github.com/o/r/pull/1", [
      // No analysis attached yet (status=pending).
      lvl({ sha: "pendingsha", status: "pending" }),
    ]);
    render(<AnalysisView analysis={propAnalysis} onBack={vi.fn()} />);
    expect(screen.getByText("Fallback cluster")).toBeTruthy();
  });
});
