import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import AnalysisView from "../../src/components/AnalysisView.js";
import { activeClusterStore } from "../../src/state/activeClusterStore.js";
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
  // Reset active cluster between tests
  activeClusterStore.set(null);
});

afterEach(() => {
  activeClusterStore.set(null);
});

describe("AnalysisView", () => {
  it("renders executive summary", () => {
    const analysis = makeAnalysis();
    render(<AnalysisView analysis={analysis} onBack={vi.fn()} />);
    expect(screen.getByText("Add new feature")).toBeTruthy();
    expect(screen.getByText(/This PR adds a new feature/)).toBeTruthy();
  });

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

  it("renders exactly one global annotation filter bar", () => {
    const analysis = makeAnalysis();
    render(<AnalysisView analysis={analysis} onBack={vi.fn()} />);
    const toolbars = screen.getAllByRole("toolbar", { name: /annotation filters/i });
    expect(toolbars).toHaveLength(1);
  });

  it("renders the right rail chat panel", () => {
    const analysis = makeAnalysis();
    render(<AnalysisView analysis={analysis} onBack={vi.fn()} />);
    // Right rail collapse button should be present
    expect(screen.getByRole("button", { name: /collapse chat panel/i })).toBeTruthy();
  });
});
