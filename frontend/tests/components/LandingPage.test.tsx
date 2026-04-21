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
      json: () => Promise.resolve({ githubTokenConfigured: true, anthropicKeyConfigured: true, llmProvider: "claude-cli" }),
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
      json: () => Promise.resolve({ githubTokenConfigured: true, anthropicKeyConfigured: true, llmProvider: "claude-cli" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<LandingPage onAnalysisComplete={vi.fn()} />);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/config/status");
    });
  });

  it("shows GitHub token field when not configured", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ githubTokenConfigured: false, anthropicKeyConfigured: false, llmProvider: "claude-cli" }),
    }));
    render(<LandingPage onAnalysisComplete={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("GitHub Token")).toBeTruthy();
    });
  });

  it("hides GitHub token field when configured", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ githubTokenConfigured: true, anthropicKeyConfigured: false, llmProvider: "claude-cli" }),
    }));
    render(<LandingPage onAnalysisComplete={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Analyze PR")).toBeTruthy();
    });
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
