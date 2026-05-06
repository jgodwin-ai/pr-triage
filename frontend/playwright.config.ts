import { defineConfig, devices } from "@playwright/test";

const MOCK_PORT = process.env.MOCK_PORT ?? "9001";

/**
 * Phase 1.7 stack-walkthrough E2E.
 *
 * Two web servers are started by Playwright before the test runs:
 *   1. mock-server.ts on MOCK_PORT — stands in for the real backend
 *      (no GitHub, no LLM, deterministic fixture).
 *   2. Vite dev server on 5174, configured via `vite.config.e2e.ts` to
 *      proxy /api and /ws to MOCK_PORT.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5174",
    trace: "retain-on-failure",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: `npx tsx tests/e2e/mock-server.ts`,
      env: { MOCK_PORT },
      port: parseInt(MOCK_PORT, 10),
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: `npx vite --config vite.config.e2e.ts`,
      env: { MOCK_PORT },
      port: 5174,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
