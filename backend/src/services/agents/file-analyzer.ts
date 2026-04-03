import type { LLMClient } from "../llm-client.js";
import type { FileAnalysis } from "../../types.js";
import { extractJSON } from "./extract-json.js";

export function buildFileAnalyzerPrompt(filename: string, patch: string): string {
  return `Analyze this file diff from a pull request.

File: ${filename}

Diff:
\`\`\`
${patch}
\`\`\`

Respond with JSON only — no markdown fences, no commentary. Use this exact schema:
{
  "path": "${filename}",
  "summary": "1-2 sentence description of what changed and why it matters",
  "category": "logic" | "style" | "config" | "test" | "boilerplate" | "docs",
  "impactScore": 1-5 (1=trivial, 5=critical),
  "annotations": [
    {
      "lineStart": <number>,
      "lineEnd": <number>,
      "type": "warning" | "info" | "suggestion",
      "message": "specific concern or note"
    }
  ]
}

Category guide:
- logic: behavioral changes, new features, bug fixes, algorithm changes
- style: formatting, naming, code organization without behavior change
- config: build config, CI, dependency changes
- test: test additions or modifications
- boilerplate: generated code, scaffolding, repetitive patterns
- docs: documentation, comments, READMEs`;
}

export async function analyzeFile(
  file: { filename: string; patch: string },
  client: LLMClient
): Promise<FileAnalysis> {
  const text = await client.complete(buildFileAnalyzerPrompt(file.filename, file.patch));
  const parsed = extractJSON(text) as any;

  return {
    path: parsed.path,
    summary: parsed.summary,
    category: parsed.category,
    impactScore: parsed.impactScore,
    diff: file.patch,
    annotations: parsed.annotations ?? [],
  };
}
