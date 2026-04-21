import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import chatRouter from "../../src/routes/chat.js";
import * as factory from "../../src/services/create-llm-client.js";

describe("POST /api/chat", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns a reply from the LLM client", async () => {
    vi.spyOn(factory, "createLLMClient").mockReturnValue({
      complete: vi.fn().mockResolvedValue("hello!"),
    } as any);

    const app = express();
    app.use(express.json());
    app.use("/api/chat", chatRouter);

    const res = await request(app).post("/api/chat").send({
      filePath: "a.ts", diff: "@@ -1 +1 @@", message: "what changed?",
    });
    expect(res.status).toBe(200);
    expect(res.body.reply).toBe("hello!");
  });

  it("400 when required fields missing", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/chat", chatRouter);
    const res = await request(app).post("/api/chat").send({ filePath: "a.ts" });
    expect(res.status).toBe(400);
  });
});
