import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAnalysis } from "../../src/hooks/useAnalysis.js";

// Mock WebSocket
class MockWebSocket {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  close = vi.fn();
}

describe("useAnalysis", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("WebSocket", vi.fn(() => new MockWebSocket()));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("startAnalysis sends POST with correct body", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ analysisId: "abc-123" }),
    });

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnalysis(onComplete));

    await act(async () => {
      await result.current.startAnalysis("https://github.com/o/r/pull/1", "sk-ant-key", "ghp_token");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prUrl: "https://github.com/o/r/pull/1",
        anthropicApiKey: "sk-ant-key",
        githubToken: "ghp_token",
      }),
    });
  });

  it("sets error state on non-OK response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: "Invalid PR URL" }),
    });

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnalysis(onComplete));

    await act(async () => {
      await result.current.startAnalysis("bad-url");
    });

    expect(result.current.stage).toBe("error");
    expect(result.current.error).toBe("Invalid PR URL");
  });

  it("sets error state on network failure", async () => {
    fetchMock.mockRejectedValue(new Error("Failed to fetch"));

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnalysis(onComplete));

    await act(async () => {
      await result.current.startAnalysis("https://github.com/o/r/pull/1");
    });

    expect(result.current.stage).toBe("error");
    expect(result.current.error).toBe("Failed to fetch");
  });

  it("handles non-JSON error response gracefully", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error("not JSON")),
    });

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnalysis(onComplete));

    await act(async () => {
      await result.current.startAnalysis("https://github.com/o/r/pull/1");
    });

    expect(result.current.stage).toBe("error");
    expect(result.current.error).toBe("Request failed with status 500");
  });
});
