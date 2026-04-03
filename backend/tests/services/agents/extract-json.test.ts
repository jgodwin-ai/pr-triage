import { describe, it, expect } from "vitest";
import { extractJSON, getResponseText } from "../../../src/services/agents/extract-json.js";

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
    expect(() => extractJSON("not json at all")).toThrow("Failed to parse Claude response as JSON");
    expect(() => extractJSON("not json at all")).toThrow("not json at all");
  });

  it("truncates raw text in error message to 200 chars", () => {
    const longText = "x".repeat(300);
    try {
      extractJSON(longText);
    } catch (e: any) {
      expect(e.message).toContain("x".repeat(200));
      expect(e.message).not.toContain("x".repeat(201));
    }
  });
});

describe("getResponseText", () => {
  it("returns text from valid text content block", () => {
    const response = { content: [{ type: "text", text: "hello" }] };
    expect(getResponseText(response)).toBe("hello");
  });

  it("throws on empty content array", () => {
    expect(() => getResponseText({ content: [] })).toThrow("empty response content");
  });

  it("throws on non-text content block", () => {
    const response = { content: [{ type: "tool_use" }] };
    expect(() => getResponseText(response)).toThrow("non-text content block: tool_use");
  });

  it("throws on text block with empty text", () => {
    const response = { content: [{ type: "text", text: "" }] };
    expect(() => getResponseText(response)).toThrow("non-text content block");
  });

  it("throws on text block with missing text property", () => {
    const response = { content: [{ type: "text" }] };
    expect(() => getResponseText(response)).toThrow("non-text content block");
  });
});
