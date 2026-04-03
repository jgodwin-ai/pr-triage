/**
 * Extract JSON from Claude's response text, handling markdown fences and parse errors.
 */
export function extractJSON(text: string): unknown {
  // Strip markdown fences if present
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  const jsonStr = fenceMatch ? fenceMatch[1] : text.trim();

  try {
    return JSON.parse(jsonStr);
  } catch {
    throw new Error(`Failed to parse Claude response as JSON. Raw text: ${text.slice(0, 200)}`);
  }
}

/**
 * Extract text content from Claude response, with validation.
 */
export function getResponseText(response: { content: Array<{ type: string; text?: string }> }): string {
  if (!response.content || response.content.length === 0) {
    throw new Error("Claude returned empty response content");
  }
  const block = response.content[0];
  if (block.type !== "text" || !block.text) {
    throw new Error(`Claude returned non-text content block: ${block.type}`);
  }
  return block.text;
}
