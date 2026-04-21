import type { ChangeCluster, FileAnalysis } from "../../types.js";

// Deterministically derive a cluster tag from the per-file analyses.
// Kept out of the LLM because it kept producing inconsistent tags that
// didn't line up with impactScore.
export function deriveTag(files: FileAnalysis[]): ChangeCluster["tag"] {
  if (files.length === 0) return "low-risk";
  const maxImpact = Math.max(...files.map((f) => f.impactScore));
  const cats = new Set(files.map((f) => f.category));

  if (maxImpact >= 4) return "needs-review";
  if (cats.size === 1 && cats.has("style")) return "style-only";
  if (cats.size === 1 && cats.has("boilerplate")) return "boilerplate";
  if (maxImpact >= 3 && cats.has("logic")) return "needs-review";
  return "low-risk";
}
