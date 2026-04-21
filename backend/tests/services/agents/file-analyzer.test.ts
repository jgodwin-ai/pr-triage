import { describe, it, expect, vi } from "vitest";
import {
  analyzeFile,
  buildFileAnalyzerPrompt,
  annotatePatchWithLineNumbers,
} from "../../../src/services/agents/file-analyzer.js";

describe("annotatePatchWithLineNumbers", () => {
  it("numbers insertion lines for a new-file diff", () => {
    const patch = "@@ -0,0 +1,3 @@\n+first\n+second\n+third";
    const out = annotatePatchWithLineNumbers(patch);
    const lines = out.split("\n");
    expect(lines[0]).toContain("@@ -0,0 +1,3 @@");
    expect(lines[1]).toMatch(/^\s*1\s+\+first$/);
    expect(lines[2]).toMatch(/^\s*2\s+\+second$/);
    expect(lines[3]).toMatch(/^\s*3\s+\+third$/);
  });

  it("skips numbering on deletion lines", () => {
    const patch = "@@ -1,2 +1,1 @@\n-old\n+new";
    const out = annotatePatchWithLineNumbers(patch);
    const lines = out.split("\n");
    expect(lines[1]).not.toMatch(/^\s*\d/);
    expect(lines[1]).toMatch(/-old$/);
    expect(lines[2]).toMatch(/^\s*1\s+\+new$/);
  });

  it("numbers context lines and continues counting correctly", () => {
    const patch = "@@ -1,3 +1,3 @@\n ctx1\n-removed\n+added\n ctx2";
    const out = annotatePatchWithLineNumbers(patch);
    const lines = out.split("\n");
    expect(lines[1]).toMatch(/^\s*1\s+ ctx1$/);
    expect(lines[2]).toMatch(/-removed$/);
    expect(lines[2]).not.toMatch(/^\s*\d/);
    expect(lines[3]).toMatch(/^\s*2\s+\+added$/);
    expect(lines[4]).toMatch(/^\s*3\s+ ctx2$/);
  });

  it("resets the counter at each new hunk", () => {
    const patch =
      "@@ -1,1 +1,1 @@\n+a\n@@ -50,1 +50,2 @@\n+b\n+c";
    const out = annotatePatchWithLineNumbers(patch);
    const lines = out.split("\n");
    expect(lines[1]).toMatch(/^\s*1\s+\+a$/);
    expect(lines[3]).toMatch(/^\s*50\s+\+b$/);
    expect(lines[4]).toMatch(/^\s*51\s+\+c$/);
  });
});

describe("buildFileAnalyzerPrompt", () => {
  it("builds a prompt with filename and a numbered patch", () => {
    const prompt = buildFileAnalyzerPrompt(
      "src/app.ts",
      "@@ -1,3 +1,5 @@\n+new line",
    );
    expect(prompt).toContain("src/app.ts");
    expect(prompt).toContain("@@ -1,3 +1,5 @@");
    expect(prompt).toMatch(/\s1\s+\+new line/);
    expect(prompt).toContain("line number in the NEW file");
    expect(prompt).toContain("category");
    expect(prompt).toContain("impactScore");
  });
});

describe("analyzeFile", () => {
  it("calls LLMClient and returns a FileAnalysis", async () => {
    const mockClient = {
      complete: vi.fn().mockResolvedValue(JSON.stringify({
        path: "src/app.ts",
        summary: "Adds error handling to the main app entry",
        category: "logic",
        impactScore: 3,
        annotations: [],
      })),
    };

    const result = await analyzeFile(
      { filename: "src/app.ts", patch: "@@ diff content @@" },
      mockClient as any
    );

    expect(result.path).toBe("src/app.ts");
    expect(result.summary).toBe("Adds error handling to the main app entry");
    expect(result.category).toBe("logic");
    expect(result.impactScore).toBe(3);
    expect(result.diff).toBe("@@ diff content @@");

    expect(mockClient.complete).toHaveBeenCalledOnce();
  });

  it("handles markdown-wrapped JSON from LLMClient", async () => {
    const mockClient = {
      complete: vi.fn().mockResolvedValue('```json\n' + JSON.stringify({
        path: "src/utils.ts",
        summary: "Adds utility helpers",
        category: "logic",
        impactScore: 2,
        annotations: [],
      }) + '\n```'),
    };

    const result = await analyzeFile(
      { filename: "src/utils.ts", patch: "@@ diff @@" },
      mockClient as any
    );

    expect(result.path).toBe("src/utils.ts");
    expect(result.category).toBe("logic");
  });

  it("throws descriptive error when LLMClient returns invalid JSON", async () => {
    const mockClient = {
      complete: vi.fn().mockResolvedValue("Sure! Here is the analysis..."),
    };

    await expect(
      analyzeFile({ filename: "a.ts", patch: "diff" }, mockClient as any)
    ).rejects.toThrow("Failed to parse LLM response as JSON");
  });
});
