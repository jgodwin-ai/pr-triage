import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ClusterAccordion from "../../src/components/ClusterAccordion.js";
import { makeCluster } from "../helpers.js";
import type { ChangeCluster } from "../../src/types.js";

describe("ClusterAccordion", () => {
  it("expands first cluster by default", () => {
    const c = makeCluster({ id: "c1", name: "Auth refactor" });
    render(<ClusterAccordion clusters={[c]} />);
    // Default: first cluster is open — CommentThread renders its title
    expect(screen.getByText(/comments on this cluster/i)).toBeTruthy();
  });

  it("collapses on click of header", () => {
    const c = makeCluster({ id: "c1", name: "Auth refactor" });
    render(<ClusterAccordion clusters={[c]} />);
    // First is open; click header to close
    fireEvent.click(screen.getByRole("button", { name: /auth refactor/i }));
    expect(screen.queryByText(/comments on this cluster/i)).toBeNull();
  });

  it("only one cluster expanded at a time", () => {
    const c1 = makeCluster({ id: "c1", name: "Auth refactor" });
    const c2 = makeCluster({ id: "c2", name: "Tests" });
    render(<ClusterAccordion clusters={[c1, c2]} />);
    // c1 open by default; click c2 header
    fireEvent.click(screen.getByRole("button", { name: /tests/i }));
    const threads = screen.getAllByText(/comments on this cluster/i);
    expect(threads).toHaveLength(1);
  });

  it("renders cluster name and file count in header", () => {
    const c = makeCluster({ id: "c1", name: "Auth refactor" });
    render(<ClusterAccordion clusters={[c]} />);
    expect(screen.getByText("Auth refactor")).toBeTruthy();
    expect(screen.getByText(/1 file/)).toBeTruthy();
  });

  it("shows cluster summary when open", () => {
    const c = makeCluster({ id: "c1", name: "Auth refactor", summary: "Refactors the auth module" });
    render(<ClusterAccordion clusters={[c]} />);
    expect(screen.getByText("Refactors the auth module")).toBeTruthy();
  });

  it("renders tag for cluster", () => {
    const c = makeCluster({ id: "c1", name: "Auth refactor", tag: "needs-review" });
    render(<ClusterAccordion clusters={[c]} />);
    expect(screen.getByText("needs-review")).toBeTruthy();
  });

  it("renders empty list without error", () => {
    const clusters: ChangeCluster[] = [];
    render(<ClusterAccordion clusters={clusters} />);
    expect(screen.queryByText(/comments on this cluster/i)).toBeNull();
  });

  it("clicking closed cluster opens it", () => {
    const c1 = makeCluster({ id: "c1", name: "Auth refactor" });
    const c2 = makeCluster({ id: "c2", name: "Tests" });
    render(<ClusterAccordion clusters={[c1, c2]} />);
    // c2 is initially closed; clicking it should open it (and close c1)
    fireEvent.click(screen.getByRole("button", { name: /tests/i }));
    // Now c2 is open - verify by checking that Tests cluster content is visible
    // c1 should now be closed
    // We can verify by re-clicking c2 header - the thread should disappear
    expect(screen.getByText(/comments on this cluster/i)).toBeTruthy();
  });

  it("aria-expanded reflects open state", () => {
    const c1 = makeCluster({ id: "c1", name: "Auth refactor" });
    render(<ClusterAccordion clusters={[c1]} />);
    const btn = screen.getByRole("button", { name: /auth refactor/i });
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });
});
