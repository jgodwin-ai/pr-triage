interface Crumb {
  label: string;
  onClick?: () => void;
}

interface Props {
  crumbs: Crumb[];
}

export default function Breadcrumbs({ crumbs }: Props) {
  return (
    <nav aria-label="Breadcrumb" style={{ marginBottom: 16, fontSize: 14 }}>
      {crumbs.map((crumb, i) => (
        <span key={i}>
          {i > 0 && " → "}
          {crumb.onClick ? (
            <button
              onClick={crumb.onClick}
              style={{
                background: "none",
                border: "none",
                color: "#0066cc",
                cursor: "pointer",
                padding: 0,
                font: "inherit",
                textDecoration: "underline",
              }}
            >
              {crumb.label}
            </button>
          ) : (
            <strong aria-current="page">{crumb.label}</strong>
          )}
        </span>
      ))}
    </nav>
  );
}
