/**
 * Noise classifier for stack-level commits.
 *
 * Pure function: no I/O, no logging, no globals. All inputs come via arguments.
 *
 * Decision: diff is represented as a list of {path, additions, deletions} per file
 * (option (a) in the spec). The caller (commit-stack service) constructs this from
 * the GitHub API directly, and it makes per-file lockfile checks trivial.
 */

export interface CommitInput {
  /** First line of the commit message. */
  subject: string;
  /** Full commit message; optional but useful for some heuristics. */
  message?: string;
}

export interface DiffFile {
  path: string;
  additions: number;
  deletions: number;
}

/** Diff input — list of per-file change stats. */
export type DiffInput = DiffFile[];

export type Verdict = "feature" | "noise";

export type NoiseReason =
  | "fixup commit"
  | "wip commit"
  | "dependency bump"
  | "lockfile-only"
  | "<5 LOC change";

export interface ClassifyResult {
  verdict: Verdict;
  /** Present iff verdict is "noise". */
  noiseReason?: NoiseReason;
}

/**
 * Lockfile basenames we treat as auto-generated. Matched case-insensitively
 * against the file's basename (so subdirectories work too).
 */
const LOCKFILES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "cargo.lock",
  "poetry.lock",
  "pipfile.lock",
  "go.sum",
]);

function basename(p: string): string {
  const idx = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return idx >= 0 ? p.slice(idx + 1) : p;
}

function isLockfile(path: string): boolean {
  return LOCKFILES.has(basename(path).toLowerCase());
}

function isFixup(subject: string): boolean {
  return /^(fixup|squash)!\s/i.test(subject);
}

function isWip(subject: string): boolean {
  // Match leading "wip:" or "wip " (case-insensitive). Avoids false positives
  // like "swipe" because we anchor to start-of-string and require ":" or whitespace
  // immediately after.
  return /^wip(:|\s)/i.test(subject);
}

/**
 * Detect dependency-bump style commits.
 *
 * No single canonical pattern exists, so we recognize two common shapes:
 *   - Conventional Commits: `chore(deps): ...`, `chore(deps-dev): ...`,
 *     `build(deps): ...`, `fix(deps): ...`
 *   - Dependabot/Renovate default: `Bump <pkg> from <a> to <b>`
 *
 * If a project uses something else, callers can wrap this with their own check.
 */
function isDependencyBump(subject: string): boolean {
  if (/^(chore|build|fix|deps)\(\s*deps(?:-dev)?\s*\)/i.test(subject)) return true;
  if (/^bump\s+\S+\s+from\s+\S+\s+to\s+\S+/i.test(subject)) return true;
  return false;
}

function nonLockfileLoc(diff: DiffInput): number {
  let total = 0;
  for (const f of diff) {
    if (isLockfile(f.path)) continue;
    total += (f.additions ?? 0) + (f.deletions ?? 0);
  }
  return total;
}

function isLockfileOnly(diff: DiffInput): boolean {
  if (diff.length === 0) return false;
  return diff.every((f) => isLockfile(f.path));
}

export function classify(commit: CommitInput, diff: DiffInput): ClassifyResult {
  const subject = commit.subject ?? "";

  // Subject-based heuristics first — cheapest and most decisive.
  if (isFixup(subject)) return { verdict: "noise", noiseReason: "fixup commit" };
  if (isWip(subject)) return { verdict: "noise", noiseReason: "wip commit" };
  if (isDependencyBump(subject))
    return { verdict: "noise", noiseReason: "dependency bump" };

  // Diff-based heuristics.
  if (isLockfileOnly(diff))
    return { verdict: "noise", noiseReason: "lockfile-only" };

  if (nonLockfileLoc(diff) < 5)
    return { verdict: "noise", noiseReason: "<5 LOC change" };

  return { verdict: "feature" };
}
