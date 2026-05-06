import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import StackReloadBanner from "../../src/components/StackReloadBanner.js";
import { stackStore } from "../../src/state/stack.js";
import { reviewDraftStore } from "../../src/state/reviewDraft.js";

const PR_URL = "https://github.com/o/r/pull/1";
const SHA_OLD = "aaaaaaa";
const SHA_NEW = "bbbbbbb";

describe("StackReloadBanner", () => {
  beforeEach(() => {
    stackStore._resetForTest();
  });

  it("renders when latestKnownHeadSha differs from analysis headSha", () => {
    stackStore.setLatestKnownHeadSha(SHA_NEW);
    render(
      <StackReloadBanner
        prUrl={PR_URL}
        analysisHeadSha={SHA_OLD}
        onReload={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /reload stack/i })).toBeTruthy();
    expect(screen.getByText(/new commits/i)).toBeTruthy();
  });

  it("does not render when latestKnownHeadSha matches analysis headSha", () => {
    stackStore.setLatestKnownHeadSha(SHA_OLD);
    const { container } = render(
      <StackReloadBanner
        prUrl={PR_URL}
        analysisHeadSha={SHA_OLD}
        onReload={() => {}}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("does not render when latestKnownHeadSha is null", () => {
    const { container } = render(
      <StackReloadBanner
        prUrl={PR_URL}
        analysisHeadSha={SHA_OLD}
        onReload={() => {}}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("fires onReload with the prUrl when the button is clicked", () => {
    stackStore.setLatestKnownHeadSha(SHA_NEW);
    const onReload = vi.fn();
    render(
      <StackReloadBanner
        prUrl={PR_URL}
        analysisHeadSha={SHA_OLD}
        onReload={onReload}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /reload stack/i }));
    expect(onReload).toHaveBeenCalledTimes(1);
    expect(onReload).toHaveBeenCalledWith(PR_URL);
  });

  it("does not clear drafts when reload is clicked", () => {
    // Seed a draft anchored to the old SHA.
    reviewDraftStore.loadFor(PR_URL, SHA_OLD);
    reviewDraftStore.addComment(
      { kind: "cluster", clusterId: "c1" },
      "preserve me",
    );
    const before = reviewDraftStore.snapshot();
    expect(before.comments).toHaveLength(1);

    stackStore.setLatestKnownHeadSha(SHA_NEW);
    const onReload = vi.fn();
    render(
      <StackReloadBanner
        prUrl={PR_URL}
        analysisHeadSha={SHA_OLD}
        onReload={onReload}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /reload stack/i }));

    const after = reviewDraftStore.snapshot();
    expect(after.comments).toHaveLength(1);
    expect(after.comments[0].body).toBe("preserve me");

    // Cleanup so we don't leak persisted state into other tests.
    reviewDraftStore.reset();
  });
});
