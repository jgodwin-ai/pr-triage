import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ReviewSubmitBar from "../../src/components/ReviewSubmitBar.js";
import { reviewDraftStore } from "../../src/state/reviewDraft.js";

describe("ReviewSubmitBar", () => {
  beforeEach(() => {
    reviewDraftStore.reset();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ reviewId: 1, htmlUrl: "https://gh/r/1" }),
    }));
  });

  it("is hidden when no comments and no prior result", () => {
    const { container } = render(<ReviewSubmitBar prUrl="https://github.com/x/y/pull/1" />);
    expect(container.firstChild).toBeNull();
  });

  it("shows count of pending comments", () => {
    reviewDraftStore.addComment({ kind: "cluster", clusterId: "c1" }, "hi");
    render(<ReviewSubmitBar prUrl="https://github.com/x/y/pull/1" />);
    expect(screen.getByText(/1 comment/)).toBeTruthy();
  });

  it("submits via POST /api/review with draft payload", async () => {
    reviewDraftStore.addComment({ kind: "cluster", clusterId: "c1" }, "hi");
    render(<ReviewSubmitBar prUrl="https://github.com/x/y/pull/1" />);
    fireEvent.click(screen.getByText(/submit review/i));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/review", expect.objectContaining({
      method: "POST",
    })));
  });
});
