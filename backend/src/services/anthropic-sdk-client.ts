/**
 * LLM client that uses the Anthropic SDK directly — requires an API key.
 * Keep this around for when you want to switch back to API key auth.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { LLMClient } from "./llm-client.js";

export class AnthropicSdkClient implements LLMClient {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;

  constructor(apiKey: string, opts?: { model?: string; maxTokens?: number }) {
    this.client = new Anthropic({ apiKey });
    this.model = opts?.model ?? "claude-sonnet-4-6";
    this.maxTokens = opts?.maxTokens ?? 4096;
  }

  async complete(prompt: string): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      messages: [{ role: "user", content: prompt }],
    });

    if (!response.content || response.content.length === 0) {
      throw new Error("Claude returned empty response content");
    }
    const block = response.content[0];
    if (block.type !== "text" || !block.text) {
      throw new Error(`Claude returned non-text content block: ${block.type}`);
    }
    return block.text;
  }
}
