import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TimelineRail from "../../src/components/TimelineRail.js";
import { stackStore, type Level } from "../../src/state/stack.js";
import { reviewDraftStore } from "../../src/state/reviewDraft.js";

const PR_URL = "https://github.com/o/r/pull/1";

function lvl(overrides: Partial<Level> & { sha: string }): Level {
  return {
    sha: overrides.sha,
    shortSha: overrides.shortSha ?? overrides.sha.slice(0, 7),
    message: overrides.message ?? `commit ${overrides.sha}`,
    parentSha: overrides.parentSha ?? "0000000",
    kind: overrides.kind ?? "feature",
    files: overrides.files ?? [],
    status: overrides.status ?? "ready",
    noiseReason: overrides.noiseReason,
    analysis: overrides.analysis,
  };
}

describe("TimelineRail", () => {
  beforeEach(() => {
    stackStore._resetForTest();
    reviewDraftStore.reset();
  });

  it("renders one node per non-noise level", () => {
    stackStore.setStack(PR_URL, [
      lvl({ sha: "aaaaaaa1111", message: "feat A" }),
      lvl({ sha: "bbbbbbb2222", message: "feat B" }),
      lvl({ sha: "ccccccc3333", message: "noise C", kind: "noise", noiseReason: "fmt" }),
    ]);
    render(<TimelineRail />);
    const nodes = screen.getAllByTestId("timeline-rail__node");
    // Only feature nodes are visible by default
    expect(nodes).toHaveLength(2);
  });

  it("renders feature levels with oldest at the bottom", () => {
    stackStore.setStack(PR_URL, [
      // Top of stack first (newest), oldest last per Level convention.
      lvl({ sha: "newwwwww111", message: "newest" }),
      lvl({ sha: "oldddddd222", message: "oldest" }),
    ]);
    const { container } = render(<TimelineRail />);
    const items = Array.from(
      container.querySelectorAll(".timeline-rail__node"),
    );
    // First DOM child is at top visually -> "newest"
    expect(items[0].textContent).toContain("newwwww");
    expect(items[1].textContent).toContain("olddddd");
  });

  it("marks the selected level with is-selected", () => {
    stackStore.setStack(PR_URL, [
      lvl({ sha: "aaaaaaa1111" }),
      lvl({ sha: "bbbbbbb2222" }),
    ]);
    stackStore.setSelected("bbbbbbb2222");
    const { container } = render(<TimelineRail />);
    const selected = container.querySelectorAll(
      ".timeline-rail__node.is-selected",
    );
    expect(selected).toHaveLength(1);
    expect(selected[0].textContent).toContain("bbbbbbb");
  });

  it("calls stackStore.setSelected when a node is clicked", () => {
    stackStore.setStack(PR_URL, [
      lvl({ sha: "aaaaaaa1111" }),
      lvl({ sha: "bbbbbbb2222" }),
    ]);
    const spy = vi.spyOn(stackStore, "setSelected");
    render(<TimelineRail />);
    fireEvent.click(screen.getByRole("button", { name: /bbbbbbb/i }));
    expect(spy).toHaveBeenCalledWith("bbbbbbb2222");
    spy.mockRestore();
  });

  it("renders status dots reflecting each level's status", () => {
    stackStore.setStack(PR_URL, [
      lvl({ sha: "1111111aaaa", status: "pending" }),
      lvl({ sha: "2222222bbbb", status: "analyzing" }),
      lvl({ sha: "3333333cccc", status: "ready" }),
      lvl({ sha: "4444444dddd", status: "error" }),
    ]);
    const { container } = render(<TimelineRail />);
    expect(container.querySelector(".timeline-rail__dot--pending")).toBeTruthy();
    expect(container.querySelector(".timeline-rail__dot--analyzing")).toBeTruthy();
    expect(container.querySelector(".timeline-rail__dot--ready")).toBeTruthy();
    expect(container.querySelector(".timeline-rail__dot--error")).toBeTruthy();
  });

  it("shows the full commit subject via title attribute on hover target", () => {
    stackStore.setStack(PR_URL, [
      lvl({ sha: "aaaaaaa1111", message: "fix(foo): handle null edge case in bar" }),
    ]);
    render(<TimelineRail />);
    const node = screen.getByRole("button", { name: /aaaaaaa/i });
    expect(node.getAttribute("title")).toBe(
      "fix(foo): handle null edge case in bar",
    );
  });

  it("groups consecutive noise levels under a hidden expander between feature levels", () => {
    stackStore.setStack(PR_URL, [
      lvl({ sha: "feaaaaa1111", message: "feat A" }),
      lvl({ sha: "noiiiii2222", message: "fmt", kind: "noise", noiseReason: "fmt" }),
      lvl({ sha: "noiiiii3333", message: "lockfile", kind: "noise", noiseReason: "deps" }),
      lvl({ sha: "feaaaaa4444", message: "feat B" }),
    ]);
    const { container } = render(<TimelineRail />);
    // Only 2 feature nodes visible
    expect(container.querySelectorAll(".timeline-rail__node")).toHaveLength(2);
    // Expander present, mentioning hidden count
    const expander = screen.getByRole("button", { name: /2 hidden/i });
    expect(expander).toBeTruthy();
    // Noise nodes hidden by default
    expect(container.querySelectorAll(".timeline-rail__node--noise")).toHaveLength(0);
  });

  it("expands noise levels inline when the expander is clicked", () => {
    stackStore.setStack(PR_URL, [
      lvl({ sha: "feaaaaa1111", message: "feat A" }),
      lvl({ sha: "noiiiii2222", message: "fmt", kind: "noise", noiseReason: "fmt" }),
      lvl({ sha: "feaaaaa3333", message: "feat B" }),
    ]);
    const { container } = render(<TimelineRail />);
    expect(container.querySelectorAll(".timeline-rail__node--noise")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: /1 hidden/i }));
    expect(container.querySelectorAll(".timeline-rail__node--noise")).toHaveLength(1);
  });

  it("does not render an expander when no noise levels separate features", () => {
    stackStore.setStack(PR_URL, [
      lvl({ sha: "feaaaaa1111" }),
      lvl({ sha: "feaaaaa2222" }),
    ]);
    render(<TimelineRail />);
    expect(screen.queryByRole("button", { name: /hidden/i })).toBeNull();
  });

  it("draft-count badge defaults to 0 (not rendered) when there are no drafts", () => {
    stackStore.setStack(PR_URL, [lvl({ sha: "aaaaaaa1111" })]);
    const { container } = render(<TimelineRail />);
    expect(container.querySelector(".timeline-rail__badge")).toBeNull();
  });

  it("draft-count badge counts drafts whose commitId matches the level sha", () => {
    stackStore.setStack(PR_URL, [
      lvl({ sha: "aaaaaaa1111" }),
      lvl({ sha: "bbbbbbb2222" }),
    ]);
    reviewDraftStore.loadFor(PR_URL, "aaaaaaa1111");
    // Mock drafts with commitId attached on the target (JGT-31 schema preview).
    const c1 = reviewDraftStore.addComment(
      { kind: "cluster", clusterId: "c1" },
      "x",
    );
    const c2 = reviewDraftStore.addComment(
      { kind: "cluster", clusterId: "c1" },
      "y",
    );
    const c3 = reviewDraftStore.addComment(
      { kind: "cluster", clusterId: "c2" },
      "z",
    );
    // Force commitId onto targets to simulate post-JGT-31 schema.
    (c1.target as any).commitId = "aaaaaaa1111";
    (c2.target as any).commitId = "aaaaaaa1111";
    (c3.target as any).commitId = "bbbbbbb2222";

    const { container } = render(<TimelineRail />);
    const badges = container.querySelectorAll(".timeline-rail__badge");
    expect(badges).toHaveLength(2);
    const byNode = Array.from(
      container.querySelectorAll(".timeline-rail__node"),
    ).map((n) => ({
      sha: n.textContent ?? "",
      count: n.querySelector(".timeline-rail__badge")?.textContent ?? "0",
    }));
    const a = byNode.find((b) => b.sha.includes("aaaaaaa"));
    const b = byNode.find((bb) => bb.sha.includes("bbbbbbb"));
    expect(a?.count).toBe("2");
    expect(b?.count).toBe("1");
  });

  it("does not crash when draft target lacks commitId (JGT-31 schema not yet applied)", () => {
    stackStore.setStack(PR_URL, [lvl({ sha: "aaaaaaa1111" })]);
    reviewDraftStore.loadFor(PR_URL, "aaaaaaa1111");
    reviewDraftStore.addComment(
      { kind: "cluster", clusterId: "c1" },
      "no commitId here",
    );
    const { container } = render(<TimelineRail />);
    // No commitId means no draft is attributed to any level: badge absent.
    expect(container.querySelector(".timeline-rail__badge")).toBeNull();
  });
});
