import { describe, it, expect, vi, beforeEach } from "vitest";

// Re-import a fresh store instance per test by resetting module cache.
// Since the store is a singleton, we need to reset between tests.
import { annotationFilterStore } from "../../src/state/annotationFilterStore.js";

beforeEach(() => {
  // Reset to defaults between tests
  annotationFilterStore.set({ warning: true, info: true, suggestion: true });
});

describe("annotationFilterStore", () => {
  it("default state has all filters true", () => {
    const filter = annotationFilterStore.get();
    expect(filter.warning).toBe(true);
    expect(filter.info).toBe(true);
    expect(filter.suggestion).toBe(true);
  });

  it("set() updates the filter", () => {
    annotationFilterStore.set({ warning: false, info: true, suggestion: true });
    const filter = annotationFilterStore.get();
    expect(filter.warning).toBe(false);
    expect(filter.info).toBe(true);
    expect(filter.suggestion).toBe(true);
  });

  it("set() notifies subscribers", () => {
    const listener = vi.fn();
    const unsub = annotationFilterStore.subscribe(listener);
    annotationFilterStore.set({ warning: false, info: false, suggestion: true });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ warning: false, info: false, suggestion: true });
    unsub();
  });

  it("unsubscribed listeners are not called", () => {
    const listener = vi.fn();
    const unsub = annotationFilterStore.subscribe(listener);
    unsub();
    annotationFilterStore.set({ warning: false, info: true, suggestion: false });
    expect(listener).not.toHaveBeenCalled();
  });
});
