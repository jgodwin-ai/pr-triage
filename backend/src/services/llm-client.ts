/**
 * LLM Client abstraction — swap between Claude CLI, Anthropic SDK, or any other provider.
 *
 * All agents depend on this interface, not a concrete implementation.
 * To switch providers, change the factory function in index.ts.
 */

export interface LLMClient {
  /** Send a prompt and get a text response back. */
  complete(prompt: string): Promise<string>;
}

export type LLMProvider = "claude-cli" | "anthropic-sdk";
