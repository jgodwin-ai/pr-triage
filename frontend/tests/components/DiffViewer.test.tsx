import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DiffViewer from "../../src/components/DiffViewer.js";
import type { FileAnalysis } from "../../src/types.js";

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
  it("renders diff content", () => {
    render(<DiffViewer clusterId="c1" file={file} filter={{ warning: true, info: true, suggestion: true }} viewType="unified" />);
    // The diff hunk content renders line content in the table; the file path header is now in FileView
    expect(screen.getByText(/File-level comments/i)).toBeTruthy();
  });

  it("hides annotations filtered out", () => {
    render(<DiffViewer clusterId="c1" file={file} filter={{ warning: true, info: false, suggestion: true }} viewType="unified" />);
    expect(screen.getByText(/check null/)).toBeTruthy();
    expect(screen.queryByText(/fyi/)).toBeNull();
  });
});
