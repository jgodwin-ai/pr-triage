import { mkdir, readFile, writeFile, readdir } from "fs/promises";
import path from "path";
import type { PRAnalysis } from "../types.js";

export interface CachedAnalysisSummary {
  key: string;
  prUrl: string;
  title: string;
  headSha: string;
}

function sanitize(s: string): string {
  return s.replace(/[^a-z0-9-]/gi, "_");
}

function parseUrlParts(prUrl: string): { owner: string; repo: string; number: string } {
  const m = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!m) return { owner: "unknown", repo: "unknown", number: "0" };
  return { owner: m[1], repo: m[2], number: m[3] };
}

/**
 * Filesystem-backed cache of completed `PRAnalysis` results, keyed by
 * `(prUrl, commitSha)`.
 *
 * The conceptual cache key is `${prUrl}#${commitSha}` — one entry per
 * (PR, commit) pair. This shape supports both:
 *   - the single-PR `/api/analyze` flow, which passes the PR head SHA
 *     as `commitSha` (legacy back-compat — same as before Phase 1.7);
 *   - the stacked-PR flow (Phase 1.7), which caches each commit-level
 *     analysis under that commit's SHA so revisits are instant.
 *
 * On disk the key is sanitized to `<owner>_<repo>_<number>_<sha>` so it
 * survives as a filename across platforms.
 */
export class AnalysisCache {
  constructor(private dir: string) {}

  /**
   * Build the on-disk key for a `(prUrl, commitSha)` pair.
   *
   * `commitSha` may be the PR head SHA (single-PR flow) or any
   * commit SHA in the PR's history (stacked-PR flow).
   */
  keyFor(prUrl: string, commitSha: string): string {
    const { owner, repo, number } = parseUrlParts(prUrl);
    return `${sanitize(owner)}_${sanitize(repo)}_${number}_${sanitize(commitSha)}`;
  }

  private pathFor(prUrl: string, commitSha: string): string {
    return path.join(this.dir, this.keyFor(prUrl, commitSha) + ".json");
  }

  async get(prUrl: string, commitSha: string): Promise<PRAnalysis | null> {
    try {
      const buf = await readFile(this.pathFor(prUrl, commitSha), "utf8");
      return JSON.parse(buf) as PRAnalysis;
    } catch {
      return null;
    }
  }

  async set(prUrl: string, commitSha: string, analysis: PRAnalysis): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.pathFor(prUrl, commitSha), JSON.stringify(analysis, null, 2), "utf8");
  }

  async list(): Promise<CachedAnalysisSummary[]> {
    let entries: string[];
    try {
      entries = await readdir(this.dir);
    } catch {
      return [];
    }
    const out: CachedAnalysisSummary[] = [];
    for (const name of entries) {
      if (!name.endsWith(".json")) continue;
      try {
        const buf = await readFile(path.join(this.dir, name), "utf8");
        const a = JSON.parse(buf) as PRAnalysis;
        out.push({
          key: name.replace(/\.json$/, ""),
          prUrl: a.pr?.url ?? "",
          title: a.pr?.title ?? name,
          headSha: a.pr?.headSha ?? "",
        });
      } catch {
        // skip unreadable
      }
    }
    return out;
  }

  async getByKey(key: string): Promise<PRAnalysis | null> {
    try {
      const buf = await readFile(path.join(this.dir, key + ".json"), "utf8");
      return JSON.parse(buf) as PRAnalysis;
    } catch {
      return null;
    }
  }
}
