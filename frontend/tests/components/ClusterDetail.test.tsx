import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ClusterDetail from "../../src/components/ClusterDetail.js";
import { makeCluster, makeFileAnalysis } from "../helpers.js";

describe("ClusterDetail", () => {
  it("renders cluster name and summary", () => {
    const cluster = makeCluster({ name: "Database Layer", summary: "Refactored queries" });
    render(<ClusterDetail cluster={cluster} />);
    expect(screen.getByText("Database Layer")).toBeTruthy();
    expect(screen.getByText("Refactored queries")).toBeTruthy();
  });

  it("renders a DiffView for each file", () => {
    const cluster = makeCluster({
      files: [
        makeFileAnalysis({ path: "src/db.ts" }),
        makeFileAnalysis({ path: "src/models.ts" }),
        makeFileAnalysis({ path: "src/queries.ts" }),
      ],
    });
    render(<ClusterDetail cluster={cluster} />);
    expect(screen.getByText("src/db.ts")).toBeTruthy();
    expect(screen.getByText("src/models.ts")).toBeTruthy();
    expect(screen.getByText("src/queries.ts")).toBeTruthy();
  });

  it("shows file count and priority", () => {
    const cluster = makeCluster({
      priority: 2,
      files: [makeFileAnalysis(), makeFileAnalysis({ path: "src/other.ts" })],
    });
    render(<ClusterDetail cluster={cluster} />);
    expect(screen.getByText(/2 file\(s\)/)).toBeTruthy();
    expect(screen.getByText(/priority 2/)).toBeTruthy();
  });
});
