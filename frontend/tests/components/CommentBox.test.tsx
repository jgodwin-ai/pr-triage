import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CommentBox from "../../src/components/CommentBox.js";

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
