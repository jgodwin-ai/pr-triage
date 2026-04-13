import { describe, it, expect } from "vitest";
import { extractJSON } from "../../../src/services/agents/extract-json.js";

describe("extractJSON", () => {
  it("parses plain JSON", () => {
    const result = extractJSON('{"key": "value"}');
    expect(result).toEqual({ key: "value" });
  });

  it("parses markdown-fenced JSON with language tag", () => {
    const result = extractJSON('```json\n{"key": "value"}\n```');
    expect(result).toEqual({ key: "value" });
  });

  it("parses markdown-fenced JSON without language tag", () => {
    const result = extractJSON('```\n{"key": "value"}\n```');
    expect(result).toEqual({ key: "value" });
  });

  it("handles leading/trailing whitespace", () => {
    const result = extractJSON('  \n  {"key": "value"}  \n  ');
    expect(result).toEqual({ key: "value" });
  });

  it("throws descriptive error on invalid JSON", () => {
    expect(() => extractJSON("not json at all")).toThrow("Failed to parse LLM response as JSON");
    expect(() => extractJSON("not json at all")).toThrow("not json at all");
  });

  it("truncates raw text in error message to 500 chars", () => {
    const longText = "x".repeat(600);
    try {
      extractJSON(longText);
    } catch (e: any) {
      expect(e.message).toContain("x".repeat(500));
      expect(e.message).not.toContain("x".repeat(501));
    }
  });
});
