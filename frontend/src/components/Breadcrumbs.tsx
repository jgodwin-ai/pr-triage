interface Crumb {
  label: string;
  onClick?: () => void;
}

interface Props {
  crumbs: Crumb[];
}

export default function Breadcrumbs({ crumbs }: Props) {
  return (
    <nav style={{ marginBottom: 16, fontSize: 14 }}>
      {crumbs.map((crumb, i) => (
        <span key={i}>
          {i > 0 && " → "}
          {crumb.onClick ? (
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                crumb.onClick!();
              }}
              style={{ color: "#0066cc" }}
            >
              {crumb.label}
            </a>
          ) : (
            <strong>{crumb.label}</strong>
          )}
        </span>
      ))}
    </nav>
  );
}
