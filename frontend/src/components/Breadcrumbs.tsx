interface Crumb {
  label: string;
  onClick?: () => void;
}

interface Props {
  crumbs: Crumb[];
}

export default function Breadcrumbs({ crumbs }: Props) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {crumbs.map((crumb, i) => (
        <span key={i}>
          {i > 0 && <span className="separator">/</span>}
          {crumb.onClick ? (
            <button onClick={crumb.onClick}>{crumb.label}</button>
          ) : (
            <span className="current" aria-current="page">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
