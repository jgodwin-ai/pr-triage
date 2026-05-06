import { useState, useCallback } from "react";
import type { PRAnalysis, ChangeCluster, AnalysisStage, WSMessage } from "../types.js";
import { useWebSocket } from "./useWebSocket.js";
import { stackStore, type Level } from "../state/stack.js";

/**
 * Parse a GitHub PR URL into `{owner, repo, number}`. Mirrors the
 * backend's parser; returns `null` on malformed input rather than throwing
 * so the caller can degrade gracefully.
 */
function parsePrUrl(prUrl: string): { owner: string; repo: string; number: string } | null {
  const m = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!m) return null;
  return { owner: m[1], repo: m[2], number: m[3] };
}

/**
 * Shape returned by `GET /api/pr/:owner/:repo/:num/stack`. Each level may
 * include an `analysis` payload when the backend has it cached
 * (`status === "ready"`).
 */
interface StackResponse {
  prUrl: string;
  baseSha: string;
  headSha: string;
  levels: Array<Level & { analysis?: PRAnalysis }>;
}

async function fetchStackAndPopulate(prUrl: string, githubToken?: string): Promise<void> {
  const parts = parsePrUrl(prUrl);
  if (!parts) return;
  const headers: Record<string, string> = {};
  if (githubToken) headers["x-github-token"] = githubToken;
  const res = await fetch(
    `/api/pr/${encodeURIComponent(parts.owner)}/${encodeURIComponent(parts.repo)}/${parts.number}/stack`,
    { headers },
  );
  if (!res.ok) return;
  const data = (await res.json()) as StackResponse;
  // Strip `analysis` from the level shape stored on the rail itself; the
  // store carries it in a parallel slot via onLevelReady so the rail and
  // the analysis viewer stay decoupled.
  const levels: Level[] = data.levels.map(({ analysis: _a, ...rest }) => rest as Level);
  stackStore.setStack(prUrl, levels);
  stackStore.setLatestKnownHeadSha(data.headSha);
  for (const lvl of data.levels) {
    if (lvl.analysis && lvl.status === "ready") {
      stackStore.onLevelReady({ sha: lvl.sha, analysis: lvl.analysis });
    }
  }
}

interface AnalysisState {
  stage: AnalysisStage | null;
  progress: string;
  partialClusters: ChangeCluster[];
  analysis: PRAnalysis | null;
  error: string | null;
}

export function useAnalysis(onComplete: (analysis: PRAnalysis) => void) {
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [state, setState] = useState<AnalysisState>({
    stage: null,
    progress: "",
    partialClusters: [],
    analysis: null,
    error: null,
  });

  const handleMessage = useCallback(
    (msg: WSMessage) => {
      switch (msg.type) {
        case "status":
          setState((prev) => ({
            ...prev,
            stage: msg.stage ?? prev.stage,
            progress: msg.progress ?? "",
          }));
          break;
        case "partial":
          setState((prev) => ({
            ...prev,
            partialClusters: msg.clusters ?? prev.partialClusters,
          }));
          break;
        case "complete":
          if (msg.analysis) {
            setState((prev) => ({
              ...prev,
              stage: "complete",
              analysis: msg.analysis!,
            }));
            onComplete(msg.analysis);
            // Populate the stack store off the back of the completed
            // single-PR analysis so the TimelineRail and per-level
            // navigation work without a separate trigger. Best-effort:
            // failures here are non-fatal for the legacy analysis view.
            void fetchStackAndPopulate(msg.analysis.pr.url);
          }
          break;
        case "error":
          setState((prev) => ({
            ...prev,
            stage: "error",
            error: msg.error ?? "Unknown error",
          }));
          break;
        // Per-level (stacked-PR) events. The backend emits these as each
        // commit-level pipeline finishes; route them straight into the
        // stack store so AnalysisView and TimelineRail re-render.
        case "levelReady":
          if (msg.sha && msg.analysis) {
            stackStore.onLevelReady({ sha: msg.sha, analysis: msg.analysis });
          }
          break;
        case "levelError":
          if (msg.sha) {
            stackStore.onLevelError({ sha: msg.sha, error: msg.error ?? "Unknown error" });
          }
          break;
      }
    },
    [onComplete]
  );

  useWebSocket({ onMessage: handleMessage, enabled: !!analysisId });

  const startAnalysis = useCallback(
    async (prUrl: string, anthropicApiKey?: string, githubToken?: string) => {
      setState({
        stage: "fetching-pr",
        progress: "Submitting...",
        partialClusters: [],
        analysis: null,
        error: null,
      });

      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prUrl, anthropicApiKey, githubToken }),
        });

        if (!res.ok) {
          let errorMsg = `Request failed with status ${res.status}`;
          try {
            const body = await res.json();
            errorMsg = body.error || errorMsg;
          } catch {
            // Response wasn't JSON
          }
          setState((prev) => ({ ...prev, stage: "error", error: errorMsg }));
          return;
        }

        const { analysisId } = await res.json();
        setAnalysisId(analysisId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Network error";
        setState((prev) => ({ ...prev, stage: "error", error: message }));
      }
    },
    []
  );

  return { ...state, startAnalysis };
}
