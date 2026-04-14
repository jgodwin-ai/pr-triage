import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { PRAnalysis } from "../types.js";

function sanitize(s: string): string {
  return s.replace(/[^a-z0-9-]/gi, "_");
}

function parseUrlParts(prUrl: string): { owner: string; repo: string; number: string } {
  const m = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!m) return { owner: "unknown", repo: "unknown", number: "0" };
  return { owner: m[1], repo: m[2], number: m[3] };
}

export class AnalysisCache {
  constructor(private dir: string) {}

  keyFor(prUrl: string, headSha: string): string {
    const { owner, repo, number } = parseUrlParts(prUrl);
    return `${sanitize(owner)}_${sanitize(repo)}_${number}_${sanitize(headSha)}`;
  }

  private pathFor(prUrl: string, headSha: string): string {
    return path.join(this.dir, this.keyFor(prUrl, headSha) + ".json");
  }

  async get(prUrl: string, headSha: string): Promise<PRAnalysis | null> {
    try {
      const buf = await readFile(this.pathFor(prUrl, headSha), "utf8");
      return JSON.parse(buf) as PRAnalysis;
    } catch {
      return null;
    }
  }

  async set(prUrl: string, headSha: string, analysis: PRAnalysis): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.pathFor(prUrl, headSha), JSON.stringify(analysis, null, 2), "utf8");
  }
}
