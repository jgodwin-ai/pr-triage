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
});
