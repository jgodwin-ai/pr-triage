/**
 * commit-stack service — builds a virtual stacked-PR view from a single
 * GitHub PR.
 *
 * Each PR commit becomes a `StackLevel`. Levels are ordered chronologically
 * (oldest → newest), and each level's `parentSha` chains to the previous
 * level's SHA (or `baseSha` for level 0). The classifier from JGT-24
 * decides whether a commit is "feature" or "noise" — this service does
 * not modify or extend that logic.
 *
 * Note on merge commits: a merge commit's per-commit `files` array
 * reflects the *merge resolution*, not new feature work. The classifier
 * tends to treat them as noise (typically very small diffs, or matches
 * the "<5 LOC" / lockfile fallbacks). We do not special-case them here —
 * the classifier's rules are the single source of truth.
 */

import type { Octokit } from "octokit";
import { classify } from "./noise-classifier.js";
import type { DiffInput } from "./noise-classifier.js";
import { createOctokit } from "./github.js";

export interface StackLevel {
  sha: string;
  shortSha: string;
  /** Commit subject (first line of the commit message) only. */
  message: string;
  /** SHA of the previous level, or `baseSha` for level 0. */
  parentSha: string;
  kind: "feature" | "noise";
  /** Present iff `kind === "noise"`. */
  noiseReason?: string;
  /** Files changed in this commit only (paths). */
  files: string[];
  /**
   * Always `"pending"` from this service. The pipeline runner fills in
   * downstream status / analysis fields later.
   */
  status: "pending";
}

export interface CommitStackInput {
  owner: string;
  repo: string;
  number: number;
  /** Optional GitHub token — falls back to env var per existing convention. */
  githubToken?: string;
}

export interface CommitStack {
  prUrl: string;
  baseSha: string;
  headSha: string;
  /** Levels ordered oldest → newest. */
  levels: StackLevel[];
}

/** Subject line of a commit message — everything before the first newline. */
function commitSubject(message: string): string {
  const nl = message.indexOf("\n");
  return nl === -1 ? message : message.slice(0, nl);
}

/**
 * Coerce GitHub's per-commit `files` array into the `DiffInput` shape the
 * noise-classifier expects. We tolerate missing fields defensively because
 * GitHub occasionally returns sparse data (e.g. for merge commits).
 */
function toDiffInput(
  files: Array<{ filename?: string; additions?: number; deletions?: number }> | undefined,
): DiffInput {
  if (!files) return [];
  return files.map((f) => ({
    path: f.filename ?? "",
    additions: f.additions ?? 0,
    deletions: f.deletions ?? 0,
  }));
}

/**
 * Build a virtual stacked-PR view of a GitHub PR.
 *
 * The optional second argument exists for test injection — production
 * callers pass only `input` and we construct an `Octokit` ourselves.
 */
export async function buildCommitStack(
  input: CommitStackInput,
  octokitOverride?: Octokit,
): Promise<CommitStack> {
  const { owner, repo, number } = input;

  const octokit: Octokit =
    octokitOverride ??
    createOctokit(input.githubToken ?? process.env.GITHUB_TOKEN ?? "");

  // 1. PR metadata: we need html_url, base.sha, head.sha.
  const prResp = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: number,
  });
  const pr: any = prResp.data;
  const prUrl: string = pr.html_url;
  const baseSha: string = pr.base.sha;
  const headSha: string = pr.head.sha;

  // 2. Commit list — chronologically ordered (oldest → newest) by GitHub.
  //    Use paginate so we don't silently truncate at 30/page.
  const commits: Array<{ sha: string; commit: { message: string } }> = await octokit.paginate(
    octokit.rest.pulls.listCommits as any,
    { owner, repo, pull_number: number, per_page: 100 },
  );

  if (commits.length === 0) {
    return { prUrl, baseSha, headSha, levels: [] };
  }

  // 3. Per-commit diffs in parallel with a small concurrency cap.
  const pLimit = (await import("p-limit")).default;
  const limit = pLimit(5);

  const perCommit = await Promise.all(
    commits.map((c) =>
      limit(async () => {
        const res = await octokit.rest.repos.getCommit({
          owner,
          repo,
          ref: c.sha,
        });
        const files: Array<{ filename?: string; additions?: number; deletions?: number }> =
          (res.data as any).files ?? [];
        return { sha: c.sha, message: c.commit.message, files };
      }),
    ),
  );

  // 4. Build levels. parentSha chains: level 0 → baseSha; level N → level N-1.
  const levels: StackLevel[] = perCommit.map((c, i) => {
    const subject = commitSubject(c.message);
    const diff = toDiffInput(c.files);
    const verdict = classify({ subject, message: c.message }, diff);

    const level: StackLevel = {
      sha: c.sha,
      shortSha: c.sha.slice(0, 7),
      message: subject,
      parentSha: i === 0 ? baseSha : perCommit[i - 1].sha,
      kind: verdict.verdict,
      files: c.files.map((f) => f.filename ?? "").filter((p) => p.length > 0),
      status: "pending",
    };
    if (verdict.noiseReason) {
      level.noiseReason = verdict.noiseReason;
    }
    return level;
  });

  return { prUrl, baseSha, headSha, levels };
}
