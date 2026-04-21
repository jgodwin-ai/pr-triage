import { describe, it, expect } from "vitest";
import { buildReviewPayload } from "../../src/services/github-review.js";

describe("buildReviewPayload", () => {
  it("separates line comments from summary-level comments", () => {
    const { payload, summary } = buildReviewPayload({
      prUrl: "x",
      event: "COMMENT",
      summary: "Overall LGTM",
      comments: [
        { id: "1", createdAt: 0, target: { kind: "line", clusterId: "c1", path: "a.ts", line: 5, side: "RIGHT" }, body: "inline" },
        { id: "2", createdAt: 0, target: { kind: "cluster", clusterId: "c1" }, body: "cluster note" },
        { id: "3", createdAt: 0, target: { kind: "file", clusterId: "c1", path: "b.ts" }, body: "file note" },
        { id: "4", createdAt: 0, target: { kind: "annotation", clusterId: "c1", path: "c.ts", annotationIndex: 2 }, body: "ann note" },
      ],
    });
    expect(payload).toEqual([{ path: "a.ts", line: 5, side: "RIGHT", body: "inline" }]);
    expect(summary).toContain("Overall LGTM");
    expect(summary).toContain("cluster note");
    expect(summary).toContain("file note");
    expect(summary).toContain("ann note");
  });

  it("handles empty draft with empty summary", () => {
    const { payload, summary } = buildReviewPayload({
      prUrl: "x",
      event: "COMMENT",
      summary: "",
      comments: [],
    });
    expect(payload).toEqual([]);
    expect(summary).toBe("");
  });

  it("preserves multiple line comments in order", () => {
    const { payload } = buildReviewPayload({
      prUrl: "x",
      event: "REQUEST_CHANGES",
      summary: "",
      comments: [
        { id: "1", createdAt: 0, target: { kind: "line", clusterId: "c1", path: "a.ts", line: 5, side: "RIGHT" }, body: "first" },
        { id: "2", createdAt: 0, target: { kind: "line", clusterId: "c1", path: "b.ts", line: 10, side: "LEFT" }, body: "second" },
      ],
    });
    expect(payload).toHaveLength(2);
    expect(payload[0].body).toBe("first");
    expect(payload[1].body).toBe("second");
    expect(payload[1].side).toBe("LEFT");
  });
});
