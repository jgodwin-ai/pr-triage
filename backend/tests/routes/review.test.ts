import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import reviewRouter from "../../src/routes/review.js";
import * as ghReview from "../../src/services/github-review.js";

describe("POST /api/review", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("posts a review via octokit and returns the review id", async () => {
    vi.spyOn(ghReview, "submitReview").mockResolvedValue({ id: 12345, htmlUrl: "https://github.com/x/y/pull/1#review-12345" });
    const app = express();
    app.use(express.json());
    app.use("/api/review", reviewRouter);

    const res = await request(app).post("/api/review").send({
      prUrl: "https://github.com/x/y/pull/1",
      githubToken: "ghp_x",
      summary: "looks good",
      event: "COMMENT",
      comments: [
        { id: "1", createdAt: 0, target: { kind: "line", clusterId: "c1", path: "a.ts", line: 5, side: "RIGHT" }, body: "here" },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.reviewId).toBe(12345);
  });

  it("returns 400 when prUrl missing", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/review", reviewRouter);
    const res = await request(app).post("/api/review").send({});
    expect(res.status).toBe(400);
  });

  it("returns 400 when githubToken missing and no env var", async () => {
    const orig = process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;
    const app = express();
    app.use(express.json());
    app.use("/api/review", reviewRouter);
    const res = await request(app).post("/api/review").send({ prUrl: "https://github.com/x/y/pull/1" });
    expect(res.status).toBe(400);
    if (orig) process.env.GITHUB_TOKEN = orig;
  });
});
