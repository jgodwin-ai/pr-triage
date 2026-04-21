import { describe, it, expect, afterAll, beforeEach } from "vitest";
import supertest from "supertest";
import { app, server } from "../../src/index.js";
import { setAnalysis } from "../../src/routes/analyze.js";

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

  it("returns 400 when GitHub token is missing (no env, no body)", async () => {
    const savedAnthropicKey = process.env.ANTHROPIC_API_KEY;
    const savedGithubToken = process.env.GITHUB_TOKEN;
    process.env.ANTHROPIC_API_KEY = "sk-test";
    delete process.env.GITHUB_TOKEN;

    const res = await request
      .post("/api/analyze")
      .send({ prUrl: "https://github.com/octocat/hello-world/pull/42" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("GitHub token");

    process.env.ANTHROPIC_API_KEY = savedAnthropicKey;
    process.env.GITHUB_TOKEN = savedGithubToken;
  });

  it("returns 202 when Anthropic API key is missing (it is optional)", async () => {
    const savedAnthropicKey = process.env.ANTHROPIC_API_KEY;
    const savedGithubToken = process.env.GITHUB_TOKEN;
    delete process.env.ANTHROPIC_API_KEY;
    process.env.GITHUB_TOKEN = "ghp_test";

    const res = await request
      .post("/api/analyze")
      .send({ prUrl: "https://github.com/octocat/hello-world/pull/42" });

    expect(res.status).toBe(202);
    expect(res.body.analysisId).toBeDefined();

    process.env.ANTHROPIC_API_KEY = savedAnthropicKey;
    process.env.GITHUB_TOKEN = savedGithubToken;
  });

  it("accepts API keys passed in the request body", async () => {
    const savedAnthropicKey = process.env.ANTHROPIC_API_KEY;
    const savedGithubToken = process.env.GITHUB_TOKEN;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GITHUB_TOKEN;

    const res = await request
      .post("/api/analyze")
      .send({
        prUrl: "https://github.com/octocat/hello-world/pull/42",
        anthropicApiKey: "sk-from-body",
        githubToken: "ghp-from-body",
      });

    expect(res.status).toBe(202);
    expect(res.body.analysisId).toBeDefined();

    process.env.ANTHROPIC_API_KEY = savedAnthropicKey;
    process.env.GITHUB_TOKEN = savedGithubToken;
  });
});

describe("GET /api/analysis/:id", () => {
  it("returns 404 for unknown analysis", async () => {
    const res = await request.get("/api/analysis/nonexistent");
    expect(res.status).toBe(404);
  });

  it("returns running status for an in-progress analysis", async () => {
    const id = "test-running-id";
    setAnalysis(id, { status: "running" });

    const res = await request.get(`/api/analysis/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("running");
  });

  it("returns completed analysis object when seeded with setAnalysis", async () => {
    const id = "test-complete-id";
    const analysis = {
      id,
      pr: {
        url: "https://github.com/octocat/hello-world/pull/42",
        title: "Test PR",
        author: "octocat",
        baseBranch: "main",
        headBranch: "feature",
        additions: 10,
        deletions: 2,
        fileCount: 1,
      },
      executiveSummary: "A test analysis",
      clusters: [],
      timeSaved: "~5 min",
    };
    setAnalysis(id, analysis as any);

    const res = await request.get(`/api/analysis/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.executiveSummary).toBe("A test analysis");
    expect(res.body.timeSaved).toBe("~5 min");
  });

  it("returns error status for a failed analysis", async () => {
    const id = "test-error-id";
    setAnalysis(id, { status: "error", error: "Pipeline failed" });

    const res = await request.get(`/api/analysis/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("error");
    expect(res.body.error).toBe("Pipeline failed");
  });
});
