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

  it("parses URL with trailing path segments like /files", () => {
    const result = parsePrUrl("https://github.com/octocat/hello-world/pull/42/files");
    expect(result).toEqual({ owner: "octocat", repo: "hello-world", pullNumber: 42 });
  });

  it("parses URL with query params", () => {
    const result = parsePrUrl("https://github.com/octocat/hello-world/pull/42?diff=unified");
    expect(result).toEqual({ owner: "octocat", repo: "hello-world", pullNumber: 42 });
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
              head: { ref: "fix-branch", sha: "deadbeef" },
              additions: 10,
              deletions: 3,
              changed_files: 2,
            },
          }),
          listFiles: vi.fn(),
        },
      },
      paginate: vi.fn().mockResolvedValue([
        { filename: "src/app.ts", patch: "@@ -1,3 +1,5 @@\n+new line", status: "modified" },
        { filename: "README.md", patch: "@@ -1 +1 @@\n-old\n+new", status: "modified" },
      ]),
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
      headSha: "deadbeef",
    });

    expect(result.files).toHaveLength(2);
    expect(result.files[0]).toEqual({
      filename: "src/app.ts",
      patch: "@@ -1,3 +1,5 @@\n+new line",
    });
  });

  it("sets author to 'unknown' when user is null", async () => {
    const mockOctokit = {
      rest: {
        pulls: {
          get: vi.fn().mockResolvedValue({
            data: {
              title: "Bot PR",
              user: null,
              base: { ref: "main" },
              head: { ref: "bot-branch" },
              additions: 5,
              deletions: 1,
              changed_files: 1,
            },
          }),
          listFiles: vi.fn(),
        },
      },
      paginate: vi.fn().mockResolvedValue([]),
    };

    const result = await fetchPR(
      { owner: "octocat", repo: "repo", pullNumber: 1 },
      mockOctokit as any
    );

    expect(result.metadata.author).toBe("unknown");
  });

  it("includes files without patches with a placeholder", async () => {
    const mockOctokit = {
      rest: {
        pulls: {
          get: vi.fn().mockResolvedValue({
            data: {
              title: "Add image",
              user: { login: "dev" },
              base: { ref: "main" },
              head: { ref: "add-img" },
              additions: 0,
              deletions: 0,
              changed_files: 2,
            },
          }),
          listFiles: vi.fn(),
        },
      },
      paginate: vi.fn().mockResolvedValue([
        { filename: "logo.png", status: "added" },
        { filename: "src/app.ts", patch: "@@ diff @@", status: "modified" },
      ]),
    };

    const result = await fetchPR(
      { owner: "o", repo: "r", pullNumber: 1 },
      mockOctokit as any
    );

    expect(result.files).toHaveLength(2);
    const bin = result.files.find((f) => f.filename === "logo.png");
    expect(bin?.patch).toMatch(/No diff available/);
    const code = result.files.find((f) => f.filename === "src/app.ts");
    expect(code?.patch).toBe("@@ diff @@");
  });

  it("paginates when more than 100 files", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      filename: `file${i}.ts`,
      patch: `@@ diff ${i} @@`,
    }));
    const page2 = [
      { filename: "file100.ts", patch: "@@ diff 100 @@" },
    ];

    const mockOctokit = {
      rest: {
        pulls: {
          get: vi.fn().mockResolvedValue({
            data: {
              title: "Big PR",
              user: { login: "dev" },
              base: { ref: "main" },
              head: { ref: "big" },
              additions: 500,
              deletions: 100,
              changed_files: 101,
            },
          }),
          listFiles: vi.fn(),
        },
      },
      paginate: vi.fn().mockResolvedValue([...page1, ...page2]),
    };

    const result = await fetchPR(
      { owner: "o", repo: "r", pullNumber: 1 },
      mockOctokit as any
    );

    expect(result.files).toHaveLength(101);
    expect(mockOctokit.paginate).toHaveBeenCalledTimes(1);
  });
});
