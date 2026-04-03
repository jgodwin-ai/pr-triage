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
    const diffCode = container.querySelector(".diff-code")!;
    const lines = diffCode.querySelectorAll("div");
    const addedLine = Array.from(lines).find((el) => el.textContent === "+added line");
    expect(addedLine).toBeTruthy();
    expect(addedLine!.className).toContain("diff-line--added");
  });

  it("colors removed lines red (starts with -)", () => {
    const file = makeFileAnalysis({
      diff: "-removed line",
      annotations: [],
    });
    const { container } = render(<DiffView file={file} />);
    const diffCode = container.querySelector(".diff-code")!;
    const lines = diffCode.querySelectorAll("div");
    const removedLine = Array.from(lines).find((el) => el.textContent === "-removed line");
    expect(removedLine).toBeTruthy();
    expect(removedLine!.className).toContain("diff-line--removed");
  });

  it("does NOT color +++ / --- / @@ header lines", () => {
    const file = makeFileAnalysis({
      diff: "+++ b/file.ts\n--- a/file.ts\n@@ -1,3 +1,5 @@",
      annotations: [],
    });
    const { container } = render(<DiffView file={file} />);
    const diffCode = container.querySelector(".diff-code")!;
    const lines = diffCode.querySelectorAll("div");
    for (const line of Array.from(lines)) {
      expect(line.className).not.toContain("diff-line--added");
      expect(line.className).not.toContain("diff-line--removed");
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
    const { container } = render(<DiffView file={file} />);
    const warningSpan = container.querySelector(".annotation-type--warning");
    expect(warningSpan).toBeTruthy();
    expect(warningSpan!.textContent).toBe("warning");
    const suggestionSpan = container.querySelector(".annotation-type--suggestion");
    expect(suggestionSpan).toBeTruthy();
    expect(suggestionSpan!.textContent).toBe("suggestion");
    const infoSpan = container.querySelector(".annotation-type--info");
    expect(infoSpan).toBeTruthy();
    expect(infoSpan!.textContent).toBe("info");
    expect(screen.getByText(/Watch out/)).toBeTruthy();
    expect(screen.getByText(/Consider this/)).toBeTruthy();
    expect(screen.getByText(/FYI/)).toBeTruthy();
  });

  it("handles empty diff", () => {
    const file = makeFileAnalysis({ diff: "", annotations: [] });
    const { container } = render(<DiffView file={file} />);
    const diffCode = container.querySelector(".diff-code");
    expect(diffCode).toBeTruthy();
  });

  it("handles empty annotations array", () => {
    const file = makeFileAnalysis({ annotations: [] });
    render(<DiffView file={file} />);
    expect(screen.queryByText("Annotations")).toBeNull();
  });
});
