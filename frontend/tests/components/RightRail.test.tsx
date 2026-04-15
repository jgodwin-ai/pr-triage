import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import RightRail from "../../src/components/RightRail.js";
import { activeFileStore } from "../../src/state/activeFileStore.js";
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

beforeEach(() => {
  vi.stubGlobal("localStorage", makeLocalStorageMock());
  activeFileStore.set({ activeFilePath: null, activeClusterId: null });
});

describe("RightRail", () => {
  const analysis = makeAnalysis({
    clusters: [
      makeCluster({
        id: "c1",
        files: [makeFileAnalysis({ path: "src/active.ts" })],
      }),
    ],
  });

  it("renders the collapse toggle button", () => {
    render(<RightRail analysis={analysis} />);
    expect(screen.getByRole("button", { name: /collapse chat panel/i })).toBeTruthy();
  });

  it("shows active file path in header when file is active", () => {
    act(() => {
      activeFileStore.set({ activeFilePath: "src/active.ts", activeClusterId: "c1" });
    });
    render(<RightRail analysis={analysis} />);
    expect(screen.getByText("src/active.ts")).toBeTruthy();
  });

  it("shows muted hint text", () => {
    act(() => {
      activeFileStore.set({ activeFilePath: "src/active.ts", activeClusterId: "c1" });
    });
    render(<RightRail analysis={analysis} />);
    expect(screen.getByText(/scroll up in the main pane/i)).toBeTruthy();
  });

  it("collapse toggle hides the inner body", () => {
    act(() => {
      activeFileStore.set({ activeFilePath: "src/active.ts", activeClusterId: "c1" });
    });
    const { container } = render(<RightRail analysis={analysis} />);

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
    const { container } = render(<RightRail analysis={analysis} />);

    const btn = screen.getByRole("button", { name: /collapse chat panel/i });
    fireEvent.click(btn); // collapse
    expect(container.querySelector(".right-rail__inner")).toBeNull();

    fireEvent.click(btn); // expand
    expect(container.querySelector(".right-rail__inner")).toBeTruthy();
  });

  it("shows empty state when no file is active", () => {
    render(<RightRail analysis={analysis} />);
    expect(screen.getByText(/no file selected/i)).toBeTruthy();
  });
});
