export interface AnnotationFilter {
  warning: boolean;
  info: boolean;
  suggestion: boolean;
}

interface Props {
  value: AnnotationFilter;
  onChange: (next: AnnotationFilter) => void;
  counts?: Record<keyof AnnotationFilter, number>;
}

const TYPES: Array<keyof AnnotationFilter> = ["warning", "suggestion", "info"];

export default function AnnotationFilterBar({ value, onChange, counts }: Props) {
  return (
    <div className="filter-bar" role="toolbar" aria-label="Annotation filters">
      <span className="filter-bar__label">Show:</span>
      {TYPES.map((t) => (
        <button
          key={t}
          type="button"
          className={`chip chip--${t} ${value[t] ? "is-active" : ""}`}
          aria-pressed={value[t]}
          onClick={() => onChange({ ...value, [t]: !value[t] })}
        >
          {t}
          {counts && (
            <span className="chip__count">{counts[t]}</span>
          )}
        </button>
      ))}
    </div>
  );
}
