import type { LLMClient } from "../llm-client.js";
import type { FileAnalysis } from "../../types.js";
import { extractJSON } from "./extract-json.js";

// Prepends each diff body line with its new-file line number so the model
// doesn't have to count lines itself. Without this, Claude hallucinates
// line numbers past the end of the file.
export function annotatePatchWithLineNumbers(patch: string): string {
  const lines = patch.split("\n");
  const out: string[] = [];
  const hunkHeader = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
  let nextNew = 0;
  let inHunk = false;

  for (const line of lines) {
    const m = hunkHeader.exec(line);
    if (m) {
      nextNew = parseInt(m[1], 10);
      inHunk = true;
      out.push(`         ${line}`);
      continue;
    }
    if (!inHunk) {
      out.push(`         ${line}`);
      continue;
    }
    const first = line.charAt(0);
    if (first === "+") {
      out.push(`${String(nextNew).padStart(6, " ")}   ${line}`);
      nextNew++;
    } else if (first === "-") {
      out.push(`         ${line}`);
    } else if (first === " ") {
      out.push(`${String(nextNew).padStart(6, " ")}   ${line}`);
      nextNew++;
    } else {
      out.push(`         ${line}`);
    }
  }
  return out.join("\n");
}

export function buildFileAnalyzerPrompt(filename: string, patch: string): string {
  const numbered = annotatePatchWithLineNumbers(patch);
  return `Analyze this file diff from a pull request.

File: ${filename}

Diff (each line is prefixed with its line number in the NEW file; deletions have no number):
\`\`\`
${numbered}
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

Rules for lineStart / lineEnd:
- Use the line numbers shown in the left gutter of the diff above.
- These refer to lines in the NEW file (the "+"/context lines).
- Never reference a line number that does not appear in the gutter.
- If an issue applies to a deleted line, anchor the annotation to the nearest surrounding new-file line instead.

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
