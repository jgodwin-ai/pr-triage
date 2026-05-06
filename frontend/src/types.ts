export interface PRAnalysis {
  id: string;
  pr: PRMetadata;
  executiveSummary: string;
  clusters: ChangeCluster[];
  timeSaved: string;
}

export interface PRMetadata {
  url: string;
  title: string;
  author: string;
  baseBranch: string;
  headBranch: string;
  additions: number;
  deletions: number;
  fileCount: number;
  headSha: string;
}

export interface ChangeCluster {
  id: string;
  name: string;
  summary: string;
  tag: "needs-review" | "low-risk" | "boilerplate" | "style-only";
  priority: number;
  files: FileAnalysis[];
  insights: string[];
}

export interface FileAnalysis {
  path: string;
  summary: string;
  category: "logic" | "style" | "config" | "test" | "boilerplate" | "docs";
  impactScore: number;
  diff: string;
  annotations: DiffAnnotation[];
}

export interface DiffAnnotation {
  lineStart: number;
  lineEnd: number;
  type: "warning" | "info" | "suggestion";
  message: string;
}

export type AnalysisStage =
  | "fetching-pr"
  | "file-analysis"
  | "clustering"
  | "ranking"
  | "complete"
  | "error";

export interface WSMessage {
  type: "status" | "partial" | "complete" | "error";
  stage?: AnalysisStage;
  progress?: string;
  clusters?: ChangeCluster[];
  analysis?: PRAnalysis;
  error?: string;
}

export type CommentTarget =
  | { kind: "cluster"; clusterId: string }
  | { kind: "file"; clusterId: string; path: string }
  | { kind: "line"; clusterId: string; path: string; line: number; side: "LEFT" | "RIGHT" }
  | { kind: "annotation"; clusterId: string; path: string; annotationIndex: number };

export interface ReviewComment {
  id: string;
  target: CommentTarget;
  body: string;
  createdAt: number;
  stale?: boolean;
}

export interface ReviewDraft {
  prUrl: string;
  comments: ReviewComment[];
  event: "COMMENT" | "APPROVE" | "REQUEST_CHANGES";
  summary: string;
}

/**
 * An inline review comment that GitHub rejected at submit time because the
 * line/file no longer exists at the anchored commit. Mirrors the backend
 * `OrphanComment` shape from `backend/src/services/github-review.ts`.
 */
export interface OrphanedComment {
  commit_id: string;
  path: string;
  line: number;
  body: string;
  /** Human-readable reason returned by the backend (best-effort GitHub 422 text). */
  reason: string;
}

/** Response shape for POST /api/review. */
export interface SubmitReviewResponse {
  reviewId: number;
  htmlUrl: string;
  submitted: number;
  orphans: OrphanedComment[];
  partial: boolean;
}
