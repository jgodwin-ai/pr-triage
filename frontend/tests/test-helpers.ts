import type { PRAnalysis, ChangeCluster, FileAnalysis, DiffAnnotation } from "../src/types.js";

export const mockAnnotation: DiffAnnotation = {
  lineStart: 5,
  lineEnd: 7,
  type: "warning",
  message: "Potential null reference",
};

export const mockFile: FileAnalysis = {
  path: "src/app.ts",
  summary: "Adds error handling",
  category: "logic",
  impactScore: 3,
  diff: "@@ -1,3 +1,5 @@\n-old line\n+new line\n unchanged",
  annotations: [mockAnnotation],
};

export const mockCluster: ChangeCluster = {
  id: "main-changes",
  name: "Core Logic Changes",
  summary: "Main application logic updates",
  tag: "needs-review",
  priority: 1,
  files: [mockFile],
  insights: ["Ripple effect detected"],
};

export const mockAnalysis: PRAnalysis = {
  id: "test-123",
  pr: {
    url: "https://github.com/octocat/repo/pull/42",
    title: "Fix authentication bug",
    author: "octocat",
    baseBranch: "main",
    headBranch: "fix/auth",
    additions: 50,
    deletions: 10,
    fileCount: 3,
  },
  executiveSummary: "This PR fixes a critical auth bug. Review core changes carefully.",
  clusters: [mockCluster],
  timeSaved: "~15 min",
};
