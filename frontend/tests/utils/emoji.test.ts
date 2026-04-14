import { describe, it, expect } from "vitest";
import { renderEmoji } from "../../src/utils/emoji.js";

describe("renderEmoji", () => {
  it("converts :thumbsup: to 👍", () => {
    expect(renderEmoji("nice :thumbsup:")).toBe("nice 👍");
  });
  it("leaves unknown shortcodes alone", () => {
    expect(renderEmoji("hey :definitely_not_a_real_emoji:")).toBe("hey :definitely_not_a_real_emoji:");
  });
});
