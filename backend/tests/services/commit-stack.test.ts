import { describe, it, expect, vi } from "vitest";
import { buildCommitStack } from "../../src/services/commit-stack.js";

/**
 * Helper: build a mock octokit client whose response shapes match what
 * commit-stack.ts consumes:
 *   - rest.pulls.get → returns base.sha + head.sha + html_url
 *   - rest.pulls.listCommits (via paginate) → ordered chronologically
 *   - rest.repos.getCommit → per-commit `files` array w/ filename, additions, deletions
 */
function makeMockOctokit(opts: {
  prData: any;
  commits: Array<{ sha: string; commit: { message: string } }>;
  perCommitFiles: Record<string, Array<{ filename: string; additions: number; deletions: number; status?: string }>>;
}) {
  const getCommit = vi.fn().mockImplementation(async (args: { owner: string; repo: string; ref: string }) => {
    const files = opts.perCommitFiles[args.ref] ?? [];
    return { data: { files } };
  });

  return {
    rest: {
      pulls: {
        get: vi.fn().mockResolvedValue({ data: opts.prData }),
        listCommits: vi.fn(),
      },
      repos: {
        getCommit,
      },
    },
    paginate: vi.fn().mockImplementation(async (fn: any) => {
      // Only one paginated call in this service: pulls.listCommits.
      if (fn === undefined) return [];
      return opts.commits;
    }),
  };
}

describe("buildCommitStack", () => {
  it("returns a 3-level stack in chronological order with correct parentSha chain", async () => {
    const octokit = makeMockOctokit({
      prData: {
        html_url: "https://github.com/o/r/pull/1",
        base: { sha: "base000" },
        head: { sha: "ccc333" },
      },
      commits: [
        { sha: "aaa111", commit: { message: "feat: add user model with substantial changes\n\nMore details here." } },
        { sha: "bbb222", commit: { message: "feat: add login route with substantial changes" } },
        { sha: "ccc333", commit: { message: "feat: add logout flow with real changes here" } },
      ],
      perCommitFiles: {
        aaa111: [{ filename: "src/user.ts", additions: 50, deletions: 0, status: "added" }],
        bbb222: [{ filename: "src/login.ts", additions: 40, deletions: 0, status: "added" }],
        ccc333: [{ filename: "src/logout.ts", additions: 30, deletions: 0, status: "added" }],
      },
    });

    const stack = await buildCommitStack({
      owner: "o",
      repo: "r",
      number: 1,
      githubToken: "t",
    } as any, octokit as any);

    expect(stack.prUrl).toBe("https://github.com/o/r/pull/1");
    expect(stack.baseSha).toBe("base000");
    expect(stack.headSha).toBe("ccc333");
    expect(stack.levels).toHaveLength(3);

    // Level 0: parent is the PR base
    expect(stack.levels[0].sha).toBe("aaa111");
    expect(stack.levels[0].parentSha).toBe("base000");
    expect(stack.levels[0].shortSha).toBe("aaa111".slice(0, 7));
    expect(stack.levels[0].message).toBe("feat: add user model with substantial changes");
    expect(stack.levels[0].kind).toBe("feature");
    expect(stack.levels[0].status).toBe("pending");
    expect(stack.levels[0].files).toEqual(["src/user.ts"]);

    // Level 1: parent is level 0
    expect(stack.levels[1].sha).toBe("bbb222");
    expect(stack.levels[1].parentSha).toBe("aaa111");
    expect(stack.levels[1].files).toEqual(["src/login.ts"]);

    // Level 2: parent is level 1
    expect(stack.levels[2].sha).toBe("ccc333");
    expect(stack.levels[2].parentSha).toBe("bbb222");
    expect(stack.levels[2].files).toEqual(["src/logout.ts"]);
  });

  it("returns an empty levels array when the PR has no commits", async () => {
    const octokit = makeMockOctokit({
      prData: {
        html_url: "https://github.com/o/r/pull/2",
        base: { sha: "base999" },
        head: { sha: "base999" },
      },
      commits: [],
      perCommitFiles: {},
    });

    const stack = await buildCommitStack({
      owner: "o",
      repo: "r",
      number: 2,
    } as any, octokit as any);

    expect(stack.levels).toEqual([]);
    expect(stack.baseSha).toBe("base999");
  });

  it("classifies fixup/wip/dependency-bump commits as noise and forwards reason", async () => {
    const octokit = makeMockOctokit({
      prData: {
        html_url: "https://github.com/o/r/pull/3",
        base: { sha: "base000" },
        head: { sha: "ddd444" },
      },
      commits: [
        { sha: "aaa111", commit: { message: "fixup! feat: add user model" } },
        { sha: "bbb222", commit: { message: "WIP: still hacking on login" } },
        { sha: "ccc333", commit: { message: "chore(deps): bump lodash from 4.17.20 to 4.17.21" } },
        { sha: "ddd444", commit: { message: "feat: real feature with enough lines to be a feature commit" } },
      ],
      perCommitFiles: {
        aaa111: [{ filename: "src/user.ts", additions: 10, deletions: 0 }],
        bbb222: [{ filename: "src/login.ts", additions: 20, deletions: 0 }],
        ccc333: [{ filename: "package.json", additions: 1, deletions: 1 }],
        ddd444: [{ filename: "src/feature.ts", additions: 60, deletions: 0 }],
      },
    });

    const stack = await buildCommitStack({
      owner: "o",
      repo: "r",
      number: 3,
    } as any, octokit as any);

    expect(stack.levels[0].kind).toBe("noise");
    expect(stack.levels[0].noiseReason).toBe("fixup commit");

    expect(stack.levels[1].kind).toBe("noise");
    expect(stack.levels[1].noiseReason).toBe("wip commit");

    expect(stack.levels[2].kind).toBe("noise");
    expect(stack.levels[2].noiseReason).toBe("dependency bump");

    expect(stack.levels[3].kind).toBe("feature");
    expect(stack.levels[3].noiseReason).toBeUndefined();
  });

  it("classifies a lockfile-only commit as noise via the diff-based heuristic", async () => {
    const octokit = makeMockOctokit({
      prData: {
        html_url: "https://github.com/o/r/pull/4",
        base: { sha: "base000" },
        head: { sha: "aaa111" },
      },
      commits: [
        { sha: "aaa111", commit: { message: "regenerate lockfile" } },
      ],
      perCommitFiles: {
        aaa111: [{ filename: "package-lock.json", additions: 200, deletions: 100 }],
      },
    });

    const stack = await buildCommitStack({
      owner: "o",
      repo: "r",
      number: 4,
    } as any, octokit as any);

    expect(stack.levels).toHaveLength(1);
    expect(stack.levels[0].kind).toBe("noise");
    expect(stack.levels[0].noiseReason).toBe("lockfile-only");
    expect(stack.levels[0].files).toEqual(["package-lock.json"]);
  });

  it("uses commit subject only (first line) as message", async () => {
    const octokit = makeMockOctokit({
      prData: {
        html_url: "https://github.com/o/r/pull/5",
        base: { sha: "base000" },
        head: { sha: "aaa111" },
      },
      commits: [
        {
          sha: "aaa111",
          commit: {
            message: "feat: add caching layer\n\nThis is a long body explaining the design.\n\n- bullet\n- bullet",
          },
        },
      ],
      perCommitFiles: {
        aaa111: [{ filename: "src/cache.ts", additions: 60, deletions: 2 }],
      },
    });

    const stack = await buildCommitStack({
      owner: "o",
      repo: "r",
      number: 5,
    } as any, octokit as any);

    expect(stack.levels[0].message).toBe("feat: add caching layer");
  });

  it("returns per-commit files (not full PR files) for each level", async () => {
    const octokit = makeMockOctokit({
      prData: {
        html_url: "https://github.com/o/r/pull/6",
        base: { sha: "base000" },
        head: { sha: "bbb222" },
      },
      commits: [
        { sha: "aaa111", commit: { message: "feat: change in file A only with enough lines to be feature" } },
        { sha: "bbb222", commit: { message: "feat: change in file B only with enough lines to be feature" } },
      ],
      perCommitFiles: {
        aaa111: [{ filename: "src/A.ts", additions: 30, deletions: 0 }],
        bbb222: [{ filename: "src/B.ts", additions: 30, deletions: 0 }],
      },
    });

    const stack = await buildCommitStack({
      owner: "o",
      repo: "r",
      number: 6,
    } as any, octokit as any);

    expect(stack.levels[0].files).toEqual(["src/A.ts"]);
    expect(stack.levels[1].files).toEqual(["src/B.ts"]);
  });

  it("handles a missing files array on getCommit response (treats as empty diff)", async () => {
    const octokit = {
      rest: {
        pulls: {
          get: vi.fn().mockResolvedValue({
            data: {
              html_url: "https://github.com/o/r/pull/7",
              base: { sha: "base000" },
              head: { sha: "aaa111" },
            },
          }),
          listCommits: vi.fn(),
        },
        repos: {
          // Simulate a merge commit / weird response: data.files is undefined.
          getCommit: vi.fn().mockResolvedValue({ data: {} }),
        },
      },
      paginate: vi.fn().mockResolvedValue([
        { sha: "aaa111", commit: { message: "Merge branch 'main' into feature" } },
      ]),
    };

    const stack = await buildCommitStack({
      owner: "o",
      repo: "r",
      number: 7,
    } as any, octokit as any);

    expect(stack.levels).toHaveLength(1);
    // Empty diff → "<5 LOC change" noise per classifier rules.
    expect(stack.levels[0].kind).toBe("noise");
    expect(stack.levels[0].files).toEqual([]);
  });
});
