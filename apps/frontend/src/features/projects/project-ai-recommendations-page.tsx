import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { apiClient, ApiError } from "../../lib/api";
import type {
  AiRecommendation,
  AiRecommendationListResponse,
  AiRecommendationStatus,
  AiRecommendationType,
  ProjectWorkspace,
} from "../../lib/types";
import { AppBreadcrumbs } from "../shared/breadcrumbs";
import { EmptyState } from "../shared/empty-state";
import { ErrorState } from "../shared/error-state";
import { LoadingState } from "../shared/loading-state";
import { formatProjectDateTime } from "./project-date-utils";

type RecommendationState = {
  workspace: ProjectWorkspace;
  recommendations: AiRecommendationListResponse;
};

type RecommendationFilters = {
  recommendationType: string;
  status: string;
  resourceType: string;
  resourceId: string;
  stageCode: string;
  disciplineCode: string;
  limit: string;
};

const defaultFilters: RecommendationFilters = {
  recommendationType: "",
  status: "",
  resourceType: "",
  resourceId: "",
  stageCode: "",
  disciplineCode: "",
  limit: "50",
};

const recommendationTypeOptions: Array<{
  value: AiRecommendationType;
  label: string;
}> = [
  { value: "bill_recommendation", label: "清单推荐" },
  { value: "quota_recommendation", label: "定额推荐" },
  { value: "variance_warning", label: "偏差预警" },
];

const statusOptions: Array<{ value: AiRecommendationStatus; label: string }> = [
  { value: "generated", label: "待处理" },
  { value: "accepted", label: "已接受" },
  { value: "ignored", label: "已忽略" },
  { value: "expired", label: "已失效" },
];

export function ProjectAiRecommendationsPage() {
  const params = useParams();
  const projectId = params.projectId;
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<RecommendationFilters>(() =>
    readFilters(searchParams),
  );
  const [state, setState] = useState<RecommendationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionTargetId, setActionTargetId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const activeQuery = useMemo(() => readFilters(searchParams), [searchParams]);

  async function loadRecommendations() {
    if (!projectId) {
      setError("项目标识缺失，无法加载 AI 推荐。");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [workspace, recommendations] = await Promise.all([
        apiClient.getProjectWorkspace(projectId),
        apiClient.listAiRecommendations(projectId, {
          recommendationType:
            activeQuery.recommendationType === ""
              ? undefined
              : (activeQuery.recommendationType as AiRecommendationType),
          status:
            activeQuery.status === ""
              ? undefined
              : (activeQuery.status as AiRecommendationStatus),
          resourceType: activeQuery.resourceType,
          resourceId: activeQuery.resourceId,
          stageCode: activeQuery.stageCode,
          disciplineCode: activeQuery.disciplineCode,
          limit: Number(activeQuery.limit),
        }),
      ]);

      setState({
        workspace,
        recommendations,
      });
    } catch (fetchError) {
      setError(
        fetchError instanceof ApiError
          ? fetchError.message
          : "AI 推荐加载失败，请检查 API 连通性。",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setFilters(readFilters(searchParams));
  }, [searchParams]);

  useEffect(() => {
    void loadRecommendations();
  }, [projectId, activeQuery]);

  function updateFilter(key: keyof RecommendationFilters, value: string) {
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

  async function handleRecommendation(
    recommendation: AiRecommendation,
    action: "accept" | "ignore",
  ) {
    setActionTargetId(recommendation.id);
    setActionMessage(null);

    try {
      const reason = action === "accept" ? "人工确认接受" : "人工确认忽略";
      const updated =
        action === "accept"
          ? await apiClient.acceptAiRecommendation(recommendation.id, reason)
          : await apiClient.ignoreAiRecommendation(recommendation.id, reason);

      setState((current) =>
        current
          ? {
              ...current,
              recommendations: {
                ...current.recommendations,
                items: current.recommendations.items.map((item) =>
                  item.id === updated.id ? updated : item,
                ),
                summary: {
                  ...current.recommendations.summary,
                  statusCounts: {
                    ...current.recommendations.summary.statusCounts,
                    [recommendation.status]: Math.max(
                      0,
                      current.recommendations.summary.statusCounts[
                        recommendation.status
                      ] - 1,
                    ),
                    [updated.status]:
                      current.recommendations.summary.statusCounts[updated.status] + 1,
                  },
                },
              },
            }
          : current,
      );
      setActionMessage(
        `${formatRecommendationType(recommendation.recommendationType)}已${
          action === "accept" ? "接受" : "忽略"
        }。`,
      );
    } catch (submitError) {
      setActionMessage(
        submitError instanceof ApiError
          ? submitError.message
          : "AI 推荐处理失败，请稍后重试。",
      );
    } finally {
      setActionTargetId(null);
    }
  }

  if (loading && !state) {
    return <LoadingState title="正在加载 AI 推荐" />;
  }

  if (error && !state) {
    return <ErrorState body={error} onRetry={loadRecommendations} title="AI 推荐加载失败" />;
  }

  if (!state || !projectId) {
    return <EmptyState title="没有 AI 推荐" body="当前项目暂无可展示的 AI 推荐。" />;
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
            label: "AI 推荐",
            to: null,
          },
        ]}
      />

      <header className="page-header">
        <div>
          <h1 className="page-title">AI 推荐</h1>
          <p className="page-description">
            {state.workspace.project.name} · 待处理{" "}
            {state.recommendations.summary.statusCounts.generated} 条 · 共{" "}
            {state.recommendations.summary.totalCount} 条
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
            推荐类型
            <select
              aria-label="推荐类型"
              onChange={(event) => updateFilter("recommendationType", event.target.value)}
              value={filters.recommendationType}
            >
              <option value="">全部</option>
              {recommendationTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            状态
            <select
              aria-label="状态"
              onChange={(event) => updateFilter("status", event.target.value)}
              value={filters.status}
            >
              <option value="">全部</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            资源类型
            <input
              aria-label="资源类型"
              onChange={(event) => updateFilter("resourceType", event.target.value)}
              placeholder="bill_item"
              value={filters.resourceType}
            />
          </label>
          <label className="form-field">
            资源 ID
            <input
              aria-label="资源 ID"
              onChange={(event) => updateFilter("resourceId", event.target.value)}
              placeholder="bill-item-001"
              value={filters.resourceId}
            />
          </label>
          <label className="form-field">
            阶段
            <input
              aria-label="阶段"
              onChange={(event) => updateFilter("stageCode", event.target.value)}
              placeholder="estimate"
              value={filters.stageCode}
            />
          </label>
          <label className="form-field">
            专业
            <input
              aria-label="专业"
              onChange={(event) => updateFilter("disciplineCode", event.target.value)}
              placeholder="building"
              value={filters.disciplineCode}
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
        <h2>推荐列表</h2>
        {actionMessage ? <p className="page-description">{actionMessage}</p> : null}
        {state.recommendations.items.length > 0 ? (
          <div className="project-list">
            {state.recommendations.items.map((recommendation) => (
              <article className="project-link" key={recommendation.id}>
                <h3>
                  {formatRecommendationType(recommendation.recommendationType)} ·{" "}
                  {formatRecommendationStatus(recommendation.status)}
                </h3>
                <p className="page-description">
                  {recommendation.resourceType} · {recommendation.resourceId}
                  {recommendation.stageCode ? ` · ${recommendation.stageCode}` : ""}
                  {recommendation.disciplineCode
                    ? ` · ${recommendation.disciplineCode}`
                    : ""}{" "}
                  · {formatProjectDateTime(recommendation.createdAt)}
                </p>
                <p className="page-description">
                  {formatRecommendationPayload(recommendation.outputPayload)}
                </p>
                {recommendation.status === "generated" ? (
                  <div className="version-card-actions">
                    <button
                      className="connection-button secondary"
                      disabled={actionTargetId === recommendation.id}
                      onClick={() => {
                        void handleRecommendation(recommendation, "ignore");
                      }}
                      type="button"
                    >
                      忽略
                    </button>
                    <button
                      className="connection-button"
                      disabled={actionTargetId === recommendation.id}
                      onClick={() => {
                        void handleRecommendation(recommendation, "accept");
                      }}
                      type="button"
                    >
                      接受
                    </button>
                  </div>
                ) : (
                  <p className="page-description">
                    处理人 {recommendation.handledBy ?? "-"} · 原因{" "}
                    {recommendation.statusReason ?? "-"}
                  </p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="没有匹配推荐" body="当前筛选条件下没有 AI 推荐。" />
        )}
      </section>
    </div>
  );
}

function readFilters(searchParams: URLSearchParams): RecommendationFilters {
  return {
    recommendationType:
      searchParams.get("recommendationType") ?? defaultFilters.recommendationType,
    status: searchParams.get("status") ?? defaultFilters.status,
    resourceType: searchParams.get("resourceType") ?? defaultFilters.resourceType,
    resourceId: searchParams.get("resourceId") ?? defaultFilters.resourceId,
    stageCode: searchParams.get("stageCode") ?? defaultFilters.stageCode,
    disciplineCode:
      searchParams.get("disciplineCode") ?? defaultFilters.disciplineCode,
    limit: searchParams.get("limit") ?? defaultFilters.limit,
  };
}

function formatRecommendationType(type: AiRecommendationType) {
  const option = recommendationTypeOptions.find((item) => item.value === type);
  return option?.label ?? type;
}

function formatRecommendationStatus(status: AiRecommendationStatus) {
  const option = statusOptions.find((item) => item.value === status);
  return option?.label ?? status;
}

function formatRecommendationPayload(payload: Record<string, unknown>) {
  const reason = typeof payload.reason === "string" ? payload.reason : null;
  const itemName = typeof payload.itemName === "string" ? payload.itemName : null;
  const quotaName = typeof payload.quotaName === "string" ? payload.quotaName : null;
  const warning = typeof payload.warning === "string" ? payload.warning : null;
  return [reason, itemName, quotaName, warning].filter(Boolean).join(" · ") || "查看详情";
}
