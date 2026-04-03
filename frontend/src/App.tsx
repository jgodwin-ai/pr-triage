import { useState } from "react";
import type { PRAnalysis } from "./types.js";
import LandingPage from "./components/LandingPage.js";
import AnalysisView from "./components/AnalysisView.js";

export default function App() {
  const [analysis, setAnalysis] = useState<PRAnalysis | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);

  if (analysis) {
    return (
      <AnalysisView
        analysis={analysis}
        onBack={() => {
          setAnalysis(null);
          setAnalysisId(null);
        }}
      />
    );
  }

  return (
    <LandingPage
      onAnalysisStarted={(id) => setAnalysisId(id)}
      onAnalysisComplete={(result) => setAnalysis(result)}
    />
  );
}
