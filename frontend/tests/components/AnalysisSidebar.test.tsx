import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import AnalysisSidebar from "../../src/components/AnalysisSidebar.js";
import { viewedStore } from "../../src/state/viewedStore.js";
import { activeClusterStore } from "../../src/state/activeClusterStore.js";
import { reviewDraftStore } from "../../src/state/reviewDraft.js";
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
  reviewDraftStore.reset();
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

  it("active cluster expands to show its files", () => {
    const cluster = makeCluster({
      id: "c1",
      name: "Auth refactor",
      files: [
        makeFileAnalysis({ path: "src/auth.ts" }),
        makeFileAnalysis({ path: "src/login.ts" }),
      ],
    });
    activeClusterStore.set("c1");
    render(<AnalysisSidebar clusters={[cluster]} />);
    // File basenames should appear when cluster is active
    expect(screen.getByText("auth.ts")).toBeTruthy();
    expect(screen.getByText("login.ts")).toBeTruthy();
  });

  it("inactive cluster does not show its files", () => {
    const clusters = [
      makeCluster({
        id: "c1",
        name: "Active cluster",
        files: [makeFileAnalysis({ path: "src/active.ts" })],
      }),
      makeCluster({
        id: "c2",
        name: "Inactive cluster",
        files: [makeFileAnalysis({ path: "src/inactive.ts" })],
      }),
    ];
    activeClusterStore.set("c1");
    render(<AnalysisSidebar clusters={clusters} />);
    expect(screen.getByText("active.ts")).toBeTruthy();
    expect(screen.queryByText("inactive.ts")).toBeNull();
  });

  it("clicking a file row calls scrollIntoView on the file card", () => {
    const cluster = makeCluster({
      id: "c1",
      name: "Auth refactor",
      files: [makeFileAnalysis({ path: "src/auth.ts" })],
    });
    activeClusterStore.set("c1");

    const el = document.createElement("section");
    el.id = `file-c1-${encodeURIComponent("src/auth.ts")}`;
    const scrollMock = vi.fn();
    el.scrollIntoView = scrollMock;
    document.body.appendChild(el);

    render(<AnalysisSidebar clusters={[cluster]} />);
    const fileRow = screen.getByText("auth.ts");
    fireEvent.click(fileRow);

    expect(scrollMock).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    document.body.removeChild(el);
  });

  it("viewed checkbox writes viewedStore when toggled", () => {
    const cluster = makeCluster({
      id: "c1",
      name: "Auth refactor",
      files: [makeFileAnalysis({ path: "src/auth.ts" })],
    });
    activeClusterStore.set("c1");
    render(<AnalysisSidebar clusters={[cluster]} />);

    expect(viewedStore.isViewed("c1", "src/auth.ts")).toBe(false);
    const checkbox = screen.getByRole("checkbox", { name: /mark as viewed/i });
    fireEvent.click(checkbox);
    expect(viewedStore.isViewed("c1", "src/auth.ts")).toBe(true);
  });

  it("viewed file has is-viewed class on file row", () => {
    const cluster = makeCluster({
      id: "c1",
      name: "Auth refactor",
      files: [makeFileAnalysis({ path: "src/auth.ts" })],
    });
    viewedStore.markViewed("c1", "src/auth.ts");
    activeClusterStore.set("c1");
    const { container } = render(<AnalysisSidebar clusters={[cluster]} />);
    const fileItem = container.querySelector(".sidebar-file");
    expect(fileItem?.classList.contains("is-viewed")).toBe(true);
  });

  it("shows comment count badge for files with comments", () => {
    const cluster = makeCluster({
      id: "c1",
      name: "Auth refactor",
      files: [makeFileAnalysis({ path: "src/auth.ts" })],
    });
    act(() => {
      reviewDraftStore.addComment({ kind: "file", clusterId: "c1", path: "src/auth.ts" }, "A comment");
    });
    activeClusterStore.set("c1");
    const { container } = render(<AnalysisSidebar clusters={[cluster]} />);
    const commentBadge = container.querySelector(".sidebar-file__badge--comment");
    expect(commentBadge).toBeTruthy();
    expect(commentBadge?.textContent).toBe("1");
  });
});
