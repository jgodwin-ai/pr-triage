import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CommentThread from "../../src/components/CommentThread.js";
import { reviewDraftStore } from "../../src/state/reviewDraft.js";

beforeEach(() => {
  reviewDraftStore.reset();
});

describe("CommentThread", () => {
  const target = { kind: "file" as const, clusterId: "c1", path: "a.ts" };

  it("shows a title when provided", () => {
    render(<CommentThread target={target} title="File-level comments" />);
    expect(screen.getByText("File-level comments")).toBeTruthy();
  });

  it("renders existing comments from the store", () => {
    reviewDraftStore.addComment(target, "first comment");
    reviewDraftStore.addComment(target, "second comment");
    render(<CommentThread target={target} />);
    expect(screen.getByText("first comment")).toBeTruthy();
    expect(screen.getByText("second comment")).toBeTruthy();
  });

  it("clicking + Add comment reveals the composer and submits a new comment", () => {
    render(<CommentThread target={target} />);
    fireEvent.click(screen.getByText("+ Add comment"));
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "hello" } });
    // Default submit label is "Add comment". Ambiguity with the trigger text is resolved by role.
    const addBtn = screen.getByRole("button", { name: "Add comment" });
    fireEvent.click(addBtn);
    expect(reviewDraftStore.getComments(target)[0].body).toBe("hello");
    expect(screen.getByText("+ Add comment")).toBeTruthy();
  });

  it("cancel hides the composer without adding", () => {
    render(<CommentThread target={target} />);
    fireEvent.click(screen.getByText("+ Add comment"));
    fireEvent.click(screen.getByText("Cancel"));
    expect(reviewDraftStore.getComments(target)).toHaveLength(0);
    expect(screen.getByText("+ Add comment")).toBeTruthy();
  });

  it("Edit opens composer pre-filled and Save updates the comment", () => {
    reviewDraftStore.addComment(target, "old body");
    render(<CommentThread target={target} />);
    fireEvent.click(screen.getByText("Edit"));
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe("old body");
    fireEvent.change(textarea, { target: { value: "new body" } });
    fireEvent.click(screen.getByText("Save"));
    expect(reviewDraftStore.getComments(target)[0].body).toBe("new body");
  });

  it("Cancel during edit leaves the comment unchanged", () => {
    reviewDraftStore.addComment(target, "keep me");
    render(<CommentThread target={target} />);
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Cancel"));
    expect(reviewDraftStore.getComments(target)[0].body).toBe("keep me");
  });

  it("Delete removes the comment from the store", () => {
    reviewDraftStore.addComment(target, "kill me");
    render(<CommentThread target={target} />);
    fireEvent.click(screen.getByText("Delete"));
    expect(reviewDraftStore.getComments(target)).toHaveLength(0);
  });
});
