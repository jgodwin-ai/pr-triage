import { ClaudeCliClient } from "./claude-cli-client.js";
import { AnthropicSdkClient } from "./anthropic-sdk-client.js";
import type { LLMClient } from "./llm-client.js";

export function createLLMClient(anthropicKey?: string): LLMClient {
  const key = anthropicKey || process.env.ANTHROPIC_API_KEY;
  if (key) return new AnthropicSdkClient(key);
  return new ClaudeCliClient();
}
