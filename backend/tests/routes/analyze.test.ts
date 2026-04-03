import { describe, it, expect, afterAll } from "vitest";
import supertest from "supertest";
import { app, server } from "../../src/index.js";

const request = supertest(app);

afterAll(() => {
  server.close();
});

describe("POST /api/analyze", () => {
  it("returns 400 if prUrl is missing", async () => {
    const res = await request.post("/api/analyze").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("prUrl");
  });

  it("returns 400 if prUrl is not a valid GitHub PR URL", async () => {
    const res = await request.post("/api/analyze").send({ prUrl: "https://example.com" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Invalid");
  });

  it("returns 202 with analysisId for a valid PR URL when keys are configured", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    process.env.GITHUB_TOKEN = "ghp_test";

    const res = await request
      .post("/api/analyze")
      .send({ prUrl: "https://github.com/octocat/hello-world/pull/42" });
    expect(res.status).toBe(202);
    expect(res.body.analysisId).toBeDefined();
  });
});

describe("GET /api/analysis/:id", () => {
  it("returns 404 for unknown analysis", async () => {
    const res = await request.get("/api/analysis/nonexistent");
    expect(res.status).toBe(404);
  });
});
