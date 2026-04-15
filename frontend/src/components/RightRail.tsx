import { useState } from "react";
import type { PRAnalysis } from "../types.js";
import ChatPanel from "./ChatPanel.js";
import { useActiveFile } from "../hooks/useActiveFile.js";

interface Props {
  analysis: PRAnalysis;
}

export default function RightRail({ analysis }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const activeFile = useActiveFile();

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

  return (
    <div className={`right-rail${collapsed ? " is-collapsed" : ""}`}>
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
      )}
    </div>
  );
}
