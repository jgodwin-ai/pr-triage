import { Router } from "express";

const router = Router();

router.get("/status", (_req, res) => {
  res.json({
    githubTokenConfigured: !!process.env.GITHUB_TOKEN,
    // Anthropic key is optional — Claude CLI is used as fallback
    anthropicKeyConfigured: !!process.env.ANTHROPIC_API_KEY,
    llmProvider: process.env.ANTHROPIC_API_KEY ? "anthropic-sdk" : "claude-cli",
  });
});

export default router;
