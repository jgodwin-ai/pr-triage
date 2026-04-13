import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AnalysisView from "../../src/components/AnalysisView.js";
import { makeAnalysis } from "../helpers.js";

describe("AnalysisView", () => {
  it("renders executive summary", () => {
    const analysis = makeAnalysis();
    render(<AnalysisView analysis={analysis} onBack={vi.fn()} />);
    expect(screen.getByText("Add new feature")).toBeTruthy();
    expect(screen.getByText(/This PR adds a new feature/)).toBeTruthy();
  });

  it("renders cluster accordion with cluster names", () => {
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

  it("first cluster is expanded by default", () => {
    const analysis = makeAnalysis();
    render(<AnalysisView analysis={analysis} onBack={vi.fn()} />);
    expect(screen.getByText(/comments on this cluster/i)).toBeTruthy();
  });

  it("does not render breadcrumbs or old cluster list heading", () => {
    const analysis = makeAnalysis();
    render(<AnalysisView analysis={analysis} onBack={vi.fn()} />);
    expect(screen.queryByText("Change Clusters")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).toBeNull();
  });
});
