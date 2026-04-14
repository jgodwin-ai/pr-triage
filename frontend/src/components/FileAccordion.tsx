import { useState } from "react";
import type { FileAnalysis } from "../types.js";
import type { AnnotationFilter } from "./AnnotationFilterBar.js";
import DiffViewer from "./DiffViewer.js";
import ChatPanel from "./ChatPanel.js";

interface Props {
  clusterId: string;
  file: FileAnalysis;
  filter: AnnotationFilter;
  defaultOpen?: boolean;
}

export default function FileAccordion({ clusterId, file, filter, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [chatOpen, setChatOpen] = useState(false);
  const annotationCount = file.annotations.length;

  return (
    <section className={`file-accordion ${open ? "is-open" : ""}`}>
      <header
        className="file-accordion__header"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(!open); } }}
      >
        <span className="file-accordion__chevron">{open ? "▾" : "▸"}</span>
        <span className="file-accordion__path">{file.path}</span>
        <span className="file-accordion__meta">
          {file.category} · impact {file.impactScore}/5
          {annotationCount > 0 && ` · ${annotationCount} annotation${annotationCount === 1 ? "" : "s"}`}
        </span>
        <button
          type="button"
          className="btn-link file-accordion__chat-toggle"
          onClick={(e) => { e.stopPropagation(); setChatOpen(!chatOpen); }}
        >
          {chatOpen ? "Close chat" : "Chat"}
        </button>
      </header>
      {(open || chatOpen) && (
        <div className="file-accordion__body">
          {chatOpen && <ChatPanel filePath={file.path} diff={file.diff} summary={file.summary} />}
          {open && <DiffViewer clusterId={clusterId} file={file} filter={filter} />}
        </div>
      )}
    </section>
  );
}
