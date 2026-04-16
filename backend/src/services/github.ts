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

  // Get authoritative per-file patches from the PR's unified diff.
  // listFiles.patch silently truncates in very large PRs; the diff media type does not.
  const patchByFilename = await fetchUnifiedDiffPatches(octokit, owner, repo, pullNumber);

  const allFiles: Array<{ filename: string; patch: string }> = allFilesRaw.map((f: any) => {
    const patch = patchByFilename.get(f.filename);
    if (patch) return { filename: f.filename, patch };
    // Binary file or truly patch-less
    return {
      filename: f.filename,
      patch: `[No diff available — ${f.status ?? "changed"} (binary)]`,
    };
  });

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

/**
 * Fetch the PR's full unified diff (Accept: application/vnd.github.v3.diff)
 * and parse it into per-file patches. GitHub returns authoritative patches
 * without the silent truncation that affects listFiles.
 */
async function fetchUnifiedDiffPatches(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    const res = await octokit.rest.pulls.get({
      owner, repo, pull_number: pullNumber,
      mediaType: { format: "diff" },
    });
    const diffText: string = typeof res.data === "string" ? (res.data as string) : String(res.data);
    for (const [filename, patch] of parseUnifiedDiff(diffText)) {
      out.set(filename, patch);
    }
  } catch {
    // Fall back silently — caller will show "binary" placeholder for missing patches.
  }
  return out;
}

/**
 * Split a full unified diff into per-file [filename, patchBody] pairs.
 * patchBody is just the hunks (starting with @@), matching what listFiles.patch returns.
 */
function parseUnifiedDiff(diff: string): Array<[string, string]> {
  const results: Array<[string, string]> = [];
  if (!diff) return results;
  const blocks = diff.split(/^diff --git /m).filter((b) => b.trim().length > 0);
  for (const block of blocks) {
    const lines = block.split("\n");
    // First line is "a/path b/path"
    const headerLine = lines[0];
    const bMatch = headerLine.match(/ b\/(.+)$/);
    const filename = bMatch?.[1]?.trim();
    if (!filename) continue;
    // Patch body is everything from the first @@ onward
    const hunkStart = lines.findIndex((l) => l.startsWith("@@"));
    if (hunkStart === -1) continue; // binary file, no hunks in diff
    const patch = lines.slice(hunkStart).join("\n").replace(/\s+$/, "");
    results.push([filename, patch]);
  }
  return results;
}
