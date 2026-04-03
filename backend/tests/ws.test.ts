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

  it("broadcasts to multiple clients", async () => {
    const server2 = http.createServer();
    const wss2 = setupWebSocket(server2);

    await new Promise<void>((resolve) => {
      server2.listen(0, () => resolve());
    });
    const port2 = (server2.address() as any).port;

    const client1 = new WebSocket(`ws://localhost:${port2}`);
    const client2 = new WebSocket(`ws://localhost:${port2}`);

    // Wait for both to connect
    await Promise.all([
      new Promise<void>((r) => client1.on("open", r)),
      new Promise<void>((r) => client2.on("open", r)),
    ]);

    const msg1Promise = new Promise<string>((resolve) => {
      client1.on("message", (data) => resolve(data.toString()));
    });
    const msg2Promise = new Promise<string>((resolve) => {
      client2.on("message", (data) => resolve(data.toString()));
    });

    broadcast(wss2, { type: "status", stage: "clustering", progress: "grouping" });

    const [msg1, msg2] = await Promise.all([msg1Promise, msg2Promise]);
    expect(JSON.parse(msg1).stage).toBe("clustering");
    expect(JSON.parse(msg2).stage).toBe("clustering");

    client1.close();
    client2.close();
    server2.close();
  });

  it("does not crash when broadcasting with no clients", () => {
    const server3 = http.createServer();
    const wss3 = setupWebSocket(server3);

    // No clients connected, should not throw
    expect(() => {
      broadcast(wss3, { type: "status", stage: "file-analysis", progress: "0/5" });
    }).not.toThrow();

    server3.close();
  });

  it("skips clients not in OPEN state", async () => {
    const server4 = http.createServer();
    const wss4 = setupWebSocket(server4);

    await new Promise<void>((resolve) => {
      server4.listen(0, () => resolve());
    });
    const port4 = (server4.address() as any).port;

    const client = new WebSocket(`ws://localhost:${port4}`);
    await new Promise<void>((r) => client.on("open", r));

    // Close the client so its readyState is no longer OPEN
    client.close();
    // Wait for close to propagate
    await new Promise<void>((r) => client.on("close", r));

    // Should not throw even though the client is closing/closed
    expect(() => {
      broadcast(wss4, { type: "status", stage: "ranking", progress: "done" });
    }).not.toThrow();

    server4.close();
  });
});
