import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ClusterList from "../../src/components/ClusterList.js";
import { makeCluster } from "../helpers.js";

describe("ClusterList", () => {
  const clusters = [
    makeCluster({ id: "c1", name: "Auth Changes", tag: "needs-review" }),
    makeCluster({ id: "c2", name: "Style Fixes", tag: "style-only" }),
    makeCluster({ id: "c3", name: "Config Updates", tag: "low-risk" }),
  ];

  it("renders all clusters", () => {
    render(<ClusterList clusters={clusters} onSelectCluster={vi.fn()} />);
    expect(screen.getByText("Auth Changes")).toBeTruthy();
    expect(screen.getByText("Style Fixes")).toBeTruthy();
    expect(screen.getByText("Config Updates")).toBeTruthy();
  });

  it("shows correct tag with color badge", () => {
    render(<ClusterList clusters={clusters} onSelectCluster={vi.fn()} />);
    const needsReview = screen.getByText("needs-review");
    expect(needsReview.className).toContain("tag--needs-review");
    const styleOnly = screen.getByText("style-only");
    expect(styleOnly.className).toContain("tag--style-only");
    const lowRisk = screen.getByText("low-risk");
    expect(lowRisk.className).toContain("tag--low-risk");
  });

  it("calls onSelectCluster on click", () => {
    const onSelect = vi.fn();
    render(<ClusterList clusters={clusters} onSelectCluster={onSelect} />);
    fireEvent.click(screen.getByText("Auth Changes"));
    expect(onSelect).toHaveBeenCalledWith(clusters[0]);
  });

  it("calls onSelectCluster on Enter key", () => {
    const onSelect = vi.fn();
    render(<ClusterList clusters={clusters} onSelectCluster={onSelect} />);
    const items = screen.getAllByRole("button");
    fireEvent.keyDown(items[0], { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(clusters[0]);
  });

  it("calls onSelectCluster on Space key", () => {
    const onSelect = vi.fn();
    render(<ClusterList clusters={clusters} onSelectCluster={onSelect} />);
    const items = screen.getAllByRole("button");
    fireEvent.keyDown(items[1], { key: " " });
    expect(onSelect).toHaveBeenCalledWith(clusters[1]);
  });

  it("cluster items have role='button' and tabIndex", () => {
    render(<ClusterList clusters={clusters} onSelectCluster={vi.fn()} />);
    const items = screen.getAllByRole("button");
    expect(items).toHaveLength(3);
    for (const item of items) {
      expect(item.getAttribute("tabindex")).toBe("0");
    }
  });
});
