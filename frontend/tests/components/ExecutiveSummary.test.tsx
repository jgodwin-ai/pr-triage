import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ExecutiveSummary from "../../src/components/ExecutiveSummary.js";
import { makeAnalysis } from "../helpers.js";

describe("ExecutiveSummary", () => {
  it("renders PR title and author", () => {
    const analysis = makeAnalysis();
    render(<ExecutiveSummary analysis={analysis} />);
    expect(screen.getByText("Add new feature")).toBeTruthy();
    expect(screen.getByText(/by testuser/)).toBeTruthy();
  });

  it("renders additions/deletions with correct colors", () => {
    const analysis = makeAnalysis();
    render(<ExecutiveSummary analysis={analysis} />);
    const additions = screen.getByText("+150");
    const deletions = screen.getByText("-30");
    expect(additions.style.color).toBe("green");
    expect(deletions.style.color).toBe("red");
  });

  it("renders executive summary text", () => {
    const analysis = makeAnalysis();
    render(<ExecutiveSummary analysis={analysis} />);
    expect(screen.getByText("This PR adds a new feature for processing data.")).toBeTruthy();
  });

  it("renders time saved when provided", () => {
    const analysis = makeAnalysis({ timeSaved: "15 minutes" });
    render(<ExecutiveSummary analysis={analysis} />);
    expect(screen.getByText(/Estimated time saved: 15 minutes/)).toBeTruthy();
  });

  it("does not render time saved when empty string", () => {
    const analysis = makeAnalysis({ timeSaved: "" });
    render(<ExecutiveSummary analysis={analysis} />);
    expect(screen.queryByText(/Estimated time saved/)).toBeNull();
  });
});
