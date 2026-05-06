import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock octokit before importing the service
const createReviewMock = vi.fn();
const getMock = vi.fn();

vi.mock("octokit", () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    rest: {
      pulls: {
        createReview: createReviewMock,
        get: getMock,
      },
    },
  })),
}));

// Import after the mock is in place.
const { submitReview } = await import("../../src/services/github-review.js");

class FakeRequestError extends Error {
  name = "HttpError" as const;
  status: number;
  response: { data: any };
  constructor(message: string, status: number, data: any) {
    super(message);
    this.status = status;
    this.response = { data };
  }
}

const baseDraft = {
  prUrl: "https://github.com/x/y/pull/1",
  event: "COMMENT" as const,
  summary: "looks good",
};

beforeEach(() => {
  createReviewMock.mockReset();
  getMock.mockReset();
});

describe("submitReview — commit_id forwarding", () => {
  it("forwards per-comment commit_id to GitHub, grouping by commit", async () => {
    createReviewMock.mockResolvedValue({
      data: { id: 999, html_url: "https://github.com/x/y/pull/1#review-999" },
    });

    const result = await submitReview(
      {
        ...baseDraft,
        comments: [
          {
            id: "1",
            createdAt: 0,
            commit_id: "sha-A",
            target: { kind: "line", clusterId: "c1", path: "a.ts", line: 5, side: "RIGHT" },
            body: "first",
          },
          {
            id: "2",
            createdAt: 0,
            commit_id: "sha-A",
            target: { kind: "line", clusterId: "c1", path: "a.ts", line: 8, side: "RIGHT" },
            body: "second",
          },
          {
            id: "3",
            createdAt: 0,
            commit_id: "sha-B",
            target: { kind: "line", clusterId: "c1", path: "b.ts", line: 1, side: "RIGHT" },
            body: "third",
          },
        ],
      } as any,
      "ghp_test",
    );

    // Two groups → two calls.
    expect(createReviewMock).toHaveBeenCalledTimes(2);

    const calls = createReviewMock.mock.calls.map((c) => c[0]);
    const callA = calls.find((c) => c.commit_id === "sha-A")!;
    const callB = calls.find((c) => c.commit_id === "sha-B")!;
    expect(callA).toBeDefined();
    expect(callB).toBeDefined();

    expect(callA.comments).toEqual([
      { path: "a.ts", line: 5, side: "RIGHT", body: "first" },
      { path: "a.ts", line: 8, side: "RIGHT", body: "second" },
    ]);
    expect(callB.comments).toEqual([
      { path: "b.ts", line: 1, side: "RIGHT", body: "third" },
    ]);

    // Exactly one of the calls carries the verdict + body; the others are COMMENT-only.
    const verdictCalls = calls.filter((c) => c.event === "COMMENT" && c.body);
    expect(verdictCalls.length).toBe(1);
    expect(verdictCalls[0].body).toContain("looks good");

    expect(result.id).toBe(999);
    // Did not have to fetch the PR head — every comment had an explicit commit_id.
    expect(getMock).not.toHaveBeenCalled();
  });

  it("falls back to PR head SHA when a comment has no commit_id", async () => {
    getMock.mockResolvedValue({ data: { head: { sha: "head-SHA-from-pr" } } });
    createReviewMock.mockResolvedValue({
      data: { id: 1, html_url: "https://github.com/x/y/pull/1#review-1" },
    });

    await submitReview(
      {
        ...baseDraft,
        comments: [
          {
            id: "1",
            createdAt: 0,
            target: { kind: "line", clusterId: "c1", path: "a.ts", line: 5, side: "RIGHT" },
            body: "no commit_id",
          },
        ],
      } as any,
      "ghp_test",
    );

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(createReviewMock).toHaveBeenCalledTimes(1);
    expect(createReviewMock.mock.calls[0][0].commit_id).toBe("head-SHA-from-pr");
  });

  it("submits a body-only review when there are no line comments", async () => {
    createReviewMock.mockResolvedValue({
      data: { id: 7, html_url: "https://github.com/x/y/pull/1#review-7" },
    });

    const result = await submitReview(
      {
        ...baseDraft,
        comments: [
          {
            id: "1",
            createdAt: 0,
            target: { kind: "cluster", clusterId: "c1" },
            body: "cluster note",
          },
        ],
      } as any,
      "ghp_test",
    );

    expect(createReviewMock).toHaveBeenCalledTimes(1);
    const call = createReviewMock.mock.calls[0][0];
    expect(call.comments).toEqual([]);
    expect(call.body).toContain("looks good");
    expect(call.body).toContain("cluster note");
    // No commit_id field expected when no inline anchor needed; should not be set.
    // (We don't fetch PR head when there are no inline comments.)
    expect(getMock).not.toHaveBeenCalled();
    expect(result.id).toBe(7);
  });
});

describe("submitReview — orphan detection", () => {
  it("returns 1 orphan and 2 submitted when GitHub 422s a single comment", async () => {
    // First call: batched 3-comment review fails with 422.
    // Then per-comment retries: 1 fails, 2 succeed.
    createReviewMock
      .mockRejectedValueOnce(
        new FakeRequestError(
          "Validation Failed",
          422,
          {
            message: "Validation Failed",
            errors: [
              {
                resource: "PullRequestReviewComment",
                code: "invalid",
                field: "pull_request_review_thread.line",
                message: "pull_request_review_thread.path diff too large",
              },
            ],
          },
        ),
      )
      // Per-comment retries (same commit group): second comment is the orphan.
      .mockResolvedValueOnce({ data: { id: 100, html_url: "u1" } })
      .mockRejectedValueOnce(
        new FakeRequestError("Validation Failed", 422, {
          message: "Validation Failed",
          errors: [
            {
              resource: "PullRequestReviewComment",
              code: "invalid",
              field: "line",
              message: "Pull request review thread line must be part of the diff",
            },
          ],
        }),
      )
      .mockResolvedValueOnce({ data: { id: 101, html_url: "u2" } });

    const result = await submitReview(
      {
        ...baseDraft,
        comments: [
          {
            id: "1",
            createdAt: 0,
            commit_id: "sha-A",
            target: { kind: "line", clusterId: "c1", path: "a.ts", line: 5, side: "RIGHT" },
            body: "ok-1",
          },
          {
            id: "2",
            createdAt: 0,
            commit_id: "sha-A",
            target: { kind: "line", clusterId: "c1", path: "deleted.ts", line: 99, side: "RIGHT" },
            body: "orphan",
          },
          {
            id: "3",
            createdAt: 0,
            commit_id: "sha-A",
            target: { kind: "line", clusterId: "c1", path: "a.ts", line: 7, side: "RIGHT" },
            body: "ok-2",
          },
        ],
      } as any,
      "ghp_test",
    );

    expect(result.partial).toBe(true);
    expect(result.submitted).toBe(2);
    expect(result.orphans).toHaveLength(1);
    expect(result.orphans[0]).toMatchObject({
      commit_id: "sha-A",
      path: "deleted.ts",
      line: 99,
      body: "orphan",
    });
    expect(typeof result.orphans[0].reason).toBe("string");
  });

  it("propagates non-422 errors as a thrown error (network / auth failure)", async () => {
    createReviewMock.mockRejectedValueOnce(
      new FakeRequestError("Bad credentials", 401, { message: "Bad credentials" }),
    );

    await expect(
      submitReview(
        {
          ...baseDraft,
          comments: [
            {
              id: "1",
              createdAt: 0,
              commit_id: "sha-A",
              target: { kind: "line", clusterId: "c1", path: "a.ts", line: 5, side: "RIGHT" },
              body: "x",
            },
          ],
        } as any,
        "ghp_test",
      ),
    ).rejects.toThrow(/Bad credentials/);
  });
});
