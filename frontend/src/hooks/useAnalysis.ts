import { useState, useCallback } from "react";
import type { PRAnalysis, ChangeCluster, AnalysisStage, WSMessage } from "../types.js";
import { useWebSocket } from "./useWebSocket.js";

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
          }
          break;
        case "error":
          setState((prev) => ({
            ...prev,
            stage: "error",
            error: msg.error ?? "Unknown error",
          }));
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
