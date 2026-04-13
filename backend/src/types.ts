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

export interface AnalyzeRequest {
  prUrl: string;
  anthropicApiKey?: string;
  githubToken?: string;
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
}

export interface ReviewDraft {
  prUrl: string;
  comments: ReviewComment[];
  event: "COMMENT" | "APPROVE" | "REQUEST_CHANGES";
  summary: string;
}

export interface ReviewCommentPayload {
  path: string;
  line: number;
  side: "LEFT" | "RIGHT";
  body: string;
}
