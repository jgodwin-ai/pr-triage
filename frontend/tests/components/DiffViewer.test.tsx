import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import DiffViewer from "../../src/components/DiffViewer.js";
import { reviewDraftStore } from "../../src/state/reviewDraft.js";
import type { FileAnalysis } from "../../src/types.js";

const allOn = { warning: true, info: true, suggestion: true };

beforeEach(() => {
  reviewDraftStore.reset();
});

const file: FileAnalysis = {
  path: "src/foo.ts",
  summary: "adds bar",
  category: "logic",
  impactScore: 3,
  diff: "@@ -1,2 +1,3 @@\n line1\n+line2\n line3",
  annotations: [
    { lineStart: 2, lineEnd: 2, type: "warning", message: "check null" },
    { lineStart: 3, lineEnd: 3, type: "info", message: "fyi" },
  ],
};

describe("DiffViewer", () => {
  it("renders the file-level comment thread heading", () => {
    render(<DiffViewer clusterId="c1" file={file} filter={allOn} viewType="unified" />);
    expect(screen.getByText(/File-level comments/i)).toBeTruthy();
  });

  it("hides annotations filtered out by type", () => {
    render(
      <DiffViewer
        clusterId="c1"
        file={file}
        filter={{ warning: true, info: false, suggestion: true }}
        viewType="unified"
      />
    );
    expect(screen.getByText(/check null/)).toBeTruthy();
    expect(screen.queryByText(/fyi/)).toBeNull();
  });

  it("renders out-of-range annotations in the general-comments fallback section", () => {
    const outOfRange: FileAnalysis = {
      ...file,
      annotations: [
        { lineStart: 2, lineEnd: 2, type: "warning", message: "inline concern" },
        // Line 99 is past the diff's new-file range (which ends at line 3)
        { lineStart: 99, lineEnd: 99, type: "info", message: "orphan note" },
      ],
    };
    const { container } = render(
      <DiffViewer clusterId="c1" file={outOfRange} filter={allOn} viewType="unified" />
    );
    expect(screen.getByText("General comments (line numbers outside the diff)")).toBeTruthy();
    const fallback = container.querySelector(".diff-viewer__fallback-annotations") as HTMLElement;
    expect(fallback.textContent).toContain("orphan note");
    expect(fallback.textContent).not.toContain("inline concern");
  });

  it("normalizes reversed lineStart/lineEnd and still renders inline when in-range", () => {
    const reversed: FileAnalysis = {
      ...file,
      annotations: [
        // lineStart > lineEnd but both endpoints fall inside the hunk's new-file range
        { lineStart: 3, lineEnd: 2, type: "warning", message: "reversed note" },
      ],
    };
    render(<DiffViewer clusterId="c1" file={reversed} filter={allOn} viewType="unified" />);
    expect(screen.getByText(/reversed note/)).toBeTruthy();
    // Rendered inline, not in the fallback section
    expect(screen.queryByText("General comments (line numbers outside the diff)")).toBeNull();
  });

  it("falls back to a pre block when the diff can't be parsed", () => {
    const broken: FileAnalysis = {
      ...file,
      diff: "this is not a diff",
      annotations: [
        { lineStart: 1, lineEnd: 1, type: "warning", message: "still visible" },
      ],
    };
    const { container } = render(
      <DiffViewer clusterId="c1" file={broken} filter={allOn} viewType="unified" />
    );
    expect(container.querySelector(".diff-viewer__fallback")).toBeTruthy();
    expect(screen.getByText(/still visible/)).toBeTruthy();
    // No "general comments" heading when parseDiff fails — every annotation is rendered in the flat fallback
    expect(screen.queryByText("General comments (line numbers outside the diff)")).toBeNull();
  });

  it("renders line-comment widgets from the review-draft store", () => {
    reviewDraftStore.addComment(
      { kind: "line", clusterId: "c1", path: "src/foo.ts", line: 2, side: "RIGHT" },
      "existing line comment",
    );
    render(<DiffViewer clusterId="c1" file={file} filter={allOn} viewType="unified" />);
    expect(screen.getByText("existing line comment")).toBeTruthy();
  });
});
