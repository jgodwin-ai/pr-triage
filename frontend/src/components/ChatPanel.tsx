import { useState } from "react";
import { renderEmoji } from "../utils/emoji.js";

interface Message { role: "user" | "assistant"; content: string; }

interface Props {
  filePath: string;
  diff: string;
  summary?: string;
}

export default function ChatPanel({ filePath, diff, summary }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    const history = [...messages];
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath, diff, summary, history, message: text }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: "chat failed" }));
        throw new Error(payload.error ?? "chat failed");
      }
      const data = await res.json();
      setMessages([...next, { role: "assistant", content: data.reply }]);
    } catch (e: any) {
      setError(e.message ?? "chat failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-panel__log">
        {messages.length === 0 && <p className="chat-panel__empty">Ask anything about this file.</p>}
        {messages.map((m, i) => (
          <div key={i} className={`chat-message chat-message--${m.role}`}>
            <strong>{m.role === "user" ? "You" : "AI"}</strong>
            <p>{renderEmoji(m.content)}</p>
          </div>
        ))}
        {sending && <div className="chat-message chat-message--assistant"><em>Thinking…</em></div>}
      </div>
      <div className="chat-panel__input">
        <textarea
          value={input}
          placeholder="Ask about this file…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
          }}
          rows={2}
          disabled={sending}
        />
        <button className="btn-primary" disabled={sending} onClick={send}>Send</button>
      </div>
      {error && <div className="error-bar">{error}</div>}
    </div>
  );
}
