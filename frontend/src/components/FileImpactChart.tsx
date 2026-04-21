import type { FileAnalysis } from "../types.js";

interface Props {
  file: FileAnalysis;
}

export default function FileImpactChart({ file }: Props) {
  const counts = { warning: 0, suggestion: 0, info: 0 };
  for (const a of file.annotations) {
    if (a.type in counts) counts[a.type as keyof typeof counts]++;
  }
  const total = counts.warning + counts.suggestion + counts.info;
  const pct = (n: number) => (total === 0 ? 0 : (n / total) * 100);
  const tooltip =
    `${counts.warning} warning${counts.warning === 1 ? "" : "s"}, ` +
    `${counts.suggestion} suggestion${counts.suggestion === 1 ? "" : "s"}, ` +
    `${counts.info} info`;

  return (
    <div className="file-impact-chart" title={tooltip} aria-label={tooltip}>
      <div className="file-impact-chart__pips" aria-label={`impact ${file.impactScore} of 5`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={
              "file-impact-chart__pip" +
              (i <= file.impactScore ? " is-filled" : "") +
              (i <= file.impactScore ? ` impact-${file.impactScore}` : "")
            }
          />
        ))}
      </div>
      <div className="file-impact-chart__severity">
        {total === 0 ? (
          <span className="file-impact-chart__empty">—</span>
        ) : (
          <>
            {counts.warning > 0 && (
              <span
                className="file-impact-chart__bar file-impact-chart__bar--warning"
                style={{ width: `${pct(counts.warning)}%` }}
              >
                {counts.warning}
              </span>
            )}
            {counts.suggestion > 0 && (
              <span
                className="file-impact-chart__bar file-impact-chart__bar--suggestion"
                style={{ width: `${pct(counts.suggestion)}%` }}
              >
                {counts.suggestion}
              </span>
            )}
            {counts.info > 0 && (
              <span
                className="file-impact-chart__bar file-impact-chart__bar--info"
                style={{ width: `${pct(counts.info)}%` }}
              >
                {counts.info}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
