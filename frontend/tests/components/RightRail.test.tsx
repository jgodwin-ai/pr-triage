import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import RightRail from "../../src/components/RightRail.js";
import { activeFileStore } from "../../src/state/activeFileStore.js";
import { reviewDraftStore } from "../../src/state/reviewDraft.js";
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

const analysis = makeAnalysis({
  clusters: [
    makeCluster({
      id: "c1",
      files: [makeFileAnalysis({ path: "src/active.ts" })],
    }),
  ],
});

const prUrl = analysis.pr.url;

beforeEach(() => {
  vi.stubGlobal("localStorage", makeLocalStorageMock());
  activeFileStore.set({ activeFilePath: null, activeClusterId: null });
  reviewDraftStore.reset();
});

describe("RightRail", () => {
  it("renders the collapse toggle button", () => {
    render(<RightRail analysis={analysis} prUrl={prUrl} />);
    expect(screen.getByRole("button", { name: /collapse chat panel/i })).toBeTruthy();
  });

  it("renders Summary, Review, and Chat tabs", () => {
    render(<RightRail analysis={analysis} prUrl={prUrl} />);
    expect(screen.getByRole("button", { name: /^summary$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^review/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^chat$/i })).toBeTruthy();
  });

  it("defaults to Summary tab when localStorage is empty", () => {
    render(<RightRail analysis={analysis} prUrl={prUrl} />);
    // Executive summary content should be visible on the summary tab
    expect(screen.getByText(analysis.pr.title)).toBeTruthy();
  });

  it("Summary tab renders executive summary content", () => {
    render(<RightRail analysis={analysis} prUrl={prUrl} />);
    expect(screen.getByText(analysis.executiveSummary)).toBeTruthy();
  });

  it("restores saved chat tab from localStorage", () => {
    localStorage.setItem("pr-triage:rightRailTab", "chat");
    render(<RightRail analysis={analysis} prUrl={prUrl} />);
    expect(screen.getByText(/no file selected/i)).toBeTruthy();
  });

  it("restores saved review tab from localStorage", () => {
    localStorage.setItem("pr-triage:rightRailTab", "review");
    render(<RightRail analysis={analysis} prUrl={prUrl} />);
    expect(screen.getByText(/finish your review/i)).toBeTruthy();
  });

  it("switches to Chat tab and shows chat content", () => {
    render(<RightRail analysis={analysis} prUrl={prUrl} />);
    fireEvent.click(screen.getByRole("button", { name: /^chat$/i }));
    expect(screen.getByText(/no file selected/i)).toBeTruthy();
  });

  it("switches to Review tab and shows review form", () => {
    render(<RightRail analysis={analysis} prUrl={prUrl} />);
    const reviewBtn = screen.getByRole("button", { name: /^review/i });
    fireEvent.click(reviewBtn);
    expect(screen.getByText(/finish your review/i)).toBeTruthy();
  });

  it("switches back from Review to Summary tab", () => {
    render(<RightRail analysis={analysis} prUrl={prUrl} />);
    // go to review
    fireEvent.click(screen.getByRole("button", { name: /^review/i }));
    expect(screen.getByText(/finish your review/i)).toBeTruthy();
    // switch back to summary
    fireEvent.click(screen.getByRole("button", { name: /^summary$/i }));
    expect(screen.getByText(analysis.pr.title)).toBeTruthy();
  });

  it("shows pending count badge on Review tab when there are pending comments", () => {
    act(() => {
      reviewDraftStore.addComment(
        { kind: "file", clusterId: "c1", path: "src/active.ts" },
        "test comment",
      );
    });
    render(<RightRail analysis={analysis} prUrl={prUrl} />);
    // Badge with count 1 should appear near Review button
    const badge = document.querySelector(".right-rail__tab-badge");
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toBe("1");
  });

  it("does not show badge when no pending comments", () => {
    render(<RightRail analysis={analysis} prUrl={prUrl} />);
    const badge = document.querySelector(".right-rail__tab-badge");
    expect(badge).toBeNull();
  });

  it("shows active file path in chat header when file is active", () => {
    act(() => {
      activeFileStore.set({ activeFilePath: "src/active.ts", activeClusterId: "c1" });
    });
    render(<RightRail analysis={analysis} prUrl={prUrl} />);
    // Switch to chat tab
    fireEvent.click(screen.getByRole("button", { name: /^chat$/i }));
    expect(screen.getByText("src/active.ts")).toBeTruthy();
  });

  it("shows muted hint text in chat tab", () => {
    act(() => {
      activeFileStore.set({ activeFilePath: "src/active.ts", activeClusterId: "c1" });
    });
    render(<RightRail analysis={analysis} prUrl={prUrl} />);
    // Switch to chat tab
    fireEvent.click(screen.getByRole("button", { name: /^chat$/i }));
    expect(screen.getByText(/scroll up in the main pane/i)).toBeTruthy();
  });

  it("collapse toggle hides the inner body", () => {
    act(() => {
      activeFileStore.set({ activeFilePath: "src/active.ts", activeClusterId: "c1" });
    });
    const { container } = render(<RightRail analysis={analysis} prUrl={prUrl} />);

    // Initially expanded — inner content visible
    expect(container.querySelector(".right-rail__inner")).toBeTruthy();

    // Click collapse
    const btn = screen.getByRole("button", { name: /collapse chat panel/i });
    fireEvent.click(btn);

    // Inner hidden
    expect(container.querySelector(".right-rail__inner")).toBeNull();
    expect(container.querySelector(".right-rail.is-collapsed")).toBeTruthy();
  });

  it("re-expand shows inner body again", () => {
    const { container } = render(<RightRail analysis={analysis} prUrl={prUrl} />);

    const btn = screen.getByRole("button", { name: /collapse chat panel/i });
    fireEvent.click(btn); // collapse
    expect(container.querySelector(".right-rail__inner")).toBeNull();

    fireEvent.click(btn); // expand
    expect(container.querySelector(".right-rail__inner")).toBeTruthy();
  });

  it("shows empty state when no file is active (in chat tab)", () => {
    render(<RightRail analysis={analysis} prUrl={prUrl} />);
    // Switch to chat tab
    fireEvent.click(screen.getByRole("button", { name: /^chat$/i }));
    expect(screen.getByText(/no file selected/i)).toBeTruthy();
  });

  it("does not render annotation filter bar (moved to main pane)", () => {
    const { container } = render(<RightRail analysis={analysis} prUrl={prUrl} />);
    const footer = container.querySelector(".right-rail__filter-footer");
    expect(footer).toBeNull();
  });
});
