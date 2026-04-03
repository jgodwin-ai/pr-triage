/**
 * LLM client that uses the `claude` CLI — uses your existing Claude Code auth.
 * No API key needed.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import type { LLMClient } from "./llm-client.js";

const execFileAsync = promisify(execFile);

export class ClaudeCliClient implements LLMClient {
  private model: string;
  private maxTokens: number;

  constructor(opts?: { model?: string; maxTokens?: number }) {
    this.model = opts?.model ?? "sonnet";
    this.maxTokens = opts?.maxTokens ?? 4096;
  }

  async complete(prompt: string): Promise<string> {
    const { stdout } = await execFileAsync("claude", [
      "-p", prompt,
      "--model", this.model,
      "--max-tokens", String(this.maxTokens),
    ], {
      maxBuffer: 10 * 1024 * 1024, // 10MB — large diffs can produce big output
      timeout: 120_000, // 2 minute timeout per call
    });

    return stdout.trim();
  }
}
