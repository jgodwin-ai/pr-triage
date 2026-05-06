import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:9000",
      "/ws": {
        target: "ws://localhost:9000",
        ws: true,
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    // Exclude Playwright E2E specs — they have a different runner/lifecycle.
    exclude: ["tests/e2e/**", "**/node_modules/**"],
  },
});
