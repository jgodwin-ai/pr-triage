import { Router } from "express";
import { createLLMClient } from "../services/create-llm-client.js";

const router = Router();

interface ChatMessage { role: "user" | "assistant"; content: string; }

router.post("/", async (req, res) => {
  const { filePath, diff, summary, history, message, anthropicApiKey } = req.body as {
    filePath?: string; diff?: string; summary?: string;
    history?: ChatMessage[]; message?: string; anthropicApiKey?: string;
  };

  if (!filePath || !diff || !message) {
    res.status(400).json({ error: "filePath, diff, and message are required" });
    return;
  }

  const client = createLLMClient(anthropicApiKey);

  const transcript = (history ?? [])
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  const prompt = `You are helping a developer review a pull request. Focus only on the file they are asking about. Be concise and direct.

File: ${filePath}
${summary ? `Summary of change: ${summary}\n` : ""}
Diff:
\`\`\`
${diff}
\`\`\`

${transcript ? `Prior conversation:\n${transcript}\n\n` : ""}User: ${message}
Assistant:`;

  try {
    const reply = await client.complete(prompt);
    res.json({ reply: reply.trim() });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "chat failed" });
  }
});

export default router;
