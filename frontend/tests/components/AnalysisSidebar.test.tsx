import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AnalysisSidebar from "../../src/components/AnalysisSidebar.js";
import { viewedStore } from "../../src/state/viewedStore.js";
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
  reviewDraftStore.reset();
});

describe("AnalysisSidebar", () => {
  it("renders cluster names and file paths", () => {
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
    expect(screen.getByText("src/auth.ts")).toBeTruthy();
    expect(screen.getByText("src/login.ts")).toBeTruthy();
  });

  it("shows annotation count badge for files with annotations", () => {
    const cluster = makeCluster({
      id: "c1",
      files: [
        makeFileAnalysis({
          path: "src/foo.ts",
          annotations: [
            { lineStart: 1, lineEnd: 2, type: "warning", message: "oops" },
          ],
        }),
      ],
    });
    render(<AnalysisSidebar clusters={[cluster]} />);
    expect(screen.getByText(/⚠/)).toBeTruthy();
  });

  it("does not show annotation badge when count is 0", () => {
    const cluster = makeCluster({
      id: "c1",
      files: [makeFileAnalysis({ path: "src/clean.ts", annotations: [] })],
    });
    render(<AnalysisSidebar clusters={[cluster]} />);
    expect(screen.queryByText(/⚠/)).toBeNull();
  });

  it("shows comment count badge when draft comments exist for the file", () => {
    const cluster = makeCluster({
      id: "c1",
      files: [makeFileAnalysis({ path: "src/foo.ts", annotations: [] })],
    });

    reviewDraftStore.loadFor("https://github.com/test/repo/pull/1", "sha-test");
    reviewDraftStore.addComment(
      { kind: "file", clusterId: "c1", path: "src/foo.ts" },
      "test comment",
    );

    render(<AnalysisSidebar clusters={[cluster]} />);
    expect(screen.getByText(/💬/)).toBeTruthy();
  });

  it("toggles viewed state when checkbox is clicked", () => {
    const cluster = makeCluster({
      id: "c1",
      files: [makeFileAnalysis({ path: "src/foo.ts", annotations: [] })],
    });
    render(<AnalysisSidebar clusters={[cluster]} />);

    expect(viewedStore.isViewed("c1", "src/foo.ts")).toBe(false);

    const checkbox = screen.getByRole("checkbox", { name: /mark src\/foo\.ts as viewed/i });
    fireEvent.click(checkbox);

    expect(viewedStore.isViewed("c1", "src/foo.ts")).toBe(true);
  });

  it("file row gets is-viewed class when viewed", () => {
    const cluster = makeCluster({
      id: "c1",
      files: [makeFileAnalysis({ path: "src/foo.ts", annotations: [] })],
    });
    viewedStore.markViewed("c1", "src/foo.ts");
    const { container } = render(<AnalysisSidebar clusters={[cluster]} />);
    const row = container.querySelector(".sidebar-file");
    expect(row?.classList.contains("is-viewed")).toBe(true);
  });

  it("shows progress pill in cluster header", () => {
    const cluster = makeCluster({
      id: "c1",
      files: [
        makeFileAnalysis({ path: "src/a.ts", annotations: [] }),
        makeFileAnalysis({ path: "src/b.ts", annotations: [] }),
      ],
    });
    viewedStore.markViewed("c1", "src/a.ts");
    render(<AnalysisSidebar clusters={[cluster]} />);
    // 1/2 viewed — appears in cluster count pill
    const countEls = screen.getAllByText(/1\/2/);
    expect(countEls.length).toBeGreaterThanOrEqual(1);
  });

  it("collapses cluster on header click", () => {
    const cluster = makeCluster({
      id: "c1",
      files: [makeFileAnalysis({ path: "src/foo.ts", annotations: [] })],
    });
    render(<AnalysisSidebar clusters={[cluster]} />);
    // File is visible initially
    expect(screen.getByText("src/foo.ts")).toBeTruthy();
    // Click the cluster header to collapse
    const header = screen.getByRole("button", { name: /core logic changes/i });
    fireEvent.click(header);
    expect(screen.queryByText("src/foo.ts")).toBeNull();
  });
});
