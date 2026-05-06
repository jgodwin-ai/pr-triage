import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CommentBox from "../../src/components/CommentBox.js";
import CommentThread from "../../src/components/CommentThread.js";
import { reviewDraftStore } from "../../src/state/reviewDraft.js";
import { stackStore } from "../../src/state/stack.js";

describe("CommentBox", () => {
  it("calls onSubmit with body and clears on submit", () => {
    const onSubmit = vi.fn();
    render(<CommentBox onSubmit={onSubmit} placeholder="Comment" />);
    const textarea = screen.getByPlaceholderText("Comment") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "hello" } });
    fireEvent.click(screen.getByText("Add comment"));
    expect(onSubmit).toHaveBeenCalledWith("hello");
    expect(textarea.value).toBe("");
  });

  it("does not submit empty comments", () => {
    const onSubmit = vi.fn();
    render(<CommentBox onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText("Add comment"));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("CommentBox + CommentThread — captures stack selectedSha as commitId on draft (JGT-31)", () => {
  beforeEach(() => {
    stackStore._resetForTest();
    reviewDraftStore.reset();
  });

  it("file-level draft created via CommentThread stores commitId from selected level", () => {
    const PR_URL = "https://github.com/o/r/pull/1";
    stackStore.setStack(PR_URL, [
      {
        sha: "selectedsha",
        shortSha: "select",
        message: "feat",
        parentSha: "0",
        kind: "feature",
        files: [],
        status: "ready",
      },
    ]);
    stackStore.setSelected("selectedsha");
    reviewDraftStore.loadFor(PR_URL, "headsha0");

    render(
      <CommentThread
        target={{ kind: "file", clusterId: "c1", path: "src/foo.ts" }}
      />,
    );
    fireEvent.click(screen.getByText(/\+ add comment/i));
    fireEvent.change(screen.getByPlaceholderText(/leave a comment/i), {
      target: { value: "level-anchored note" },
    });
    fireEvent.click(screen.getByText(/add comment/i));

    const all = reviewDraftStore.all();
    expect(all).toHaveLength(1);
    expect((all[0].target as any).commitId).toBe("selectedsha");
    expect(all[0].commit_id).toBe("selectedsha");
  });
});
