import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AnalysisView from "../../src/components/AnalysisView.js";
import { makeAnalysis } from "../helpers.js";

describe("AnalysisView", () => {
  it("renders executive summary and cluster list initially", () => {
    const analysis = makeAnalysis();
    render(<AnalysisView analysis={analysis} onBack={vi.fn()} />);
    // Executive summary
    expect(screen.getByText("Add new feature")).toBeTruthy();
    expect(screen.getByText(/This PR adds a new feature/)).toBeTruthy();
    // Cluster list
    expect(screen.getByText("Change Clusters")).toBeTruthy();
    expect(screen.getByText("Core Logic Changes")).toBeTruthy();
    expect(screen.getByText("Style Updates")).toBeTruthy();
  });

  it("clicking a cluster shows ClusterDetail", () => {
    const analysis = makeAnalysis();
    render(<AnalysisView analysis={analysis} onBack={vi.fn()} />);
    fireEvent.click(screen.getByText("Core Logic Changes"));
    // Should now show the cluster detail heading (h3 with cluster name)
    // Cluster list heading should be gone
    expect(screen.queryByText("Change Clusters")).toBeNull();
    // The cluster name appears multiple times (breadcrumb + h3 in ClusterDetail)
    const allInstances = screen.getAllByText("Core Logic Changes");
    expect(allInstances.length).toBeGreaterThan(0);
  });

  it("breadcrumbs update when cluster is selected", () => {
    const analysis = makeAnalysis();
    render(<AnalysisView analysis={analysis} onBack={vi.fn()} />);
    // Before selection: "PR Summary" is the current page (no onClick, so bold)
    expect(screen.getByText("PR Summary").tagName).toBe("STRONG");
    // Select a cluster
    fireEvent.click(screen.getByText("Core Logic Changes"));
    // Now "PR Summary" should be a clickable button
    expect(screen.getByRole("button", { name: "PR Summary" })).toBeTruthy();
    // And cluster name should be in breadcrumbs as current (bold)
    const breadcrumbNav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(breadcrumbNav.textContent).toContain("Core Logic Changes");
  });

  it('clicking "PR Summary" breadcrumb goes back to cluster list', () => {
    const analysis = makeAnalysis();
    render(<AnalysisView analysis={analysis} onBack={vi.fn()} />);
    // Select a cluster first
    fireEvent.click(screen.getByText("Core Logic Changes"));
    expect(screen.queryByText("Change Clusters")).toBeNull();
    // Click PR Summary breadcrumb
    fireEvent.click(screen.getByRole("button", { name: "PR Summary" }));
    // Should be back to cluster list
    expect(screen.getByText("Change Clusters")).toBeTruthy();
  });

  it('clicking "New Analysis" calls onBack', () => {
    const onBack = vi.fn();
    const analysis = makeAnalysis();
    render(<AnalysisView analysis={analysis} onBack={onBack} />);
    fireEvent.click(screen.getByRole("button", { name: "New Analysis" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
