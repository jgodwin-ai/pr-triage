import pLimit from "p-limit";
import type { FileAnalysis } from "../../types.js";
import type { LLMClient } from "../llm-client.js";
import { ClaudeCliClient } from "../claude-cli-client.js";
import { analyzeFile, buildFileAnalyzerPrompt } from "./file-analyzer.js";
import { extractJSON } from "./extract-json.js";

export async function analyzeFilesBatch(
  files: Array<{ filename: string; patch: string }>,
  client: LLMClient,
  onProgress: (done: number, total: number) => void,
): Promise<FileAnalysis[]> {
  if (client instanceof ClaudeCliClient && files.length > 1) {
    onProgress(0, files.length);
    const tasks = files.map((f, i) => ({
      id: String(i),
      prompt: buildFileAnalyzerPrompt(f.filename, f.patch),
    }));
    const results = await client.fanOut(tasks);
    onProgress(files.length, files.length);

    return results.map((r) => {
      const idx = Number(r.id);
      const file = files[idx];
      const parsed = extractJSON(r.result) as any;
      return {
        path: parsed.path ?? file.filename,
        summary: parsed.summary,
        category: parsed.category,
        impactScore: parsed.impactScore,
        diff: file.patch,
        annotations: parsed.annotations ?? [],
      };
    });
  }

  // Fallback: parallel single-shot calls
  const limit = pLimit(5);
  let done = 0;
  onProgress(0, files.length);
  return Promise.all(
    files.map((file) =>
      limit(async () => {
        const result = await analyzeFile(file, client);
        done++;
        onProgress(done, files.length);
        return result;
      }),
    ),
  );
}
