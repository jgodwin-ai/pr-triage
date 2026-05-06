/**
 * Mock backend used by the Phase 1.7 stack-walkthrough E2E test.
 *
 * Stands in for the real backend by serving the four endpoints the frontend
 * touches during a stack flow:
 *   - GET  /api/config/status      (config probe on landing page mount)
 *   - GET  /api/analyze/samples    (dev-shortcut sample list — empty here)
 *   - POST /api/analyze            (kicks off "analysis"; returns an ID)
 *   - GET  /api/pr/:o/:r/:n/stack  (stack metadata + cached per-level analyses)
 *
 * Plus a WebSocket server on `/ws` that broadcasts a `complete` message
 * shortly after `POST /api/analyze` so the frontend transitions from
 * landing to AnalysisView. Because every stack level ships with a
 * pre-baked `analysis` payload, the frontend's `fetchStackAndPopulate`
 * call in `useAnalysis` is enough — no `levelReady` events are required
 * to make the assertions pass. The WS hook still works if we wanted to
 * extend the test to assert a streaming flow.
 *
 * Determinism: there is no LLM, no GitHub API, no clock-dependent
 * randomness — the server simply returns the fixture data.
 */

import express, { type Express } from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import {
  FIXTURE_LEVELS,
  FIXTURE_PR_ANALYSIS,
  PR_URL,
  BASE_SHA,
  HEAD_SHA,
} from "./fixtures/stack-pr.js";

export interface StartedMockServer {
  app: Express;
  server: http.Server;
  wss: WebSocketServer;
  port: number;
  close: () => Promise<void>;
}

export async function startMockServer(port = 0): Promise<StartedMockServer> {
  const app = express();
  app.use(express.json());

  app.get("/api/config/status", (_req, res) => {
    res.json({ githubTokenConfigured: true, llmProvider: "mock" });
  });

  app.get("/api/analyze/samples", (_req, res) => {
    res.json({ samples: [] });
  });

  app.post("/api/analyze", (_req, res) => {
    const analysisId = "fixture-analysis";
    res.status(202).json({ analysisId });
    // Broadcast `complete` shortly after so the WS hook (which only
    // attaches once the frontend has an analysisId) has time to mount.
    setTimeout(() => {
      broadcast(wss, {
        type: "complete",
        analysis: FIXTURE_PR_ANALYSIS,
      });
    }, 50);
  });

  app.get("/api/pr/:owner/:repo/:num/stack", (_req, res) => {
    res.json({
      prUrl: PR_URL,
      baseSha: BASE_SHA,
      headSha: HEAD_SHA,
      levels: FIXTURE_LEVELS,
    });
  });

  // Catch-all 404 for /api so the frontend's optional probes don't spin.
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "not found" });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws" });

  await new Promise<void>((resolve) => server.listen(port, resolve));
  const addr = server.address();
  const actualPort = typeof addr === "object" && addr ? addr.port : port;

  return {
    app,
    server,
    wss,
    port: actualPort,
    close: () =>
      new Promise<void>((resolve, reject) => {
        wss.close(() => {
          server.close((err) => (err ? reject(err) : resolve()));
        });
      }),
  };
}

function broadcast(wss: WebSocketServer, msg: unknown): void {
  const data = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  }
}

// Allow running this file directly via tsx (used by Playwright's
// webServer config so the dev tooling doesn't need a build step).
const isMain = process.argv[1] && process.argv[1].endsWith("mock-server.ts");
if (isMain) {
  const port = parseInt(process.env.MOCK_PORT ?? "9001", 10);
  startMockServer(port).then((s) => {
    console.log(`[mock-server] listening on http://localhost:${s.port}`);
  });
}
