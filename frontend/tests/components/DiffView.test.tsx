import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DiffView from "../../src/components/DiffView.js";
import { makeFileAnalysis, makeDiffAnnotation } from "../helpers.js";

describe("DiffView", () => {
  it("colors added lines green (starts with +)", () => {
    const file = makeFileAnalysis({
      diff: "+added line",
      annotations: [],
    });
    const { container } = render(<DiffView file={file} />);
    const pre = container.querySelector("pre")!;
    const lines = pre.querySelectorAll("div");
    const addedLine = Array.from(lines).find((el) => el.textContent === "+added line");
    expect(addedLine).toBeTruthy();
    expect(addedLine!.style.background).toBe("rgb(230, 255, 236)");
  });

  it("colors removed lines red (starts with -)", () => {
    const file = makeFileAnalysis({
      diff: "-removed line",
      annotations: [],
    });
    const { container } = render(<DiffView file={file} />);
    const pre = container.querySelector("pre")!;
    const lines = pre.querySelectorAll("div");
    const removedLine = Array.from(lines).find((el) => el.textContent === "-removed line");
    expect(removedLine).toBeTruthy();
    expect(removedLine!.style.background).toBe("rgb(255, 235, 233)");
  });

  it("does NOT color +++ / --- / @@ header lines", () => {
    const file = makeFileAnalysis({
      diff: "+++ b/file.ts\n--- a/file.ts\n@@ -1,3 +1,5 @@",
      annotations: [],
    });
    const { container } = render(<DiffView file={file} />);
    const pre = container.querySelector("pre")!;
    const lines = pre.querySelectorAll("div");
    for (const line of Array.from(lines)) {
      expect(line.style.background).toBe("transparent");
    }
  });

  it("renders file path and summary", () => {
    const file = makeFileAnalysis({ path: "src/index.ts", summary: "Entry point changes" });
    render(<DiffView file={file} />);
    expect(screen.getByText("src/index.ts")).toBeTruthy();
    expect(screen.getByText(/Entry point changes/)).toBeTruthy();
  });

  it("renders annotations with correct type styling", () => {
    const file = makeFileAnalysis({
      annotations: [
        makeDiffAnnotation({ type: "warning", message: "Watch out" }),
        makeDiffAnnotation({ type: "suggestion", message: "Consider this", lineStart: 20, lineEnd: 22 }),
        makeDiffAnnotation({ type: "info", message: "FYI", lineStart: 30, lineEnd: 31 }),
      ],
    });
    render(<DiffView file={file} />);
    expect(screen.getByText("[warning]")).toBeTruthy();
    expect(screen.getByText("[suggestion]")).toBeTruthy();
    expect(screen.getByText("[info]")).toBeTruthy();
    expect(screen.getByText(/Watch out/)).toBeTruthy();
    expect(screen.getByText(/Consider this/)).toBeTruthy();
    expect(screen.getByText(/FYI/)).toBeTruthy();
  });

  it("handles empty diff", () => {
    const file = makeFileAnalysis({ diff: "", annotations: [] });
    const { container } = render(<DiffView file={file} />);
    const pre = container.querySelector("pre");
    expect(pre).toBeTruthy();
  });

  it("handles empty annotations array", () => {
    const file = makeFileAnalysis({ annotations: [] });
    render(<DiffView file={file} />);
    expect(screen.queryByText("Annotations:")).toBeNull();
  });
});
