import { describe, it, expect, beforeEach } from "vitest";
import { activeClusterStore } from "../../src/state/activeClusterStore.js";

beforeEach(() => {
  // Reset store state between tests
  activeClusterStore.set(null);
});

describe("activeClusterStore", () => {
  it("starts with null", () => {
    expect(activeClusterStore.get()).toBeNull();
  });

  it("set and get", () => {
    activeClusterStore.set("cluster-1");
    expect(activeClusterStore.get()).toBe("cluster-1");
  });

  it("set to null", () => {
    activeClusterStore.set("cluster-1");
    activeClusterStore.set(null);
    expect(activeClusterStore.get()).toBeNull();
  });

  it("notifies subscribers on set", () => {
    const calls: Array<string | null> = [];
    const unsub = activeClusterStore.subscribe(() => {
      calls.push(activeClusterStore.get());
    });

    activeClusterStore.set("cluster-a");
    activeClusterStore.set("cluster-b");
    unsub();
    activeClusterStore.set("cluster-c"); // should not notify after unsub

    expect(calls).toEqual(["cluster-a", "cluster-b"]);
  });

  it("unsubscribe stops notifications", () => {
    let count = 0;
    const unsub = activeClusterStore.subscribe(() => { count++; });
    activeClusterStore.set("x");
    unsub();
    activeClusterStore.set("y");
    expect(count).toBe(1);
  });
});
