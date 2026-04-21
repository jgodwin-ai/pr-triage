import { Octokit } from "octokit";
import { parsePrUrl } from "./github.js";
import type { ReviewDraft, ReviewCommentPayload } from "../types.js";

export async function submitReview(
  draft: ReviewDraft,
  githubToken: string,
): Promise<{ id: number; htmlUrl: string }> {
  const { owner, repo, pullNumber } = parsePrUrl(draft.prUrl);
  const octokit = new Octokit({ auth: githubToken });

  const { payload, summary } = buildReviewPayload(draft);

  const { data } = await octokit.rest.pulls.createReview({
    owner,
    repo,
    pull_number: pullNumber,
    body: summary,
    event: draft.event,
    comments: payload,
  });

  return { id: data.id, htmlUrl: data.html_url };
}

export function buildReviewPayload(draft: ReviewDraft): { payload: ReviewCommentPayload[]; summary: string } {
  const inline: ReviewCommentPayload[] = [];
  const bodyParts: string[] = [];
  if (draft.summary) bodyParts.push(draft.summary);

  for (const c of draft.comments) {
    switch (c.target.kind) {
      case "line":
        inline.push({ path: c.target.path, line: c.target.line, side: c.target.side, body: c.body });
        break;
      case "cluster":
        bodyParts.push(`**Cluster ${c.target.clusterId}:** ${c.body}`);
        break;
      case "file":
        bodyParts.push(`**${c.target.path}:** ${c.body}`);
        break;
      case "annotation":
        bodyParts.push(`**${c.target.path} (annotation #${c.target.annotationIndex}):** ${c.body}`);
        break;
    }
  }
  return { payload: inline, summary: bodyParts.join("\n\n") };
}
