import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { WSMessage } from "./types.js";

export function setupWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    ws.on("error", (err) => {
      console.error("WebSocket error:", err.message);
    });
  });

  return wss;
}

export function broadcast(wss: WebSocketServer, message: WSMessage): void {
  const data = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}
