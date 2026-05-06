/**
 * Vite config used by the Playwright E2E run.
 *
 * Differs from the default `vite.config.ts` in two ways:
 *   - dev server runs on a fixed port (5174) so Playwright can target it
 *   - /api and /ws are proxied to the mock server on `MOCK_PORT` (9001)
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const MOCK_PORT = parseInt(process.env.MOCK_PORT ?? "9001", 10);

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      "/api": `http://localhost:${MOCK_PORT}`,
      "/ws": {
        target: `ws://localhost:${MOCK_PORT}`,
        ws: true,
      },
    },
  },
});
