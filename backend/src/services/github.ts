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

  // Paginate via Octokit — handles >100 files correctly
  const allFilesRaw = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner, repo, pull_number: pullNumber, per_page: 100,
  });

  // Fill in patches GitHub omitted (huge PRs, truncated). For non-removed files,
  // fetch the file body at head SHA and synthesize a unified patch.
  const limit = (await import("p-limit")).default(5);
  const allFiles = await Promise.all(
    allFilesRaw.map((f: any) =>
      limit(async () => {
        if (f.patch) return { filename: f.filename, patch: f.patch };
        const synthesized = await tryBuildPatchFromContents(octokit, owner, repo, f, pr.head.sha, pr.base.sha);
        if (synthesized) return { filename: f.filename, patch: synthesized };
        return {
          filename: f.filename,
          patch: `[No diff available — ${f.status ?? "changed"} (binary or truncated)]`,
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

const MAX_FILE_BYTES = 512 * 1024; // 512KB per file cap when synthesizing patches

async function fetchFileContent(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<string | null> {
  try {
    const res = await octokit.rest.repos.getContent({ owner, repo, path, ref });
    const data: any = res.data;
    if (Array.isArray(data) || data.type !== "file") return null;
    if (typeof data.size === "number" && data.size > MAX_FILE_BYTES) return null;
    if (typeof data.content !== "string") return null;
    const buf = Buffer.from(data.content, data.encoding === "base64" ? "base64" : "utf8");
    return buf.toString("utf8");
  } catch {
    return null;
  }
}

function buildUnifiedPatch(oldLines: string[], newLines: string[]): string {
  // Very simple "all replaced" patch — good enough for display.
  const oldCount = oldLines.length;
  const newCount = newLines.length;
  const header = `@@ -${oldCount === 0 ? 0 : 1},${oldCount} +${newCount === 0 ? 0 : 1},${newCount} @@`;
  const body = [
    ...oldLines.map((l) => `-${l}`),
    ...newLines.map((l) => `+${l}`),
  ].join("\n");
  return body ? `${header}\n${body}` : header;
}

async function tryBuildPatchFromContents(
  octokit: Octokit,
  owner: string,
  repo: string,
  file: any,
  headSha: string,
  baseSha: string,
): Promise<string | null> {
  const status = file.status ?? "modified";
  if (status === "removed") {
    const oldText = await fetchFileContent(octokit, owner, repo, file.previous_filename ?? file.filename, baseSha);
    if (oldText == null) return null;
    return buildUnifiedPatch(oldText.split("\n"), []);
  }
  if (status === "added") {
    const newText = await fetchFileContent(octokit, owner, repo, file.filename, headSha);
    if (newText == null) return null;
    return buildUnifiedPatch([], newText.split("\n"));
  }
  // modified / renamed / copied: try both sides
  const [oldText, newText] = await Promise.all([
    fetchFileContent(octokit, owner, repo, file.previous_filename ?? file.filename, baseSha),
    fetchFileContent(octokit, owner, repo, file.filename, headSha),
  ]);
  if (newText == null) return null;
  return buildUnifiedPatch(oldText?.split("\n") ?? [], newText.split("\n"));
}
