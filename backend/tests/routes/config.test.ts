import { describe, it, expect, afterAll, beforeEach } from "vitest";
import supertest from "supertest";
import { app, server } from "../../src/index.js";

const request = supertest(app);

afterAll(() => {
  server.close();
});

describe("GET /api/config/status", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("returns configured: true when both keys are set", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    process.env.GITHUB_TOKEN = "ghp_test";

    const res = await request.get("/api/config/status");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      anthropicKeyConfigured: true,
      githubTokenConfigured: true,
    });
  });

  it("returns configured: false when keys are missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GITHUB_TOKEN;

    const res = await request.get("/api/config/status");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      anthropicKeyConfigured: false,
      githubTokenConfigured: false,
    });
  });
});
