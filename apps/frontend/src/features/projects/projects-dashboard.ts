import type { ProjectListItem } from "../../lib/types";

export function formatProjectLifecycle(status: string) {
  if (status === "draft") {
    return "草稿";
  }
  if (status === "active") {
    return "进行中";
  }
  if (status === "archived") {
    return "已归档";
  }
  return status;
}

export function buildProjectsDashboard(projects: ProjectListItem[]) {
  const draftProjects = projects.filter((project) => project.status === "draft");
  const activeProjects = projects.filter((project) => project.status === "active");
  const configuredProjects = projects.filter(
    (project) => project.defaultFeeTemplateId || project.defaultPriceVersionId,
  );

  return {
    metrics: [
      {
        label: "项目数量",
        value: String(projects.length),
        helper: "当前工作区内可见项目",
      },
      {
        label: "草稿项目",
        value: String(draftProjects.length),
        helper: "仍在整理计价主链",
      },
      {
        label: "已配置默认计价",
        value: String(configuredProjects.length),
        helper: "已绑定默认价目或取费模板",
      },
      {
        label: "进行中项目",
        value: String(activeProjects.length),
        helper: "更适合优先进入联调",
      },
    ],
    featuredProjects: projects.slice(0, 3).map((project) => ({
      id: project.id,
      title: project.name,
      subtitle: `${project.code} · ${formatProjectLifecycle(project.status)}`,
      readinessLabel:
        project.defaultFeeTemplateId || project.defaultPriceVersionId
          ? "已配置默认计价"
          : "待配置默认计价",
    })),
  };
}
