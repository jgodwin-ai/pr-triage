import { describe, it, expect, beforeEach } from "vitest";
import { activeFileStore } from "../../src/state/activeFileStore.js";

beforeEach(() => {
  activeFileStore.set({ activeFilePath: null, activeClusterId: null });
});

describe("activeFileStore", () => {
  it("starts with null values", () => {
    const state = activeFileStore.get();
    expect(state.activeFilePath).toBeNull();
    expect(state.activeClusterId).toBeNull();
  });

  it("set and get", () => {
    activeFileStore.set({ activeFilePath: "src/foo.ts", activeClusterId: "c1" });
    const state = activeFileStore.get();
    expect(state.activeFilePath).toBe("src/foo.ts");
    expect(state.activeClusterId).toBe("c1");
  });

  it("notifies subscribers on set", () => {
    const snapshots: Array<{ activeFilePath: string | null; activeClusterId: string | null }> = [];
    const unsub = activeFileStore.subscribe(() => {
      snapshots.push(activeFileStore.get());
    });

    activeFileStore.set({ activeFilePath: "src/a.ts", activeClusterId: "c1" });
    activeFileStore.set({ activeFilePath: "src/b.ts", activeClusterId: "c2" });
    unsub();
    activeFileStore.set({ activeFilePath: "src/c.ts", activeClusterId: "c3" }); // no notify

    expect(snapshots).toHaveLength(2);
    expect(snapshots[0].activeFilePath).toBe("src/a.ts");
    expect(snapshots[1].activeFilePath).toBe("src/b.ts");
  });

  it("unsubscribe stops notifications", () => {
    let count = 0;
    const unsub = activeFileStore.subscribe(() => { count++; });
    activeFileStore.set({ activeFilePath: "x.ts", activeClusterId: "c" });
    unsub();
    activeFileStore.set({ activeFilePath: "y.ts", activeClusterId: "c" });
    expect(count).toBe(1);
  });
});
