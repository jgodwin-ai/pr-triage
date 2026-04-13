/**
 * Extract JSON from an LLM response, handling markdown fences and parse errors.
 */
export function extractJSON(text: string): unknown {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  const candidates: string[] = [];
  if (fenceMatch) candidates.push(fenceMatch[1]);
  candidates.push(text.trim());

  for (const c of candidates) {
    try { return JSON.parse(c); } catch { /* try next */ }
  }

  // Fall back: extract first balanced {...} or [...] substring
  const sliced = sliceBalanced(text);
  if (sliced) {
    try { return JSON.parse(sliced); } catch { /* fall through */ }
  }

  throw new Error(`Failed to parse LLM response as JSON. Raw text: ${text.slice(0, 500)}`);
}

function sliceBalanced(text: string): string | null {
  const openIdx = text.search(/[{\[]/);
  if (openIdx < 0) return null;
  const open = text[openIdx];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = openIdx; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(openIdx, i + 1);
    }
  }
  return null;
}
