export interface AnnotationFilter {
  warning: boolean;
  info: boolean;
  suggestion: boolean;
}

interface Props {
  value: AnnotationFilter;
  onChange: (next: AnnotationFilter) => void;
}

const TYPES: Array<keyof AnnotationFilter> = ["warning", "suggestion", "info"];

export default function AnnotationFilterBar({ value, onChange }: Props) {
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
        </button>
      ))}
    </div>
  );
}
