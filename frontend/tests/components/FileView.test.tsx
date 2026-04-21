import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import FileView from "../../src/components/FileView.js";
import { viewedStore } from "../../src/state/viewedStore.js";
import { makeCluster, makeFileAnalysis } from "../helpers.js";

// IntersectionObserver is not implemented in jsdom. Each test case can pull
// `entries` and trigger intersection by hand via the captured callback.
type Cb = (entries: IntersectionObserverEntry[]) => void;
const observers: Array<{ cb: Cb; targets: Element[] }> = [];

class MockIntersectionObserver {
  cb: Cb;
  targets: Element[] = [];
  constructor(cb: Cb) {
    this.cb = cb;
    observers.push({ cb, targets: this.targets });
  }
  observe(el: Element) { this.targets.push(el); }
  disconnect() {}
  unobserve() {}
  takeRecords() { return []; }
  root = null;
  rootMargin = "";
  thresholds = [];
}

function fireIntersection(isIntersecting: boolean) {
  // Trigger every observer created during the test as if its target entered view
  for (const o of observers) {
    const entries = o.targets.map(
      (t) => ({ isIntersecting, target: t } as unknown as IntersectionObserverEntry),
    );
    o.cb(entries);
  }
}

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
  observers.length = 0;
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  vi.stubGlobal("localStorage", makeLocalStorageMock());
  viewedStore.loadFor("https://github.com/test/repo/pull/1", "sha-test");
});

describe("FileView", () => {
  const cluster = makeCluster({ id: "c1" });
  const file = makeFileAnalysis({ path: "src/foo.ts", impactScore: 4 });

  it("shows the placeholder before the section intersects the viewport", () => {
    render(<FileView cluster={cluster} file={file} />);
    expect(screen.getByText(/Loading diff/i)).toBeTruthy();
  });

  it("mounts the diff once the section intersects", () => {
    render(<FileView cluster={cluster} file={file} />);
    expect(screen.getByText(/Loading diff/i)).toBeTruthy();

    act(() => fireIntersection(true));

    expect(screen.queryByText(/Loading diff/i)).toBeNull();
    // DiffViewer renders the file-level comment thread heading
    expect(screen.getByText(/File-level comments/i)).toBeTruthy();
  });

  it("force-mounts when a matching pr-triage:mount-file event fires", () => {
    render(<FileView cluster={cluster} file={file} />);
    expect(screen.getByText(/Loading diff/i)).toBeTruthy();

    act(() => {
      window.dispatchEvent(
        new CustomEvent("pr-triage:mount-file", {
          detail: { clusterId: "c1", path: "src/foo.ts" },
        }),
      );
    });

    expect(screen.queryByText(/Loading diff/i)).toBeNull();
  });

  it("ignores mount events targeting a different file", () => {
    render(<FileView cluster={cluster} file={file} />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent("pr-triage:mount-file", {
          detail: { clusterId: "c1", path: "some/other/file.ts" },
        }),
      );
    });

    expect(screen.getByText(/Loading diff/i)).toBeTruthy();
  });

  it("toggles viewed state via the checkbox", () => {
    const { container } = render(<FileView cluster={cluster} file={file} />);
    const viewedCheckbox = container.querySelector(".file-view__viewed-toggle input") as HTMLInputElement;
    expect(viewedCheckbox.checked).toBe(false);
    fireEvent.click(viewedCheckbox);
    expect(viewedStore.isViewed("c1", "src/foo.ts")).toBe(true);
    fireEvent.click(viewedCheckbox);
    expect(viewedStore.isViewed("c1", "src/foo.ts")).toBe(false);
  });

  it("renders +added / −removed diff stats in the header", () => {
    const f = makeFileAnalysis({
      path: "src/x.ts",
      // 3 additions, 2 deletions (hunk header + file headers ignored)
      diff:
        "--- a/src/x.ts\n+++ b/src/x.ts\n@@ -1,4 +1,5 @@\n ctx\n-removed1\n-removed2\n+added1\n+added2\n+added3\n ctx2",
    });
    render(<FileView cluster={cluster} file={f} />);
    expect(screen.getByText("+3")).toBeTruthy();
    expect(screen.getByText("−2")).toBeTruthy();
  });

  it("switches between unified and split view", () => {
    render(<FileView cluster={cluster} file={file} />);
    // Mount the diff so view-type toggle has an effect we can observe
    act(() => fireIntersection(true));
    const toggle = screen.getByLabelText("Split view") as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(true);
  });
});
