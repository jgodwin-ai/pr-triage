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
