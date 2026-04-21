/**
 * LLM client that uses the `claude` CLI — uses your existing Claude Code auth.
 * No API key needed.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, writeFile, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import type { LLMClient } from "./llm-client.js";

const execFileAsync = promisify(execFile);

export class ClaudeCliClient implements LLMClient {
  private model: string;

  constructor(opts?: { model?: string }) {
    this.model = opts?.model ?? "sonnet";
  }

  async complete(prompt: string): Promise<string> {
    const { stdout } = await execFileAsync("claude", [
      "-p", prompt,
      "--model", this.model,
    ], {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 120_000,
    });

    return stdout.trim();
  }

  /**
   * Fan out N independent tasks into a single Claude invocation using Task subagents.
   * Each task writes its JSON result to disk; we read them back.
   * One CLI cold-start for N parallel analyses.
   */
  async fanOut(tasks: Array<{ id: string; prompt: string }>): Promise<Array<{ id: string; result: string }>> {
    const workDir = await mkdtemp(path.join(tmpdir(), "pr-triage-fanout-"));
    try {
      // Write each task's prompt to its own input file (keeps orchestrator prompt small)
      await Promise.all(
        tasks.map((t) =>
          writeFile(path.join(workDir, `input-${t.id}.txt`), t.prompt, "utf8"),
        ),
      );

      const taskList = tasks.map((t) => `- id "${t.id}": read ${workDir}/input-${t.id}.txt, write result to ${workDir}/output-${t.id}.json`).join("\n");

      const orchestratorPrompt = `You have ${tasks.length} independent analysis tasks. Dispatch them ALL IN PARALLEL by making a single message with ${tasks.length} Task tool calls (one per task). Do not run them sequentially.

Tasks:
${taskList}

For each task, launch a general-purpose subagent with this instruction:
"Read the prompt from the specified input file. Follow its instructions exactly. Write your raw JSON response (no markdown fences, no commentary) to the specified output file using the Write tool. Do not return a summary — only write the file."

After all subagents complete, respond with just the text "DONE". Do not summarize results.`;

      await execFileAsync("claude", [
        "-p", orchestratorPrompt,
        "--model", this.model,
        "--permission-mode", "bypassPermissions",
        "--allowedTools", "Task,Read,Write",
        "--add-dir", workDir,
      ], {
        maxBuffer: 10 * 1024 * 1024,
        timeout: 600_000, // 10 minute ceiling for big PRs
      });

      const results = await Promise.all(
        tasks.map(async (t) => {
          const out = await readFile(path.join(workDir, `output-${t.id}.json`), "utf8");
          return { id: t.id, result: out };
        }),
      );
      return results;
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }
}
