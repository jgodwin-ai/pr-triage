/**
 * Extract JSON from an LLM response, handling markdown fences and parse errors.
 */
export function extractJSON(text: string): unknown {
  // Strip markdown fences if present
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  const jsonStr = fenceMatch ? fenceMatch[1] : text.trim();

  try {
    return JSON.parse(jsonStr);
  } catch {
    throw new Error(`Failed to parse LLM response as JSON. Raw text: ${text.slice(0, 200)}`);
  }
}
