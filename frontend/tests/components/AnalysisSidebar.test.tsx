import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AnalysisSidebar from "../../src/components/AnalysisSidebar.js";
import { viewedStore } from "../../src/state/viewedStore.js";
import { activeClusterStore } from "../../src/state/activeClusterStore.js";
import { makeCluster, makeFileAnalysis } from "../helpers.js";

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

beforeEach(() => {
  vi.stubGlobal("localStorage", makeLocalStorageMock());
  viewedStore.loadFor("https://github.com/test/repo/pull/1", "sha-test");
  activeClusterStore.set(null);
});

describe("AnalysisSidebar", () => {
  it("renders cluster names (no nested file paths)", () => {
    const cluster = makeCluster({
      id: "c1",
      name: "Auth refactor",
      files: [
        makeFileAnalysis({ path: "src/auth.ts" }),
        makeFileAnalysis({ path: "src/login.ts" }),
      ],
    });
    render(<AnalysisSidebar clusters={[cluster]} />);
    expect(screen.getByText("Auth refactor")).toBeTruthy();
    // File paths should NOT appear in the sidebar anymore
    expect(screen.queryByText("src/auth.ts")).toBeNull();
    expect(screen.queryByText("src/login.ts")).toBeNull();
  });

  it("shows viewed count per cluster", () => {
    const cluster = makeCluster({
      id: "c1",
      name: "Auth refactor",
      files: [
        makeFileAnalysis({ path: "src/a.ts" }),
        makeFileAnalysis({ path: "src/b.ts" }),
      ],
    });
    viewedStore.markViewed("c1", "src/a.ts");
    render(<AnalysisSidebar clusters={[cluster]} />);
    // 1/2 viewed count in cluster row
    const countEls = screen.getAllByText(/1\/2/);
    expect(countEls.length).toBeGreaterThanOrEqual(1);
  });

  it("shows total viewed count in header", () => {
    const clusters = [
      makeCluster({
        id: "c1",
        files: [
          makeFileAnalysis({ path: "src/a.ts" }),
          makeFileAnalysis({ path: "src/b.ts" }),
        ],
      }),
    ];
    viewedStore.markViewed("c1", "src/a.ts");
    render(<AnalysisSidebar clusters={clusters} />);
    expect(screen.getByText(/1\/2 viewed/)).toBeTruthy();
  });

  it("clicking a cluster row sets it as active", () => {
    const cluster = makeCluster({ id: "c1", name: "Auth refactor" });
    render(<AnalysisSidebar clusters={[cluster]} />);

    expect(activeClusterStore.get()).toBeNull();

    const row = screen.getByRole("button", { name: /auth refactor/i });
    fireEvent.click(row);

    expect(activeClusterStore.get()).toBe("c1");
  });

  it("active cluster has is-active class", () => {
    const cluster = makeCluster({ id: "c1", name: "Auth refactor" });
    activeClusterStore.set("c1");
    const { container } = render(<AnalysisSidebar clusters={[cluster]} />);
    const row = container.querySelector(".sidebar-cluster-row");
    expect(row?.classList.contains("is-active")).toBe(true);
  });

  it("inactive cluster does not have is-active class", () => {
    const clusters = [
      makeCluster({ id: "c1", name: "Cluster A" }),
      makeCluster({ id: "c2", name: "Cluster B" }),
    ];
    activeClusterStore.set("c1");
    const { container } = render(<AnalysisSidebar clusters={clusters} />);
    const rows = container.querySelectorAll(".sidebar-cluster-row");
    expect(rows[0]?.classList.contains("is-active")).toBe(true);
    expect(rows[1]?.classList.contains("is-active")).toBe(false);
  });

  it("shows warning badge for cluster with high-impact files", () => {
    const cluster = makeCluster({
      id: "c1",
      name: "Risky",
      files: [makeFileAnalysis({ path: "src/x.ts", impactScore: 4, annotations: [] })],
    });
    render(<AnalysisSidebar clusters={[cluster]} />);
    expect(screen.getByText("⚠")).toBeTruthy();
  });

  it("shows all-viewed checkmark when all files viewed", () => {
    const cluster = makeCluster({
      id: "c1",
      name: "Done cluster",
      files: [makeFileAnalysis({ path: "src/a.ts" })],
    });
    viewedStore.markViewed("c1", "src/a.ts");
    render(<AnalysisSidebar clusters={[cluster]} />);
    expect(screen.getByText(/✓/)).toBeTruthy();
  });
});
