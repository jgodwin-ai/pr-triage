import { describe, it, expect, afterAll } from "vitest";
import supertest from "supertest";
import { app, server } from "../../src/index.js";

const request = supertest(app);

afterAll(() => {
  server.close();
});

describe("GET /api/health", () => {
  it("returns ok status", async () => {
    const res = await request.get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
