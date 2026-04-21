import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../src/App.js";

// Mock useAnalysis to avoid WebSocket complexity
vi.mock("../src/hooks/useAnalysis.js", () => ({
  useAnalysis: vi.fn(() => ({
    stage: null,
    progress: "",
    partialClusters: [],
    analysis: null,
    error: null,
    startAnalysis: vi.fn(),
  })),
}));

describe("App", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ anthropicKeyConfigured: true, githubTokenConfigured: true }),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders LandingPage by default (smoke test)", () => {
    render(<App />);
    // LandingPage has this heading
    expect(screen.getByText("PR Triage Bot")).toBeTruthy();
    // And a PR URL input
    expect(screen.getByPlaceholderText("https://github.com/owner/repo/pull/123")).toBeTruthy();
  });
});
