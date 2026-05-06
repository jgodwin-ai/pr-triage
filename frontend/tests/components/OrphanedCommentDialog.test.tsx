import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import OrphanedCommentDialog from "../../src/components/OrphanedCommentDialog.js";
import type { OrphanedComment } from "../../src/types.js";

const orphanA: OrphanedComment = {
  commit_id: "abc123",
  path: "src/foo.ts",
  line: 42,
  body: "This branch should also handle null inputs by returning a default value rather than throwing — long body for excerpt test.",
  reason: "pull_request_review_thread.line: invalid",
};

const orphanB: OrphanedComment = {
  commit_id: "def456",
  path: "src/bar.ts",
  line: 7,
  body: "short body",
  reason: "file no longer exists",
};

describe("OrphanedCommentDialog", () => {
  it("renders nothing when orphans is empty", () => {
    const { container } = render(
      <OrphanedCommentDialog
        orphans={[]}
        onPromote={vi.fn()}
        onDrop={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders one row per orphan with path, line, body excerpt, and reason", () => {
    render(
      <OrphanedCommentDialog
        orphans={[orphanA, orphanB]}
        onPromote={vi.fn()}
        onDrop={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // path + line visible
    expect(screen.getByText(/src\/foo\.ts/)).toBeTruthy();
    expect(screen.getByText(/:42/)).toBeTruthy();
    expect(screen.getByText(/src\/bar\.ts/)).toBeTruthy();
    expect(screen.getByText(/:7/)).toBeTruthy();

    // body excerpt (~80 chars). The excerpt for orphanA should appear (truncated).
    const excerpt = screen.getByText(/This branch should also handle null inputs/);
    expect(excerpt.textContent && excerpt.textContent.length).toBeLessThanOrEqual(
      // Excerpt ~80 chars + ellipsis "…" = max 81. Allow some slack.
      120,
    );

    // short body shown verbatim
    expect(screen.getByText(/short body/)).toBeTruthy();

    // reasons visible
    expect(screen.getByText(/pull_request_review_thread\.line: invalid/)).toBeTruthy();
    expect(screen.getByText(/Reason: file no longer exists/)).toBeTruthy();
  });

  it("calls onPromote(orphan) when the row's Promote button is clicked", () => {
    const onPromote = vi.fn();
    render(
      <OrphanedCommentDialog
        orphans={[orphanA, orphanB]}
        onPromote={onPromote}
        onDrop={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const buttons = screen.getAllByRole("button", { name: /promote to file-level/i });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1]);
    expect(onPromote).toHaveBeenCalledTimes(1);
    expect(onPromote).toHaveBeenCalledWith(orphanB);
  });

  it("calls onDrop(orphan) when the row's Drop button is clicked", () => {
    const onDrop = vi.fn();
    render(
      <OrphanedCommentDialog
        orphans={[orphanA, orphanB]}
        onPromote={vi.fn()}
        onDrop={onDrop}
        onClose={vi.fn()}
      />,
    );
    const buttons = screen.getAllByRole("button", { name: /^drop$/i });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]);
    expect(onDrop).toHaveBeenCalledWith(orphanA);
  });

  it("calls onClose when the Close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <OrphanedCommentDialog
        orphans={[orphanA]}
        onPromote={vi.fn()}
        onDrop={vi.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clicking the backdrop calls onClose", () => {
    const onClose = vi.fn();
    const { container } = render(
      <OrphanedCommentDialog
        orphans={[orphanA]}
        onPromote={vi.fn()}
        onDrop={vi.fn()}
        onClose={onClose}
      />,
    );
    const backdrop = container.querySelector(".orphan-dialog__backdrop");
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clicking inside the dialog body does NOT call onClose", () => {
    const onClose = vi.fn();
    render(
      <OrphanedCommentDialog
        orphans={[orphanA]}
        onPromote={vi.fn()}
        onDrop={vi.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText(/orphaned comments/i));
    expect(onClose).not.toHaveBeenCalled();
  });
});
