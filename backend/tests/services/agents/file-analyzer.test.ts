import { describe, it, expect, vi } from "vitest";
import { analyzeFile, buildFileAnalyzerPrompt } from "../../../src/services/agents/file-analyzer.js";

describe("buildFileAnalyzerPrompt", () => {
  it("builds a prompt with filename and patch", () => {
    const prompt = buildFileAnalyzerPrompt("src/app.ts", "@@ -1,3 +1,5 @@\n+new line");
    expect(prompt).toContain("src/app.ts");
    expect(prompt).toContain("@@ -1,3 +1,5 @@");
    expect(prompt).toContain("category");
    expect(prompt).toContain("impactScore");
  });
});

describe("analyzeFile", () => {
  it("calls Claude and returns a FileAnalysis", async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                path: "src/app.ts",
                summary: "Adds error handling to the main app entry",
                category: "logic",
                impactScore: 3,
                annotations: [],
              }),
            },
          ],
        }),
      },
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

    expect(mockClient.messages.create).toHaveBeenCalledOnce();
  });

  it("handles markdown-wrapped JSON from Claude", async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: "text",
              text: '```json\n' + JSON.stringify({
                path: "src/utils.ts",
                summary: "Adds utility helpers",
                category: "logic",
                impactScore: 2,
                annotations: [],
              }) + '\n```',
            },
          ],
        }),
      },
    };

    const result = await analyzeFile(
      { filename: "src/utils.ts", patch: "@@ diff @@" },
      mockClient as any
    );

    expect(result.path).toBe("src/utils.ts");
    expect(result.category).toBe("logic");
  });

  it("throws when Claude returns empty content array", async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({ content: [] }),
      },
    };

    await expect(
      analyzeFile({ filename: "a.ts", patch: "diff" }, mockClient as any)
    ).rejects.toThrow("empty response content");
  });

  it("throws when Claude returns non-text block", async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "tool_use", id: "t1", name: "fn", input: {} }],
        }),
      },
    };

    await expect(
      analyzeFile({ filename: "a.ts", patch: "diff" }, mockClient as any)
    ).rejects.toThrow("non-text content block");
  });

  it("throws descriptive error when Claude returns invalid JSON", async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "Sure! Here is the analysis..." }],
        }),
      },
    };

    await expect(
      analyzeFile({ filename: "a.ts", patch: "diff" }, mockClient as any)
    ).rejects.toThrow("Failed to parse Claude response as JSON");
  });
});
