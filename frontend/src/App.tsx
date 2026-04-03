import { useState } from "react";
import type { PRAnalysis } from "./types.js";

export default function App() {
  const [analysis, setAnalysis] = useState<PRAnalysis | null>(null);

  if (analysis) {
    return (
      <div>
        <button onClick={() => setAnalysis(null)}>Back</button>
        <h1>{analysis.pr.title}</h1>
        <p>{analysis.executiveSummary}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: "80px auto", padding: "0 20px" }}>
      <h1>PR Triage Bot</h1>
      <p>Frontend shell — components coming in Tasks 12-15.</p>
    </div>
  );
}
