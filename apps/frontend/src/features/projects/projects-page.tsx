import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { apiClient, ApiError } from "../../lib/api";
import type { ProjectListItem } from "../../lib/types";
import { EmptyState } from "../shared/empty-state";
import { ErrorState } from "../shared/error-state";
import { LoadingState } from "../shared/loading-state";
import {
  buildProjectsDashboard,
  formatProjectLifecycle,
} from "./projects-dashboard";

export function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProjects() {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.listProjects();
      setProjects(response.items);
    } catch (fetchError) {
      setError(
        fetchError instanceof ApiError
          ? fetchError.message
          : "项目列表加载失败，请确认 API 已启动且 Bearer Token 配置正确。",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProjects();
  }, []);

  if (loading) {
    return <LoadingState title="正在加载项目工作台" />;
  }

  if (error) {
    return (
      <ErrorState
        body={error}
        title="项目列表暂时不可用"
        onRetry={() => {
          void loadProjects();
        }}
      />
    );
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        title="还没有项目数据"
        body="当前数据库里没有可展示的项目，等 API 写入项目后这里会自动接上。"
      />
    );
  }

  const dashboard = buildProjectsDashboard(projects);

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h2 className="page-title">项目工作台</h2>
          <p className="page-description">
            第一版前端先围绕数据库主路径，把项目、清单、汇总链路稳定接起来。
          </p>
        </div>
      </header>

      <section className="stat-grid">
        {dashboard.metrics.map((metric) => (
          <article className="stat-card" key={metric.label}>
            <p className="stat-label">{metric.label}</p>
            <p className="stat-value">{metric.value}</p>
            <p className="page-description">{metric.helper}</p>
          </article>
        ))}
      </section>

      <section className="detail-grid">
        <article className="panel">
          <h3>重点项目</h3>
          <div className="project-list">
            {dashboard.featuredProjects.map((project) => (
              <Link
                className="project-link"
                key={project.id}
                to={`/projects/${project.id}`}
              >
                <div className="version-card-header">
                  <div>
                    <h3>{project.title}</h3>
                    <p className="page-description">{project.subtitle}</p>
                  </div>
                  <span className="version-status-chip">{project.readinessLabel}</span>
                </div>
              </Link>
            ))}
          </div>
        </article>
        <article className="panel">
          <h3>工作台提示</h3>
          <ul className="inline-list">
            <li>优先进入“已配置默认计价”的项目，联调路径更完整。</li>
            <li>草稿项目更适合继续补 bill version、清单与汇总主链。</li>
            <li>项目详情页现在已经具备版本工作台、清单页和汇总页入口。</li>
          </ul>
        </article>
      </section>

      <section className="panel">
        <h3>项目列表</h3>
        <div className="project-list">
          {projects.map((project) => (
            <Link
              className="project-link"
              key={project.id}
              to={`/projects/${project.id}`}
            >
              <h3>{project.name}</h3>
              <p className="page-description">
                {project.code} · 状态 {formatProjectLifecycle(project.status)}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
