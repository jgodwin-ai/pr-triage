import { describe, it, expect, vi } from "vitest";
import { parsePrUrl, fetchPR } from "../../src/services/github.js";

describe("parsePrUrl", () => {
  it("parses a valid GitHub PR URL", () => {
    const result = parsePrUrl("https://github.com/octocat/hello-world/pull/42");
    expect(result).toEqual({ owner: "octocat", repo: "hello-world", pullNumber: 42 });
  });

  it("throws on invalid URL", () => {
    expect(() => parsePrUrl("https://example.com/not-a-pr")).toThrow("Invalid GitHub PR URL");
  });

  it("throws on non-PR GitHub URL", () => {
    expect(() => parsePrUrl("https://github.com/octocat/hello-world/issues/42")).toThrow(
      "Invalid GitHub PR URL"
    );
  });
});

describe("fetchPR", () => {
  it("returns PR metadata and file diffs", async () => {
    const mockOctokit = {
      rest: {
        pulls: {
          get: vi.fn().mockResolvedValue({
            data: {
              title: "Fix bug",
              user: { login: "octocat" },
              base: { ref: "main" },
              head: { ref: "fix-branch" },
              additions: 10,
              deletions: 3,
              changed_files: 2,
            },
          }),
          listFiles: vi.fn().mockResolvedValue({
            data: [
              { filename: "src/app.ts", patch: "@@ -1,3 +1,5 @@\n+new line", status: "modified" },
              { filename: "README.md", patch: "@@ -1 +1 @@\n-old\n+new", status: "modified" },
            ],
          }),
        },
      },
    };

    const result = await fetchPR(
      { owner: "octocat", repo: "hello-world", pullNumber: 42 },
      mockOctokit as any
    );

    expect(result.metadata).toEqual({
      url: "https://github.com/octocat/hello-world/pull/42",
      title: "Fix bug",
      author: "octocat",
      baseBranch: "main",
      headBranch: "fix-branch",
      additions: 10,
      deletions: 3,
      fileCount: 2,
    });

    expect(result.files).toHaveLength(2);
    expect(result.files[0]).toEqual({
      filename: "src/app.ts",
      patch: "@@ -1,3 +1,5 @@\n+new line",
    });
  });
});
