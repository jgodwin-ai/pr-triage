import { useState, useEffect } from "react";
import type { PRAnalysis } from "../types.js";
import { useAnalysis } from "../hooks/useAnalysis.js";

interface Props {
  onAnalysisComplete: (analysis: PRAnalysis) => void;
}

interface SampleSummary {
  key: string;
  prUrl: string;
  title: string;
  headSha: string;
}

export default function LandingPage({ onAnalysisComplete }: Props) {
  const [prUrl, setPrUrl] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [githubTokenConfigured, setGithubTokenConfigured] = useState<boolean | null>(null);
  const [llmProvider, setLlmProvider] = useState<string | null>(null);
  const [samples, setSamples] = useState<SampleSummary[]>([]);

  const { stage, progress, error, startAnalysis } = useAnalysis(onAnalysisComplete);

  useEffect(() => {
    fetch("/api/config/status")
      .then((res) => res.json())
      .then((data) => {
        setGithubTokenConfigured(data.githubTokenConfigured);
        setLlmProvider(data.llmProvider);
      })
      .catch(() => {
        setGithubTokenConfigured(false);
        setLlmProvider("claude-cli");
      });

    fetch("/api/analyze/samples")
      .then((res) => (res.ok ? res.json() : { samples: [] }))
      .then((data) => setSamples(data.samples ?? []))
      .catch(() => setSamples([]));
  }, []);

  const loadSample = async (key: string) => {
    const res = await fetch(`/api/analyze/samples/${encodeURIComponent(key)}`);
    if (!res.ok) return;
    const { analysis } = await res.json();
    if (analysis) onAnalysisComplete(analysis);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startAnalysis(
      prUrl,
      undefined, // anthropicApiKey — not needed with CLI
      githubTokenConfigured ? undefined : githubToken
    );
  };

  const isLoading = stage !== null && stage !== "error" && stage !== "complete";

  return (
    <div className="landing">
      <div className="landing-card">
        <h1>PR Triage Bot</h1>
        <p className="subtitle">Paste a GitHub PR URL to get an AI-powered layered review.</p>

        <form onSubmit={handleSubmit}>
          <input
            className="form-input"
            type="url"
            placeholder="https://github.com/owner/repo/pull/123"
            value={prUrl}
            onChange={(e) => setPrUrl(e.target.value)}
            required
            disabled={isLoading}
          />

          {githubTokenConfigured === false && (
            <input
              className="form-input"
              type="password"
              placeholder="GitHub Token"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              required
              disabled={isLoading}
            />
          )}

          <button className="btn-primary" type="submit" disabled={isLoading}>
            {isLoading ? "Analyzing..." : "Analyze PR"}
          </button>
        </form>

        {llmProvider && (
          <p className="provider-badge">
            Using {llmProvider === "claude-cli" ? "Claude Code CLI" : "Anthropic API"}
          </p>
        )}

        {stage && stage !== "error" && stage !== "complete" && (
          <div className="status-bar">
            <strong>{stage.replace(/-/g, " ")}</strong>
            {progress && <span> — {progress}</span>}
          </div>
        )}

        {error && (
          <div className="error-bar">
            <strong>Error:</strong> {error}
          </div>
        )}

        {samples.length > 0 && (
          <div className="sample-loader">
            <div className="sample-loader__label">Dev shortcut — load a cached analysis:</div>
            <ul className="sample-loader__list">
              {samples.map((s) => (
                <li key={s.key}>
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => loadSample(s.key)}
                    disabled={isLoading}
                  >
                    {s.title || s.prUrl || s.key}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
