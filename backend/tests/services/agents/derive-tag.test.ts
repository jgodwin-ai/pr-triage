import { describe, it, expect } from "vitest";
import { deriveTag } from "../../../src/services/agents/derive-tag.js";
import type { FileAnalysis } from "../../../src/types.js";

function file(partial: Partial<FileAnalysis>): FileAnalysis {
  return {
    path: "a.ts",
    summary: "",
    category: "logic",
    impactScore: 1,
    diff: "",
    annotations: [],
    ...partial,
  };
}

describe("deriveTag", () => {
  it("returns needs-review when any file has impact >= 4", () => {
    expect(deriveTag([file({ impactScore: 4, category: "config" })])).toBe("needs-review");
    expect(deriveTag([file({ impactScore: 5, category: "docs" })])).toBe("needs-review");
  });

  it("returns style-only for a cluster of only style changes", () => {
    expect(
      deriveTag([
        file({ category: "style", impactScore: 1 }),
        file({ category: "style", impactScore: 2 }),
      ])
    ).toBe("style-only");
  });

  it("returns boilerplate for a cluster of only boilerplate changes", () => {
    expect(
      deriveTag([
        file({ category: "boilerplate", impactScore: 1 }),
        file({ category: "boilerplate", impactScore: 3 }),
      ])
    ).toBe("boilerplate");
  });

  it("returns needs-review for impact 3 logic changes", () => {
    expect(
      deriveTag([file({ category: "logic", impactScore: 3 })])
    ).toBe("needs-review");
  });

  it("returns low-risk for impact 2 or 3 without logic files", () => {
    expect(
      deriveTag([file({ category: "config", impactScore: 3 })])
    ).toBe("low-risk");
    expect(
      deriveTag([
        file({ category: "config", impactScore: 2 }),
        file({ category: "docs", impactScore: 1 }),
      ])
    ).toBe("low-risk");
  });

  it("returns low-risk for empty clusters", () => {
    expect(deriveTag([])).toBe("low-risk");
  });

  it("mixed style + logic at low impact is low-risk, not style-only", () => {
    expect(
      deriveTag([
        file({ category: "style", impactScore: 1 }),
        file({ category: "logic", impactScore: 2 }),
      ])
    ).toBe("low-risk");
  });
});
