import { describe, it, expect, afterAll } from "vitest";
import { WebSocket } from "ws";
import http from "http";
import { setupWebSocket, broadcast } from "../src/ws.js";

let server: http.Server;
let port: number;

describe("WebSocket server", () => {
  afterAll(() => {
    server.close();
  });

  it("accepts connections and receives broadcast messages", async () => {
    server = http.createServer();
    const wss = setupWebSocket(server);

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });
    port = (server.address() as any).port;

    const client = new WebSocket(`ws://localhost:${port}`);

    const message = await new Promise<string>((resolve) => {
      client.on("open", () => {
        broadcast(wss, { type: "status", stage: "fetching-pr", progress: "starting" });
      });
      client.on("message", (data) => {
        resolve(data.toString());
        client.close();
      });
    });

    const parsed = JSON.parse(message);
    expect(parsed.type).toBe("status");
    expect(parsed.stage).toBe("fetching-pr");
  });
});
