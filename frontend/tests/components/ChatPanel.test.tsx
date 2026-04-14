import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ChatPanel from "../../src/components/ChatPanel.js";

describe("ChatPanel", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, json: () => Promise.resolve({ reply: "it adds a function" }),
    }));
  });

  it("sends the message and renders the reply", async () => {
    render(<ChatPanel filePath="a.ts" diff="@@ -1 +1 @@" />);
    const textarea = screen.getByPlaceholderText(/ask about this file/i);
    fireEvent.change(textarea, { target: { value: "what changed?" } });
    fireEvent.click(screen.getByText("Send"));
    await waitFor(() => expect(screen.getByText("it adds a function")).toBeTruthy());
    expect(screen.getByText("what changed?")).toBeTruthy();
  });

  it("does not send on empty input", () => {
    render(<ChatPanel filePath="a.ts" diff="@@" />);
    fireEvent.click(screen.getByText("Send"));
    expect(fetch).not.toHaveBeenCalled();
  });
});
