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

  const [prResponse, filesResponse] = await Promise.all([
    octokit.rest.pulls.get({ owner, repo, pull_number: pullNumber }),
    octokit.rest.pulls.listFiles({ owner, repo, pull_number: pullNumber, per_page: 100 }),
  ]);

  const pr = prResponse.data;

  const metadata: PRMetadata = {
    url: `https://github.com/${owner}/${repo}/pull/${pullNumber}`,
    title: pr.title,
    author: pr.user?.login ?? "unknown",
    baseBranch: pr.base.ref,
    headBranch: pr.head.ref,
    additions: pr.additions,
    deletions: pr.deletions,
    fileCount: pr.changed_files,
  };

  const files = filesResponse.data.map((f) => ({
    filename: f.filename,
    patch: f.patch ?? "",
  }));

  return { metadata, files };
}

export function createOctokit(token: string): Octokit {
  return new Octokit({ auth: token });
}
