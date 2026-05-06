import { Octokit } from "octokit";
import { parsePrUrl } from "./github.js";
import type {
  ReviewDraft,
  ReviewComment,
  ReviewCommentPayload,
} from "../types.js";

export interface OrphanComment {
  commit_id: string;
  path: string;
  line: number;
  body: string;
  /** Human-readable reason from GitHub (best-effort parsed from the 422 body). */
  reason: string;
}

export interface SubmitReviewResult {
  /** Last successful review's id (kept for back-compat with the single-PR flow). */
  id: number;
  /** Last successful review's html_url (back-compat). */
  htmlUrl: string;
  /** Total number of inline comments accepted by GitHub across all per-commit reviews. */
  submitted: number;
  /** Inline comments rejected because the line/file no longer exists at that commit. */
  orphans: OrphanComment[];
  /**
   * True when at least one comment was rejected as an orphan but the rest of the
   * submission succeeded. The caller (frontend) uses this to surface the
   * promote-to-file-level dialog.
   */
  partial: boolean;
}

interface InlineEntry {
  comment: ReviewComment;
  payload: ReviewCommentPayload;
  commitId: string; // resolved (explicit or fallback head SHA)
}

export async function submitReview(
  draft: ReviewDraft,
  githubToken: string,
): Promise<SubmitReviewResult> {
  const { owner, repo, pullNumber } = parsePrUrl(draft.prUrl);
  const octokit = new Octokit({ auth: githubToken });

  const { inline, summary } = splitDraft(draft);

  // Resolve commit_id per inline comment, falling back to PR head SHA on demand.
  let headSha: string | undefined;
  const needsHead = inline.some((e) => !e.comment.commit_id);
  if (needsHead) {
    const { data } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
    });
    headSha = data.head.sha;
  }
  for (const e of inline) {
    e.commitId = e.comment.commit_id ?? headSha!;
  }

  // No inline comments: single body-only review (back-compat path).
  if (inline.length === 0) {
    const { data } = await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number: pullNumber,
      body: summary,
      event: draft.event,
      comments: [],
    });
    return {
      id: data.id,
      htmlUrl: data.html_url,
      submitted: 0,
      orphans: [],
      partial: false,
    };
  }

  // Group inline comments by commit_id. GitHub's createReview only takes a single
  // top-level commit_id per review, so per-commit anchoring requires one review
  // call per unique SHA.
  const byCommit = new Map<string, InlineEntry[]>();
  for (const e of inline) {
    const list = byCommit.get(e.commitId) ?? [];
    list.push(e);
    byCommit.set(e.commitId, list);
  }

  const orphans: OrphanComment[] = [];
  let submitted = 0;
  let lastResult: { id: number; htmlUrl: string } | undefined;
  let summaryAttached = false;

  for (const [commitId, group] of byCommit) {
    // Attach the verdict (event + body) to the first review only. Subsequent
    // per-commit reviews are plain COMMENT-event reviews so we don't approve /
    // request-changes multiple times.
    const isVerdictCall = !summaryAttached;
    const event = isVerdictCall ? draft.event : "COMMENT";
    const body = isVerdictCall ? summary : "";

    try {
      const { data } = await octokit.rest.pulls.createReview({
        owner,
        repo,
        pull_number: pullNumber,
        commit_id: commitId,
        body,
        event,
        comments: group.map((e) => e.payload),
      });
      submitted += group.length;
      lastResult = { id: data.id, htmlUrl: data.html_url };
      summaryAttached = true;
    } catch (err: any) {
      if (!is422(err)) throw err;

      // 422 on the batched call: GitHub doesn't tell us *which* comment(s) were
      // bad in a structured way. Retry one comment at a time to isolate the
      // orphan(s). The verdict-bearing review still lands as long as ≥1 comment
      // in this group succeeds; otherwise it shifts to the next commit group.
      let groupHadSuccess = false;
      for (const entry of group) {
        // Only the first comment of the first commit-group with no prior
        // verdict-bearing review carries event+body.
        const perCallVerdict = isVerdictCall && !summaryAttached && !groupHadSuccess;
        const perEvent = perCallVerdict ? draft.event : "COMMENT";
        const perBody = perCallVerdict ? summary : "";
        try {
          const { data } = await octokit.rest.pulls.createReview({
            owner,
            repo,
            pull_number: pullNumber,
            commit_id: commitId,
            body: perBody,
            event: perEvent,
            comments: [entry.payload],
          });
          submitted += 1;
          groupHadSuccess = true;
          if (perCallVerdict) summaryAttached = true;
          lastResult = { id: data.id, htmlUrl: data.html_url };
        } catch (innerErr: any) {
          if (!is422(innerErr)) throw innerErr;
          orphans.push({
            commit_id: commitId,
            path: entry.payload.path,
            line: entry.payload.line,
            body: entry.payload.body,
            reason:
              extractReason(innerErr) ??
              "GitHub rejected this comment as no longer anchorable",
          });
        }
      }
    }
  }

  // Edge case: every inline comment was an orphan. We never got a chance to
  // attach the verdict + summary, so post a body-only review now.
  if (!summaryAttached && (summary || draft.event !== "COMMENT")) {
    const { data } = await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number: pullNumber,
      body: summary,
      event: draft.event,
      comments: [],
    });
    lastResult = { id: data.id, htmlUrl: data.html_url };
  }

  return {
    id: lastResult?.id ?? 0,
    htmlUrl: lastResult?.htmlUrl ?? "",
    submitted,
    orphans,
    partial: orphans.length > 0,
  };
}

interface SplitResult {
  inline: InlineEntry[];
  summary: string;
}

function splitDraft(draft: ReviewDraft): SplitResult {
  const inline: InlineEntry[] = [];
  const bodyParts: string[] = [];
  if (draft.summary) bodyParts.push(draft.summary);

  for (const c of draft.comments) {
    switch (c.target.kind) {
      case "line":
        inline.push({
          comment: c,
          payload: {
            path: c.target.path,
            line: c.target.line,
            side: c.target.side,
            body: c.body,
          },
          commitId: "", // resolved by submitReview
        });
        break;
      case "cluster":
        bodyParts.push(`**Cluster ${c.target.clusterId}:** ${c.body}`);
        break;
      case "file":
        bodyParts.push(`**${c.target.path}:** ${c.body}`);
        break;
      case "annotation":
        bodyParts.push(
          `**${c.target.path} (annotation #${c.target.annotationIndex}):** ${c.body}`,
        );
        break;
    }
  }
  return { inline, summary: bodyParts.join("\n\n") };
}

/**
 * Back-compat export used by `tests/integration/review-flow.test.ts`. Returns a
 * single, flat inline payload list (callers there don't care about per-commit
 * grouping). The shape is the same as before — `path`, `line`, `side`, `body`.
 */
export function buildReviewPayload(draft: ReviewDraft): {
  payload: ReviewCommentPayload[];
  summary: string;
} {
  const { inline, summary } = splitDraft(draft);
  return { payload: inline.map((e) => e.payload), summary };
}

function is422(err: any): boolean {
  return err && typeof err === "object" && err.status === 422;
}

/**
 * Best-effort extraction of a human-readable reason from a GitHub 422 body.
 * GitHub's validation_failed_simple shape is `{ message, errors: [...] }` — we
 * surface the first sub-error message, falling back to the top-level message.
 */
function extractReason(err: any): string | undefined {
  const data = err?.response?.data;
  if (!data) return err?.message;
  const subErrors = Array.isArray(data.errors) ? data.errors : [];
  const firstSub = subErrors[0];
  if (firstSub) {
    if (typeof firstSub === "string") return firstSub;
    if (typeof firstSub.message === "string") return firstSub.message;
    if (typeof firstSub.code === "string" && typeof firstSub.field === "string") {
      return `${firstSub.field}: ${firstSub.code}`;
    }
  }
  if (typeof data.message === "string") return data.message;
  return err?.message;
}
