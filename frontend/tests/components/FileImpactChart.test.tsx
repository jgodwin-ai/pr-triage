import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import FileImpactChart from "../../src/components/FileImpactChart.js";
import { makeFileAnalysis, makeDiffAnnotation } from "../helpers.js";

describe("FileImpactChart", () => {
  it("renders 5 pips with the first N filled to match impactScore", () => {
    const file = makeFileAnalysis({ impactScore: 3, annotations: [] });
    const { container } = render(<FileImpactChart file={file} />);
    const pips = container.querySelectorAll(".file-impact-chart__pip");
    expect(pips).toHaveLength(5);
    const filled = container.querySelectorAll(".file-impact-chart__pip.is-filled");
    expect(filled).toHaveLength(3);
  });

  it("shows em-dash empty marker when no annotations", () => {
    const file = makeFileAnalysis({ impactScore: 2, annotations: [] });
    render(<FileImpactChart file={file} />);
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("renders a severity bar with counts for warning/suggestion/info", () => {
    const file = makeFileAnalysis({
      impactScore: 4,
      annotations: [
        makeDiffAnnotation({ type: "warning" }),
        makeDiffAnnotation({ type: "warning" }),
        makeDiffAnnotation({ type: "suggestion" }),
        makeDiffAnnotation({ type: "info" }),
      ],
    });
    const { container } = render(<FileImpactChart file={file} />);
    expect(container.querySelector(".file-impact-chart__bar--warning")?.textContent).toBe("2");
    expect(container.querySelector(".file-impact-chart__bar--suggestion")?.textContent).toBe("1");
    expect(container.querySelector(".file-impact-chart__bar--info")?.textContent).toBe("1");
  });

  it("omits severity bars for types with zero count", () => {
    const file = makeFileAnalysis({
      impactScore: 1,
      annotations: [makeDiffAnnotation({ type: "warning" })],
    });
    const { container } = render(<FileImpactChart file={file} />);
    expect(container.querySelector(".file-impact-chart__bar--warning")).toBeTruthy();
    expect(container.querySelector(".file-impact-chart__bar--suggestion")).toBeNull();
    expect(container.querySelector(".file-impact-chart__bar--info")).toBeNull();
  });

  it("applies high-impact color modifiers at impact 4 and 5", () => {
    const file4 = makeFileAnalysis({ impactScore: 4, annotations: [] });
    const { container: c4 } = render(<FileImpactChart file={file4} />);
    expect(c4.querySelector(".file-impact-chart__pip.is-filled.impact-4")).toBeTruthy();

    const file5 = makeFileAnalysis({ impactScore: 5, annotations: [] });
    const { container: c5 } = render(<FileImpactChart file={file5} />);
    expect(c5.querySelector(".file-impact-chart__pip.is-filled.impact-5")).toBeTruthy();
  });

  it("includes a tooltip summarizing the counts", () => {
    const file = makeFileAnalysis({
      impactScore: 2,
      annotations: [
        makeDiffAnnotation({ type: "warning" }),
        makeDiffAnnotation({ type: "info" }),
        makeDiffAnnotation({ type: "info" }),
      ],
    });
    const { container } = render(<FileImpactChart file={file} />);
    const chart = container.querySelector(".file-impact-chart") as HTMLElement;
    expect(chart.getAttribute("title")).toContain("1 warning");
    expect(chart.getAttribute("title")).toContain("0 suggestions");
    expect(chart.getAttribute("title")).toContain("2 info");
  });
});
