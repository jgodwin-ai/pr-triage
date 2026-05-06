import { Router } from "express";
import { submitReview } from "../services/github-review.js";
import type { ReviewDraft } from "../types.js";

const router = Router();

router.post("/", async (req, res) => {
  const { prUrl, githubToken, summary, event, comments } = req.body as {
    prUrl?: string;
    githubToken?: string;
    summary?: string;
    event?: ReviewDraft["event"];
    comments?: ReviewDraft["comments"];
  };

  if (!prUrl) {
    res.status(400).json({ error: "prUrl required" });
    return;
  }
  const token = githubToken || process.env.GITHUB_TOKEN;
  if (!token) {
    res.status(400).json({ error: "GitHub token required" });
    return;
  }

  try {
    const result = await submitReview(
      { prUrl, summary: summary ?? "", event: event ?? "COMMENT", comments: comments ?? [] },
      token,
    );
    res.json({
      reviewId: result.id,
      htmlUrl: result.htmlUrl,
      submitted: result.submitted,
      orphans: result.orphans,
      partial: result.partial,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Failed to submit review" });
  }
});

export default router;
