import { useState, type CSSProperties } from "react";
import type { PRAnalysis } from "../types.js";
import ChatPanel from "./ChatPanel.js";
import ReviewSubmitBar from "./ReviewSubmitBar.js";
import { useActiveFile } from "../hooks/useActiveFile.js";
import { useReviewDraft } from "../hooks/useReviewDraft.js";

const TAB_KEY = "pr-triage:rightRailTab";

function loadTab(): "chat" | "review" {
  try {
    const v = localStorage.getItem(TAB_KEY);
    if (v === "chat" || v === "review") return v;
  } catch {
    // ignore
  }
  return "review";
}

interface Props {
  analysis: PRAnalysis;
  prUrl: string;
  style?: CSSProperties;
}

export default function RightRail({ analysis, prUrl, style }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<"chat" | "review">(loadTab);
  const activeFile = useActiveFile();
  const draft = useReviewDraft();

  const pendingCount = draft.comments.length;

  // Look up full file data for context
  const activeFileData = activeFile.activeFilePath
    ? analysis.clusters
        .flatMap((c) => c.files.map((f) => ({ ...f, clusterId: c.id })))
        .find(
          (f) =>
            f.clusterId === activeFile.activeClusterId &&
            f.path === activeFile.activeFilePath,
        )
    : null;

  const filePath = activeFile.activeFilePath ?? null;

  function switchTab(t: "chat" | "review") {
    setTab(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      // ignore
    }
  }

  return (
    <div className={`right-rail${collapsed ? " is-collapsed" : ""}`} style={style}>
      <button
        className="right-rail__collapse"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Expand chat panel" : "Collapse chat panel"}
        title={collapsed ? "Expand" : "Collapse"}
      >
        {collapsed ? "‹" : "›"}
      </button>

      {!collapsed && (
        <div className="right-rail__inner">
          <div className="right-rail__tabs">
            <button
              className={tab === "chat" ? "is-active" : ""}
              onClick={() => switchTab("chat")}
            >
              Chat
            </button>
            <button
              className={tab === "review" ? "is-active" : ""}
              onClick={() => switchTab("review")}
            >
              Review{pendingCount > 0 && (
                <span className="right-rail__tab-badge">{pendingCount}</span>
              )}
            </button>
          </div>

          {tab === "chat" ? (
            <div className="right-rail__inner-chat">
              <div className="right-rail__header">
                <div className="right-rail__header-title">
                  Chat
                  {filePath && (
                    <>
                      {" — currently working on: "}
                      <code className="right-rail__file-path">{filePath}</code>
                    </>
                  )}
                </div>
                <p className="right-rail__hint">
                  Scroll up in the main pane to talk about a different file.
                  (Switching files starts a new chat.)
                </p>
              </div>
              <div className="right-rail__body">
                {filePath ? (
                  <ChatPanel
                    key={filePath}
                    filePath={filePath}
                    diff={activeFileData?.diff ?? ""}
                    summary={activeFileData?.summary}
                  />
                ) : (
                  <p className="right-rail__empty">
                    No file selected. Start viewing files in the main pane.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="right-rail__body">
              <ReviewSubmitBar prUrl={prUrl} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
