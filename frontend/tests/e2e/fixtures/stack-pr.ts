/**
 * Deterministic fixture for the Phase 1.7 stack walkthrough E2E test.
 *
 * Models a 5-commit PR. Commits are ordered oldest -> newest:
 *
 *   level 0  feature  add base scaffolding
 *   level 1  feature  add user model
 *   level 2  feature  wire validation pipeline
 *   level 3  noise    fixup! wire validation pipeline    <- auto-collapsed
 *   level 4  feature  expose validation as a service
 *
 * Each non-noise level has a pre-baked `analysis` payload with a unique
 * marker string in its `executiveSummary` so the test can assert it
 * actually swapped the rendered analysis when the user clicks a different
 * level.
 */

import type { PRAnalysis } from "../../../src/types.js";

export const PR_OWNER = "fixture-org";
export const PR_REPO = "fixture-repo";
export const PR_NUMBER = "42";
export const PR_URL = `https://github.com/${PR_OWNER}/${PR_REPO}/pull/${PR_NUMBER}`;
export const BASE_SHA = "ba5e0000ba5e0000ba5e0000ba5e0000ba5e0000";

export interface FixtureLevel {
  sha: string;
  shortSha: string;
  message: string;
  parentSha: string;
  kind: "feature" | "noise";
  noiseReason?: string;
  files: string[];
  status: "ready" | "pending";
  analysis?: PRAnalysis;
}

function mkAnalysis(opts: {
  sha: string;
  marker: string;
  filePath: string;
  fileSummary: string;
  diff: string;
}): PRAnalysis {
  return {
    id: `analysis-${opts.sha.slice(0, 7)}`,
    pr: {
      url: PR_URL,
      title: "Stacked PR — fixture",
      author: "fixture-author",
      baseBranch: "main",
      headBranch: "feature/stack",
      additions: 12,
      deletions: 3,
      fileCount: 1,
      headSha: opts.sha,
    },
    executiveSummary: opts.marker,
    timeSaved: "5m",
    clusters: [
      {
        id: `cluster-${opts.sha.slice(0, 7)}`,
        name: `Cluster for ${opts.sha.slice(0, 7)}`,
        summary: `Files changed at ${opts.sha.slice(0, 7)}`,
        tag: "needs-review",
        priority: 1,
        insights: [opts.marker],
        files: [
          {
            path: opts.filePath,
            summary: opts.fileSummary,
            category: "logic",
            impactScore: 4,
            diff: opts.diff,
            annotations: [],
          },
        ],
      },
    ],
  };
}

const SHA_0 = "1111111111111111111111111111111111111111";
const SHA_1 = "2222222222222222222222222222222222222222";
const SHA_2 = "3333333333333333333333333333333333333333";
const SHA_3 = "4444444444444444444444444444444444444444"; // noise (fixup!)
const SHA_4 = "5555555555555555555555555555555555555555";

const DIFF_BOILER = `--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,3 +1,5 @@
 export function foo() {
+  // added
+  return 1;
 }
`;

export const FIXTURE_LEVELS: FixtureLevel[] = [
  {
    sha: SHA_0,
    shortSha: SHA_0.slice(0, 7),
    message: "feat: add base scaffolding",
    parentSha: BASE_SHA,
    kind: "feature",
    files: ["src/scaffold.ts"],
    status: "ready",
    analysis: mkAnalysis({
      sha: SHA_0,
      marker: "LEVEL_0_MARKER scaffolding lays the groundwork",
      filePath: "src/scaffold.ts",
      fileSummary: "Creates the base scaffolding module.",
      diff: DIFF_BOILER,
    }),
  },
  {
    sha: SHA_1,
    shortSha: SHA_1.slice(0, 7),
    message: "feat: add user model",
    parentSha: SHA_0,
    kind: "feature",
    files: ["src/user.ts"],
    status: "ready",
    analysis: mkAnalysis({
      sha: SHA_1,
      marker: "LEVEL_1_MARKER user model defines the domain entity",
      filePath: "src/user.ts",
      fileSummary: "Adds the User model with id and email.",
      diff: DIFF_BOILER,
    }),
  },
  {
    sha: SHA_2,
    shortSha: SHA_2.slice(0, 7),
    message: "feat: wire validation pipeline",
    parentSha: SHA_1,
    kind: "feature",
    files: ["src/validation.ts"],
    status: "ready",
    analysis: mkAnalysis({
      sha: SHA_2,
      marker: "LEVEL_2_MARKER validation pipeline is the heart of the change",
      filePath: "src/validation.ts",
      fileSummary: "Adds the validation pipeline.",
      diff: DIFF_BOILER,
    }),
  },
  {
    // Fixup commit — classifier returns "noise" because subject matches
    // /^(fixup|squash)!\s/. No analysis is ever produced for noise levels.
    sha: SHA_3,
    shortSha: SHA_3.slice(0, 7),
    message: "fixup! wire validation pipeline",
    parentSha: SHA_2,
    kind: "noise",
    noiseReason: "fixup commit",
    files: ["src/validation.ts"],
    status: "pending",
  },
  {
    sha: SHA_4,
    shortSha: SHA_4.slice(0, 7),
    message: "feat: expose validation as a service",
    parentSha: SHA_3,
    kind: "feature",
    files: ["src/validation-service.ts"],
    status: "ready",
    analysis: mkAnalysis({
      sha: SHA_4,
      marker: "LEVEL_4_MARKER service surface for consumers",
      filePath: "src/validation-service.ts",
      fileSummary: "Wraps the pipeline behind a service interface.",
      diff: DIFF_BOILER,
    }),
  },
];

export const HEAD_SHA = SHA_4;

/**
 * The whole-PR analysis returned via the legacy `complete` WS event.
 * Mirrors the level-4 analysis (= the head commit) since the legacy flow
 * always renders the head-commit view.
 */
export const FIXTURE_PR_ANALYSIS: PRAnalysis =
  FIXTURE_LEVELS[FIXTURE_LEVELS.length - 1].analysis!;
