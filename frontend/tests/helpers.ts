import type { PRAnalysis, ChangeCluster, FileAnalysis, DiffAnnotation } from "../src/types.js";

export function makeDiffAnnotation(overrides: Partial<DiffAnnotation> = {}): DiffAnnotation {
  return {
    lineStart: 10,
    lineEnd: 12,
    type: "warning",
    message: "Possible null reference",
    ...overrides,
  };
}

export function makeFileAnalysis(overrides: Partial<FileAnalysis> = {}): FileAnalysis {
  return {
    path: "src/utils/helper.ts",
    summary: "Added helper function",
    category: "logic",
    impactScore: 3,
    diff: `--- a/src/utils/helper.ts\n+++ b/src/utils/helper.ts\n@@ -1,3 +1,5 @@\n import { foo } from "bar";\n+import { baz } from "qux";\n-const old = 1;\n+const new_val = 2;`,
    annotations: [makeDiffAnnotation()],
    ...overrides,
  };
}

export function makeCluster(overrides: Partial<ChangeCluster> = {}): ChangeCluster {
  return {
    id: "cluster-1",
    name: "Core Logic Changes",
    summary: "Updates to the main processing pipeline",
    tag: "needs-review",
    priority: 1,
    files: [makeFileAnalysis()],
    insights: ["Important change to data flow"],
    ...overrides,
  };
}

export function makeAnalysis(overrides: Partial<PRAnalysis> = {}): PRAnalysis {
  return {
    id: "analysis-1",
    pr: {
      url: "https://github.com/owner/repo/pull/42",
      title: "Add new feature",
      author: "testuser",
      baseBranch: "main",
      headBranch: "feature/new-thing",
      additions: 150,
      deletions: 30,
      fileCount: 5,
      headSha: "abc123",
    },
    executiveSummary: "This PR adds a new feature for processing data.",
    clusters: [
      makeCluster(),
      makeCluster({
        id: "cluster-2",
        name: "Style Updates",
        tag: "style-only",
        priority: 3,
        summary: "CSS and formatting changes",
      }),
    ],
    timeSaved: "15 minutes",
    ...overrides,
  };
}
