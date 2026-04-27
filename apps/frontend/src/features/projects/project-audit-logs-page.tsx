import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { apiClient, ApiError } from "../../lib/api";
import type { AuditLogRecord, ProjectWorkspace } from "../../lib/types";
import { AppBreadcrumbs } from "../shared/breadcrumbs";
import { EmptyState } from "../shared/empty-state";
import { ErrorState } from "../shared/error-state";
import { LoadingState } from "../shared/loading-state";
import { formatAction, formatResourceType } from "./project-detail-model";
import { formatProjectDateTime } from "./project-date-utils";

type ProjectAuditLogsState = {
  workspace: ProjectWorkspace;
  logs: AuditLogRecord[];
};

type AuditLogFilters = {
  resourceType: string;
  resourceId: string;
  resourceIdPrefix: string;
  action: string;
  operatorId: string;
  createdFrom: string;
  createdTo: string;
  limit: string;
};

const defaultFilters: AuditLogFilters = {
  resourceType: "",
  resourceId: "",
  resourceIdPrefix: "",
  action: "",
  operatorId: "",
  createdFrom: "",
  createdTo: "",
  limit: "50",
};

export function ProjectAuditLogsPage() {
  const params = useParams();
  const projectId = params.projectId;
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<AuditLogFilters>(() =>
    readFilters(searchParams),
  );
  const [state, setState] = useState<ProjectAuditLogsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeQuery = useMemo(() => readFilters(searchParams), [searchParams]);

  async function loadAuditLogs() {
    if (!projectId) {
      setError("项目标识缺失，无法加载审计日志。");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [workspace, response] = await Promise.all([
        apiClient.getProjectWorkspace(projectId),
        apiClient.listProjectAuditLogs(projectId, {
          limit: Number(activeQuery.limit),
          resourceType: activeQuery.resourceType,
          resourceId: activeQuery.resourceId,
          resourceIdPrefix: activeQuery.resourceIdPrefix,
          action: activeQuery.action,
          operatorId: activeQuery.operatorId,
          createdFrom: toIsoDateTime(activeQuery.createdFrom),
          createdTo: toIsoDateTime(activeQuery.createdTo),
        }),
      ]);

      setState({
        workspace,
        logs: response.items,
      });
    } catch (fetchError) {
      setError(
        fetchError instanceof ApiError
          ? fetchError.message
          : "审计日志加载失败，请检查 API 连通性。",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setFilters(readFilters(searchParams));
  }, [searchParams]);

  useEffect(() => {
    void loadAuditLogs();
  }, [projectId, activeQuery]);

  function updateFilter(key: keyof AuditLogFilters, value: string) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function applyFilters() {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value.trim()) {
        next.set(key, value.trim());
      }
    }
    setSearchParams(next);
  }

  function resetFilters() {
    setFilters(defaultFilters);
    setSearchParams(new URLSearchParams());
  }

  if (loading && !state) {
    return <LoadingState title="正在加载审计日志" />;
  }

  if (error && !state) {
    return <ErrorState body={error} onRetry={loadAuditLogs} title="审计日志加载失败" />;
  }

  if (!state || !projectId) {
    return <EmptyState title="没有审计日志" body="当前项目暂无可展示的审计记录。" />;
  }

  return (
    <div className="page-stack">
      <AppBreadcrumbs
        items={[
          {
            label: "项目工作台",
            to: "/projects",
          },
          {
            label: state.workspace.project.name,
            to: `/projects/${projectId}`,
          },
          {
            label: "审计日志",
            to: null,
          },
        ]}
      />

      <header className="page-header">
        <div>
          <h1 className="page-title">审计日志</h1>
          <p className="page-description">
            {state.workspace.project.name} · 最近 {state.logs.length} 条匹配记录
          </p>
        </div>
        <Link className="app-nav-link active" to={`/projects/${projectId}`}>
          返回项目工作台
        </Link>
      </header>

      <section className="panel">
        <h2>筛选条件</h2>
        <div className="form-grid">
          <label className="form-field">
            资源类型
            <input
              aria-label="资源类型"
              onChange={(event) => updateFilter("resourceType", event.target.value)}
              placeholder="bill_version"
              value={filters.resourceType}
            />
          </label>
          <label className="form-field">
            动作
            <input
              aria-label="动作"
              onChange={(event) => updateFilter("action", event.target.value)}
              placeholder="submit"
              value={filters.action}
            />
          </label>
          <label className="form-field">
            资源 ID
            <input
              aria-label="资源 ID"
              onChange={(event) => updateFilter("resourceId", event.target.value)}
              placeholder="bill-version-001"
              value={filters.resourceId}
            />
          </label>
          <label className="form-field">
            资源 ID 前缀
            <input
              aria-label="资源 ID 前缀"
              onChange={(event) =>
                updateFilter("resourceIdPrefix", event.target.value)
              }
              placeholder="bill-version"
              value={filters.resourceIdPrefix}
            />
          </label>
          <label className="form-field">
            操作人
            <input
              aria-label="操作人"
              onChange={(event) => updateFilter("operatorId", event.target.value)}
              placeholder="user-001"
              value={filters.operatorId}
            />
          </label>
          <label className="form-field">
            数量
            <select
              aria-label="数量"
              onChange={(event) => updateFilter("limit", event.target.value)}
              value={filters.limit}
            >
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </label>
          <label className="form-field">
            开始时间
            <input
              aria-label="开始时间"
              onChange={(event) => updateFilter("createdFrom", event.target.value)}
              type="datetime-local"
              value={filters.createdFrom}
            />
          </label>
          <label className="form-field">
            结束时间
            <input
              aria-label="结束时间"
              onChange={(event) => updateFilter("createdTo", event.target.value)}
              type="datetime-local"
              value={filters.createdTo}
            />
          </label>
        </div>
        <div className="button-row">
          <button className="primary-button secondary" onClick={resetFilters} type="button">
            清空
          </button>
          <button className="primary-button" onClick={applyFilters} type="button">
            应用筛选
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>日志列表</h2>
        {error ? <p className="page-description">{error}</p> : null}
        {state.logs.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>资源</th>
                  <th>动作</th>
                  <th>资源 ID</th>
                  <th>操作人</th>
                  <th>变更内容</th>
                </tr>
              </thead>
              <tbody>
                {state.logs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatProjectDateTime(log.createdAt)}</td>
                    <td>
                      {formatResourceType(log.resourceType)}
                      {log.stageCode ? ` · ${log.stageCode}` : ""}
                    </td>
                    <td>{formatAction(log.action)}</td>
                    <td>{log.resourceId}</td>
                    <td>{log.operatorId}</td>
                    <td>
                      <details>
                        <summary>查看</summary>
                        <pre>{formatPayloadDiff(log)}</pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="没有匹配日志" body="当前筛选条件下没有审计记录。" />
        )}
      </section>
    </div>
  );
}

function readFilters(searchParams: URLSearchParams): AuditLogFilters {
  return {
    resourceType: searchParams.get("resourceType") ?? defaultFilters.resourceType,
    resourceId: searchParams.get("resourceId") ?? defaultFilters.resourceId,
    resourceIdPrefix:
      searchParams.get("resourceIdPrefix") ?? defaultFilters.resourceIdPrefix,
    action: searchParams.get("action") ?? defaultFilters.action,
    operatorId: searchParams.get("operatorId") ?? defaultFilters.operatorId,
    createdFrom: searchParams.get("createdFrom") ?? defaultFilters.createdFrom,
    createdTo: searchParams.get("createdTo") ?? defaultFilters.createdTo,
    limit: searchParams.get("limit") ?? defaultFilters.limit,
  };
}

function toIsoDateTime(value: string) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

function formatPayloadDiff(log: AuditLogRecord) {
  return JSON.stringify(
    {
      before: log.beforePayload ?? null,
      after: log.afterPayload ?? null,
    },
    null,
    2,
  );
}
