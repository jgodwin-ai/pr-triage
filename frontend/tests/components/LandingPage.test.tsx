import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import LandingPage from "../../src/components/LandingPage.js";

// Mock the useAnalysis hook with a vi.fn() so we can override per-test
const mockStartAnalysis = vi.fn();
const mockUseAnalysis = vi.fn(() => ({
  stage: null as string | null,
  progress: "",
  partialClusters: [],
  analysis: null,
  error: null,
  startAnalysis: mockStartAnalysis,
}));

vi.mock("../../src/hooks/useAnalysis.js", () => ({
  useAnalysis: (...args: unknown[]) => mockUseAnalysis(...args),
}));

describe("LandingPage", () => {
  beforeEach(() => {
    mockStartAnalysis.mockReset();
    mockUseAnalysis.mockImplementation(() => ({
      stage: null,
      progress: "",
      partialClusters: [],
      analysis: null,
      error: null,
      startAnalysis: mockStartAnalysis,
    }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ anthropicKeyConfigured: true, githubTokenConfigured: true }),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders PR URL input", () => {
    render(<LandingPage onAnalysisComplete={vi.fn()} />);
    const input = screen.getByPlaceholderText("https://github.com/owner/repo/pull/123");
    expect(input).toBeTruthy();
    expect(input.getAttribute("type")).toBe("url");
  });

  it("fetches config status on mount", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ anthropicKeyConfigured: true, githubTokenConfigured: true }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<LandingPage onAnalysisComplete={vi.fn()} />);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/config/status");
    });
  });

  it("shows API key fields when keys not configured", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ anthropicKeyConfigured: false, githubTokenConfigured: false }),
    }));
    render(<LandingPage onAnalysisComplete={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Anthropic API Key")).toBeTruthy();
      expect(screen.getByPlaceholderText("GitHub Token")).toBeTruthy();
    });
  });

  it("hides API key fields when keys configured", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ anthropicKeyConfigured: true, githubTokenConfigured: true }),
    }));
    render(<LandingPage onAnalysisComplete={vi.fn()} />);
    await waitFor(() => {
      // config is loaded
      expect(screen.getByText("Analyze PR")).toBeTruthy();
    });
    expect(screen.queryByPlaceholderText("Anthropic API Key")).toBeNull();
    expect(screen.queryByPlaceholderText("GitHub Token")).toBeNull();
  });

  it("disables form and shows 'Analyzing...' during loading", () => {
    mockUseAnalysis.mockImplementation(() => ({
      stage: "fetching-pr",
      progress: "Submitting...",
      partialClusters: [],
      analysis: null,
      error: null,
      startAnalysis: mockStartAnalysis,
    }));
    render(<LandingPage onAnalysisComplete={vi.fn()} />);
    const button = screen.getByRole("button");
    expect(button.textContent).toBe("Analyzing...");
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});
