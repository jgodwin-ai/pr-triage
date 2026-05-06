import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../src/App.js";
import AnalysisView from "../src/components/AnalysisView.js";
import { stackStore } from "../src/state/stack.js";
import { makeAnalysis } from "./helpers.js";

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

describe("AnalysisView layout — TimelineRail mounted left of cluster sidebar (JGT-31)", () => {
  beforeEach(() => {
    stackStore._resetForTest();
    vi.stubGlobal(
      "IntersectionObserver",
      vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders TimelineRail before AnalysisSidebar in the analysis shell", () => {
    const analysis = makeAnalysis();
    const { container } = render(
      <AnalysisView analysis={analysis} onBack={() => {}} />,
    );
    const shell = container.querySelector(".analysis-shell");
    expect(shell).toBeTruthy();
    const rail = shell!.querySelector(".timeline-rail");
    const sidebar = shell!.querySelector(".analysis-sidebar");
    expect(rail).toBeTruthy();
    expect(sidebar).toBeTruthy();
    // TimelineRail must come before AnalysisSidebar in document order.
    expect(
      rail!.compareDocumentPosition(sidebar!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
