import { Router } from "express";

const router = Router();

router.get("/status", (_req, res) => {
  res.json({
    anthropicKeyConfigured: !!process.env.ANTHROPIC_API_KEY,
    githubTokenConfigured: !!process.env.GITHUB_TOKEN,
  });
});

export default router;
