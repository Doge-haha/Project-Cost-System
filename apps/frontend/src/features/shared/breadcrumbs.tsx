import { Link } from "react-router-dom";

export type BreadcrumbItem = {
  label: string;
  to: string | null;
};

export function buildProjectVersionBreadcrumbs(input: {
  currentLabel: string;
  projectId: string;
  projectName: string;
  versionLabel: string;
}): BreadcrumbItem[] {
  return [
    {
      label: "项目工作台",
      to: "/projects",
    },
    {
      label: input.projectName,
      to: `/projects/${input.projectId}`,
    },
    {
      label: input.versionLabel,
      to: null,
    },
    {
      label: input.currentLabel,
      to: null,
    },
  ];
}

export function AppBreadcrumbs(props: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="面包屑" className="breadcrumbs">
      {props.items.map((item, index) => {
        const isLast = index === props.items.length - 1;

        return (
          <span className="breadcrumbs-item" key={`${item.label}-${index}`}>
            {item.to && !isLast ? (
              <Link className="breadcrumbs-link" to={item.to}>
                {item.label}
              </Link>
            ) : (
              <span className="breadcrumbs-current">{item.label}</span>
            )}
            {!isLast ? <span className="breadcrumbs-separator">/</span> : null}
          </span>
        );
      })}
    </nav>
  );
}
