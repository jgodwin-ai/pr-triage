import { describe, it, expect, vi } from "vitest";
import { clusterFiles, buildClusteringPrompt } from "../../../src/services/agents/clustering.js";
import type { FileAnalysis } from "../../../src/types.js";

const sampleFiles: FileAnalysis[] = [
  {
    path: "src/auth/login.ts",
    summary: "Adds password validation",
    category: "logic",
    impactScore: 4,
    diff: "@@ diff @@",
    annotations: [],
  },
  {
    path: "src/auth/session.ts",
    summary: "Adds session expiry check",
    category: "logic",
    impactScore: 3,
    diff: "@@ diff @@",
    annotations: [],
  },
  {
    path: "README.md",
    summary: "Updates setup instructions",
    category: "docs",
    impactScore: 1,
    diff: "@@ diff @@",
    annotations: [],
  },
];

describe("buildClusteringPrompt", () => {
  it("includes all file summaries", () => {
    const prompt = buildClusteringPrompt(sampleFiles);
    expect(prompt).toContain("src/auth/login.ts");
    expect(prompt).toContain("src/auth/session.ts");
    expect(prompt).toContain("README.md");
  });
});

describe("clusterFiles", () => {
  it("calls LLMClient and returns ChangeCluster array", async () => {
    const mockClient = {
      complete: vi.fn().mockResolvedValue(JSON.stringify({
        clusters: [
          {
            id: "auth-changes",
            name: "Authentication improvements",
            summary: "Adds password validation and session expiry",
            tag: "needs-review",
            priority: 1,
            filePaths: ["src/auth/login.ts", "src/auth/session.ts"],
          },
          {
            id: "docs-update",
            name: "Documentation update",
            summary: "Updates README setup instructions",
            tag: "low-risk",
            priority: 2,
            filePaths: ["README.md"],
          },
        ],
      })),
    };

    const result = await clusterFiles(sampleFiles, mockClient as any);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Authentication improvements");
    expect(result[0].files).toHaveLength(2);
    expect(result[0].files[0].path).toBe("src/auth/login.ts");
    expect(result[1].files).toHaveLength(1);
    // Tag is derived from files, not taken from LLM output
    expect(result[0].tag).toBe("needs-review"); // max impact 4
    expect(result[1].tag).toBe("low-risk"); // docs only, impact 1
  });

  it("drops filePaths that don't match any input file", async () => {
    const mockClient = {
      complete: vi.fn().mockResolvedValue(JSON.stringify({
        clusters: [
          {
            id: "cluster-1",
            name: "Mixed cluster",
            summary: "Has known and unknown files",
            tag: "needs-review",
            priority: 1,
            filePaths: ["src/auth/login.ts", "nonexistent/file.ts"],
          },
        ],
      })),
    };

    const result = await clusterFiles(sampleFiles, mockClient as any);
    expect(result).toHaveLength(1);
    expect(result[0].files).toHaveLength(1);
    expect(result[0].files[0].path).toBe("src/auth/login.ts");
  });

  it("returns empty array when LLMClient returns empty clusters", async () => {
    const mockClient = {
      complete: vi.fn().mockResolvedValue(JSON.stringify({ clusters: [] })),
    };

    const result = await clusterFiles(sampleFiles, mockClient as any);
    expect(result).toHaveLength(0);
  });

  it("throws when LLMClient returns invalid JSON", async () => {
    const mockClient = {
      complete: vi.fn().mockResolvedValue("I'll group these files..."),
    };

    await expect(clusterFiles(sampleFiles, mockClient as any)).rejects.toThrow(
      "Failed to parse LLM response as JSON"
    );
  });
});
