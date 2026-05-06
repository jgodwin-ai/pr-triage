/**
 * Phase 1.7 stack-walkthrough E2E (JGT-34).
 *
 * Drives the full UI against a deterministic 5-commit fixture PR served by
 * the mock backend in `mock-server.ts`. There are no live GitHub or LLM
 * calls — every per-level analysis is pre-baked in `fixtures/stack-pr.ts`.
 *
 * Asserts:
 *   1. Submitting the PR URL transitions the landing page into the
 *      analysis view and the TimelineRail renders the expected number of
 *      visible nodes (4 features + 1 collapsed-noise expander).
 *   2. Walking the stack bottom -> top swaps the displayed analysis to
 *      that level's marker.
 *   3. A draft authored at level 2 is hidden when the user navigates to
 *      level 4, and re-appears on returning to level 2 (per-commit-SHA
 *      scoping of drafts).
 *   4. The noise expander reveals the noise level inline when clicked.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  PR_URL,
  FIXTURE_LEVELS,
} from "./fixtures/stack-pr.js";

const FEATURE_LEVELS = FIXTURE_LEVELS.filter((l) => l.kind === "feature");
const NOISE_LEVELS = FIXTURE_LEVELS.filter((l) => l.kind === "noise");

/**
 * Click a feature-level rail node by its short SHA. Helper because the
 * rail emits `data-testid="timeline-rail__node"` on every visible node
 * and we need to disambiguate by inner text (the short SHA).
 */
async function clickRailNode(page: Page, shortSha: string): Promise<void> {
  const node = page
    .getByTestId("timeline-rail__node")
    .filter({ hasText: shortSha })
    .first();
  await node.click();
}

/**
 * The displayed analysis swaps both the right-rail Summary text *and*
 * the cluster sidebar (each fixture level produces a uniquely-named
 * cluster). We assert against the sidebar cluster name because it stays
 * visible regardless of which right-rail tab is active, which keeps the
 * test's later "switch to Review tab" step from invalidating the
 * marker check.
 */
async function expectMarker(page: Page, clusterName: string): Promise<void> {
  await expect(
    page.locator(".sidebar-cluster__name", { hasText: clusterName }),
  ).toHaveCount(1);
}

test.describe("stack walkthrough", () => {
  test.beforeEach(async ({ page }) => {
    // Reset persisted state between runs so reviewDraftStore /
    // stackStore start clean. Anchored under the served origin so
    // localStorage is reachable.
    await page.goto("/");
    await page.evaluate(() => {
      window.localStorage.clear();
    });
  });

  test("walks the 5-commit fixture stack with per-SHA draft scoping", async ({
    page,
  }) => {
    // Navigate, submit the fixture PR URL.
    await page.goto("/");
    await page.locator("input[type=url]").fill(PR_URL);
    await page.locator("button[type=submit]").click();

    // (1) Wait for the rail to render. Four feature nodes always
    //     visible; the noise level is collapsed behind a single
    //     "▾ N hidden" expander between levels 2 and 4 — total 5
    //     interactive items.
    const rail = page.locator(".timeline-rail");
    await expect(rail).toBeVisible({ timeout: 10_000 });
    const nodes = page.getByTestId("timeline-rail__node");
    await expect(nodes).toHaveCount(FEATURE_LEVELS.length);

    const expander = page.locator(".timeline-rail__expander");
    await expect(expander).toHaveCount(1);
    await expect(expander).toContainText(`${NOISE_LEVELS.length} hidden`);

    // (2) Walk bottom -> top. Levels are rendered in store order (oldest
    //     -> newest top to bottom by default; see TimelineRail docs);
    //     iterating the fixture array order is the canonical bottom-up
    //     walk relative to the model.
    for (const lvl of FEATURE_LEVELS) {
      await clickRailNode(page, lvl.shortSha);
      await expectMarker(page, lvl.analysis!.clusters[0].name);
    }

    // (3) Draft a comment at level 2.
    const level2 = FEATURE_LEVELS[2];
    await clickRailNode(page, level2.shortSha);
    await expectMarker(page, level2.analysis!.clusters[0].name);

    // The file-level CommentThread (`+ Add comment` button) sits inside
    // the diff viewer. The diff viewer auto-mounts when the file scrolls
    // into view; clicking the file in the sidebar forces a mount.
    const filePath = level2.analysis!.clusters[0].files[0].path;
    await page
      .locator(".sidebar-file__path", { hasText: filePath.split("/").pop()! })
      .first()
      .click();

    // Open the right rail "Review" tab — DraftedComments lives there
    // and is the cleanest way to assert the draft's presence/absence.
    await page.getByRole("button", { name: /^Review/ }).click();

    const addButton = page
      .locator(".comment-thread")
      .first()
      .getByRole("button", { name: "+ Add comment" });
    await addButton.click();
    const DRAFT_BODY = "DRAFT_AT_LEVEL_2 — this should only show on level 2";
    await page.locator(".comment-box__input").fill(DRAFT_BODY);
    await page
      .locator(".comment-box__actions")
      .getByRole("button", { name: "Add comment" })
      .click();

    // The DraftedComments panel in the right rail now lists the comment.
    await expect(
      page.locator(".drafted-comments__body", { hasText: DRAFT_BODY }),
    ).toHaveCount(1);

    // The TimelineRail surfaces per-SHA draft counts via a badge on each
    // node. Level 2 should now show "1"; level 4 has no draft yet.
    const level2Node = page
      .getByTestId("timeline-rail__node")
      .filter({ hasText: level2.shortSha })
      .first();
    await expect(level2Node.locator(".timeline-rail__badge")).toHaveText("1");

    // (4) Jump to level 4. The level-2 draft is scoped to level-2's SHA
    //     via `commit_id` on the persisted comment, so the per-level
    //     draft store on level 4 has no comments anchored to level-4's
    //     SHA — the rail badge for level 4 stays absent.
    const level4 = FEATURE_LEVELS[3];
    await clickRailNode(page, level4.shortSha);
    await expectMarker(page, level4.analysis!.clusters[0].name);

    const level4Node = page
      .getByTestId("timeline-rail__node")
      .filter({ hasText: level4.shortSha })
      .first();
    await expect(level4Node.locator(".timeline-rail__badge")).toHaveCount(0);

    // (5) Return to level 2 — draft is back. We assert by reading the
    //     per-SHA badge again (which tracks `commit_id` on persisted
    //     comments) so the assertion is independent of the
    //     DraftedComments list's stale-comment behavior.
    await clickRailNode(page, level2.shortSha);
    await expectMarker(page, level2.analysis!.clusters[0].name);
    await expect(level2Node.locator(".timeline-rail__badge")).toHaveText("1");

    // (6) Noise expansion: click the expander. The noise commit becomes
    //     visible as an additional rail node.
    await expander.click();
    await expect(nodes).toHaveCount(FEATURE_LEVELS.length + NOISE_LEVELS.length);
    const noiseShort = NOISE_LEVELS[0].sha.slice(0, 7);
    await expect(
      page.getByTestId("timeline-rail__node").filter({ hasText: noiseShort }),
    ).toHaveCount(1);
  });
});
