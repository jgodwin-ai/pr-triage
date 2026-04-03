import { useState, useEffect } from "react";
import type { PRAnalysis } from "../types.js";
import { useAnalysis } from "../hooks/useAnalysis.js";

interface Props {
  onAnalysisComplete: (analysis: PRAnalysis) => void;
}

export default function LandingPage({ onAnalysisComplete }: Props) {
  const [prUrl, setPrUrl] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [keysConfigured, setKeysConfigured] = useState<{
    anthropic: boolean;
    github: boolean;
  } | null>(null);

  const { stage, progress, error, startAnalysis } = useAnalysis(onAnalysisComplete);

  useEffect(() => {
    fetch("/api/config/status")
      .then((res) => res.json())
      .then((data) => {
        setKeysConfigured({
          anthropic: data.anthropicKeyConfigured,
          github: data.githubTokenConfigured,
        });
      })
      .catch(() => {
        setKeysConfigured({ anthropic: false, github: false });
      });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startAnalysis(
      prUrl,
      keysConfigured?.anthropic ? undefined : anthropicKey,
      keysConfigured?.github ? undefined : githubToken
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

          {keysConfigured && !keysConfigured.anthropic && (
            <input
              className="form-input"
              type="password"
              placeholder="Anthropic API Key"
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              required
              disabled={isLoading}
            />
          )}

          {keysConfigured && !keysConfigured.github && (
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
      </div>
    </div>
  );
}
