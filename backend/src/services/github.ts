import { Octokit } from "octokit";
import type { PRMetadata } from "../types.js";

export interface PRUrlParts {
  owner: string;
  repo: string;
  pullNumber: number;
}

export interface PRData {
  metadata: PRMetadata;
  files: Array<{ filename: string; patch: string }>;
}

const PR_URL_REGEX = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;

export function parsePrUrl(url: string): PRUrlParts {
  const match = url.match(PR_URL_REGEX);
  if (!match) {
    throw new Error("Invalid GitHub PR URL. Expected: https://github.com/owner/repo/pull/123");
  }
  return { owner: match[1], repo: match[2], pullNumber: parseInt(match[3], 10) };
}

export async function fetchPR(
  parts: PRUrlParts,
  octokit: Octokit
): Promise<PRData> {
  const { owner, repo, pullNumber } = parts;

  const prResponse = await octokit.rest.pulls.get({ owner, repo, pull_number: pullNumber });
  const pr = prResponse.data;

  // Get file list + statuses (paginated, handles >100 files)
  const allFilesRaw = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner, repo, pull_number: pullNumber, per_page: 100,
  });

  // listFiles returns patches for most files, but silently omits them when the
  // total response exceeds GitHub's internal size cap (~1MB combined). For files
  // missing patches, fetch both versions via repos.getContent and compute a real
  // unified diff — same as git does, just client-side.
  const withPatch = allFilesRaw.filter((f: any) => f.patch).length;
  const without = allFilesRaw.filter((f: any) => !f.patch).length;
  if (without > 0) {
    console.log(`[github] ${withPatch} files with patches, ${without} without — will compute diffs for missing`);
  }

  const pLimit = (await import("p-limit")).default;
  const limit = pLimit(5);
  const allFiles = await Promise.all(
    allFilesRaw.map((f: any) =>
      limit(async () => {
        if (f.patch) return { filename: f.filename, patch: f.patch };
        const computed = await computeDiffFromContent(
          octokit, owner, repo, f, pr.head.sha, pr.base.sha,
        );
        if (computed) return { filename: f.filename, patch: computed };
        return {
          filename: f.filename,
          patch: `[Binary file — no text diff available]`,
        };
      }),
    ),
  );

  const metadata: PRMetadata = {
    url: `https://github.com/${owner}/${repo}/pull/${pullNumber}`,
    title: pr.title,
    author: pr.user?.login ?? "unknown",
    baseBranch: pr.base.ref,
    headBranch: pr.head.ref,
    additions: pr.additions,
    deletions: pr.deletions,
    fileCount: pr.changed_files,
    headSha: pr.head.sha,
  };

  return { metadata, files: allFiles };
}

export function createOctokit(token: string): Octokit {
  return new Octokit({ auth: token });
}

const MAX_CONTENT_BYTES = 512 * 1024; // skip files larger than 512KB

/**
 * Fetch file content at a given ref. Returns null for binary, missing, or oversized files.
 */
async function fetchContent(
  octokit: Octokit, owner: string, repo: string, path: string, ref: string,
): Promise<string | null> {
  try {
    const res = await octokit.rest.repos.getContent({ owner, repo, path, ref });
    const d: any = res.data;
    if (Array.isArray(d) || d.type !== "file") return null;
    if (d.size > MAX_CONTENT_BYTES) return null;
    if (!d.content) return null;
    return Buffer.from(d.content, d.encoding === "base64" ? "base64" : "utf8").toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Compute a real unified diff for a file by fetching both base and head versions.
 * Uses the `diff` library — same algorithm as git.
 */
async function computeDiffFromContent(
  octokit: Octokit, owner: string, repo: string,
  file: any, headSha: string, baseSha: string,
): Promise<string | null> {
  const status: string = file.status ?? "modified";
  const oldPath = file.previous_filename ?? file.filename;

  const [oldText, newText] = await Promise.all([
    status === "added" ? Promise.resolve("") : fetchContent(octokit, owner, repo, oldPath, baseSha),
    status === "removed" ? Promise.resolve("") : fetchContent(octokit, owner, repo, file.filename, headSha),
  ]);

  // If we couldn't fetch either side, give up (binary or too large)
  if (oldText === null || newText === null) return null;

  const { createPatch } = await import("diff");
  const patch = createPatch(file.filename, oldText, newText, "", "", { context: 3 });

  // Strip the file header lines (--- +++ etc.) — keep only from first @@ onward,
  // matching the format listFiles.patch uses.
  const lines = patch.split("\n");
  const hunkStart = lines.findIndex((l) => l.startsWith("@@"));
  if (hunkStart === -1) return null; // identical files
  return lines.slice(hunkStart).join("\n").replace(/\s+$/, "");
}
