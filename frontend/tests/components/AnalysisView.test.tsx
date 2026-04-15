import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AnalysisView from "../../src/components/AnalysisView.js";
import { makeAnalysis, makeCluster, makeFileAnalysis } from "../helpers.js";

// Stub IntersectionObserver for jsdom
beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    })),
  );
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

  it("renders one file-view per file across all clusters", () => {
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
    // Each file-view has the file path in header
    expect(document.getElementById("file-c1-" + encodeURIComponent("src/foo.ts"))).toBeTruthy();
    expect(document.getElementById("file-c1-" + encodeURIComponent("src/bar.ts"))).toBeTruthy();
    expect(document.getElementById("file-c2-" + encodeURIComponent("src/baz.ts"))).toBeTruthy();
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
});
