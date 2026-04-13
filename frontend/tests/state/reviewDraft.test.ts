import { describe, it, expect, beforeEach } from "vitest";
import { reviewDraftStore } from "../../src/state/reviewDraft.js";

describe("reviewDraftStore", () => {
  beforeEach(() => reviewDraftStore.reset());

  it("adds a comment and returns it by target", () => {
    reviewDraftStore.addComment(
      { kind: "cluster", clusterId: "c1" },
      "Looks good",
    );
    const comments = reviewDraftStore.getComments({ kind: "cluster", clusterId: "c1" });
    expect(comments).toHaveLength(1);
    expect(comments[0].body).toBe("Looks good");
  });

  it("edits a comment", () => {
    const c = reviewDraftStore.addComment({ kind: "cluster", clusterId: "c1" }, "v1");
    reviewDraftStore.updateComment(c.id, "v2");
    expect(reviewDraftStore.getComments(c.target)[0].body).toBe("v2");
  });

  it("removes a comment", () => {
    const c = reviewDraftStore.addComment({ kind: "cluster", clusterId: "c1" }, "x");
    reviewDraftStore.removeComment(c.id);
    expect(reviewDraftStore.all()).toHaveLength(0);
  });

  it("notifies subscribers on change", () => {
    let calls = 0;
    const unsub = reviewDraftStore.subscribe(() => calls++);
    reviewDraftStore.addComment({ kind: "cluster", clusterId: "c1" }, "x");
    expect(calls).toBe(1);
    unsub();
  });
});
