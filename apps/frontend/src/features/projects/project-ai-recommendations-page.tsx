import { useEffect, useMemo, useState, type ReactElement } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { apiClient, ApiError } from "../../lib/api";
import type {
  AiRecommendation,
  AiRecommendationListResponse,
  AiRecommendationStatus,
  AiRecommendationType,
  AiProviderHealthResponse,
  AiProviderTelemetrySummary,
  BackgroundJob,
  ProjectWorkspace,
  VarianceWarningThreshold,
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

type ThresholdForm = {
  stageCode: string;
  disciplineCode: string;
  thresholdAmount: string;
  thresholdRate: string;
};

type AsyncJobForm = {
  recommendationType: AiRecommendationType;
  resourceType: string;
  resourceId: string;
  billVersionId: string;
  stageCode: string;
  disciplineCode: string;
  limit: string;
};

type ContextPreviewState = {
  recommendation: AiRecommendation;
  payload: Record<string, unknown> | null;
  loading: boolean;
  error: string | null;
};

type ProviderDiagnosticsState = {
  health: AiProviderHealthResponse | null;
  loading: boolean;
  message: string | null;
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

const defaultThresholdForm: ThresholdForm = {
  stageCode: "",
  disciplineCode: "",
  thresholdAmount: "",
  thresholdRate: "",
};

const emptyProviderTelemetrySummary: AiProviderTelemetrySummary = {
  totalCount: 0,
  successCount: 0,
  failureCount: 0,
  averageDurationMs: null,
  p95DurationMs: null,
  maxRetryCount: null,
  consecutiveFailureCount: 0,
  groups: [],
  alerts: [],
};

const defaultAsyncJobForm: AsyncJobForm = {
  recommendationType: "bill_recommendation",
  resourceType: "bill_version",
  resourceId: "",
  billVersionId: "",
  stageCode: "",
  disciplineCode: "",
  limit: "10",
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
  { value: "rolled_back", label: "已回滚" },
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
  const [acceptTarget, setAcceptTarget] = useState<AiRecommendation | null>(null);
  const [rollbackTarget, setRollbackTarget] = useState<AiRecommendation | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [thresholds, setThresholds] = useState<VarianceWarningThreshold[]>([]);
  const [thresholdForm, setThresholdForm] =
    useState<ThresholdForm>(defaultThresholdForm);
  const [thresholdSaving, setThresholdSaving] = useState(false);
  const [thresholdMessage, setThresholdMessage] = useState<string | null>(null);
  const [batchExpiring, setBatchExpiring] = useState(false);
  const [recommendationJobs, setRecommendationJobs] = useState<BackgroundJob[]>([]);
  const [providerTelemetrySummary, setProviderTelemetrySummary] =
    useState<AiProviderTelemetrySummary>(emptyProviderTelemetrySummary);
  const [asyncJobForm, setAsyncJobForm] =
    useState<AsyncJobForm>(defaultAsyncJobForm);
  const [jobSubmitting, setJobSubmitting] = useState(false);
  const [jobMessage, setJobMessage] = useState<string | null>(null);
  const [jobPollDelay, setJobPollDelay] = useState(2000);
  const [providerDiagnostics, setProviderDiagnostics] =
    useState<ProviderDiagnosticsState>({
      health: null,
      loading: false,
      message: null,
    });
  const [contextPreview, setContextPreview] = useState<ContextPreviewState | null>(
    null,
  );
  const activeQuery = useMemo(() => readFilters(searchParams), [searchParams]);
  const recommendationGroups = useMemo(
    () => groupRecommendationsByResourceType(state?.recommendations.items ?? []),
    [state?.recommendations.items],
  );
  const canHandleRecommendations =
    state?.workspace.currentUser.permissionSummary.canEditProject ?? false;

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
          limit: readOptionalPositiveInteger(activeQuery.limit),
        }),
      ]);

      setState({
        workspace,
        recommendations,
      });
      try {
        const jobs = await apiClient.listProjectBackgroundJobs(projectId, {
          jobType: "ai_recommendation",
        });
        setRecommendationJobs(jobs.items);
        try {
          setProviderTelemetrySummary(
            await apiClient.getAiProviderTelemetrySummary(projectId),
          );
        } catch {
          setProviderTelemetrySummary(emptyProviderTelemetrySummary);
        }
      } catch {
        setRecommendationJobs([]);
        setProviderTelemetrySummary(emptyProviderTelemetrySummary);
      }
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

  async function loadThresholds() {
    if (!projectId) {
      return;
    }

    try {
      const response = await apiClient.listVarianceWarningThresholds(projectId);
      setThresholds(response.items);
    } catch {
      setThresholdMessage("阈值配置暂时无法加载。");
    }
  }

  useEffect(() => {
    setFilters(readFilters(searchParams));
  }, [searchParams]);

  useEffect(() => {
    void loadRecommendations();
  }, [projectId, activeQuery]);

  useEffect(() => {
    const hasActiveJob = recommendationJobs.some(
      (job) => job.status === "queued" || job.status === "processing",
    );
    if (!projectId || !hasActiveJob) {
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      try {
        const jobs = await apiClient.listProjectBackgroundJobs(projectId, {
          jobType: "ai_recommendation",
        });
        const hadActiveJob = hasActiveJob;
        const completedIds = new Set(
          recommendationJobs
            .filter((job) => job.status !== "completed")
            .map((job) => job.id),
        );
        setRecommendationJobs(jobs.items);
        if (
          hadActiveJob &&
          jobs.items.some(
            (job) => job.status === "completed" && completedIds.has(job.id),
          )
        ) {
          await loadRecommendations();
          setJobMessage("AI 推荐任务已完成，列表已刷新。");
          setJobPollDelay(2000);
        } else {
          setJobPollDelay((current) => Math.min(current + 1000, 10000));
        }
      } catch {
        setJobMessage("AI 推荐任务状态刷新失败。");
      }
    }, jobPollDelay);

    return () => window.clearTimeout(timer);
  }, [projectId, recommendationJobs, jobPollDelay]);

  useEffect(() => {
    void loadThresholds();
  }, [projectId]);

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
        updateRecommendationState(current, updated, activeQuery),
      );
      setActionMessage(
        `${formatRecommendationType(recommendation.recommendationType)}已${
          action === "accept" ? "接受" : "忽略"
        }。`,
      );
      if (action === "accept") {
        setAcceptTarget(null);
      }
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

  async function handleRollbackRecommendation(recommendation: AiRecommendation) {
    setActionTargetId(recommendation.id);
    setActionMessage(null);

    try {
      const updated = await apiClient.rollbackAiRecommendation(
        recommendation.id,
        "人工撤销已接受推荐",
      );
      setState((current) =>
        updateRecommendationState(current, updated, activeQuery),
      );
      setActionMessage("已回滚该推荐接受产生的业务变更。");
      setRollbackTarget(null);
    } catch (submitError) {
      setActionMessage(
        submitError instanceof ApiError
          ? formatRollbackApiError(submitError)
          : "AI 推荐回滚失败，请检查业务数据是否仍可编辑。",
      );
    } finally {
      setActionTargetId(null);
    }
  }

  async function handleCreateAsyncRecommendationJob() {
    if (!projectId) {
      return;
    }
    setJobSubmitting(true);
    setJobMessage(null);

    try {
      const response = await apiClient.createAiRecommendationJob({
        projectId,
        recommendationType: asyncJobForm.recommendationType,
        resourceType: asyncJobForm.resourceType || undefined,
        resourceId:
          asyncJobForm.resourceId ||
          asyncJobForm.billVersionId ||
          state?.workspace.billVersions[0]?.id ||
          undefined,
        billVersionId: asyncJobForm.billVersionId || undefined,
        stageCode: asyncJobForm.stageCode || undefined,
        disciplineCode: asyncJobForm.disciplineCode || undefined,
        limit: readOptionalPositiveInteger(asyncJobForm.limit),
      });
      setRecommendationJobs((current) => [response.job, ...current]);
      setJobMessage(`已提交异步推荐任务 ${response.job.id}。`);
      setJobPollDelay(2000);
    } catch (submitError) {
      setJobMessage(
        submitError instanceof ApiError
          ? submitError.message
          : "异步推荐任务提交失败，请稍后重试。",
      );
    } finally {
      setJobSubmitting(false);
    }
  }

  async function handleCheckProviderHealth() {
    setProviderDiagnostics((current) => ({
      ...current,
      loading: true,
      message: null,
    }));

    try {
      const health = await apiClient.getAiProviderHealth();
      setProviderDiagnostics({
        health,
        loading: false,
        message: health.healthy ? "Provider 连通性正常。" : "Provider 当前不可用。",
      });
    } catch (healthError) {
      setProviderDiagnostics({
        health: null,
        loading: false,
        message:
          healthError instanceof ApiError
            ? formatProviderDiagnosticsApiError(healthError)
            : "Provider 健康检查失败。",
      });
    }
  }

  async function handleThresholdSubmit() {
    if (!projectId) {
      return;
    }

    const thresholdAmount = Number(thresholdForm.thresholdAmount);
    const thresholdRate = Number(thresholdForm.thresholdRate) / 100;

    if (!Number.isFinite(thresholdAmount) || thresholdAmount < 0) {
      setThresholdMessage("金额阈值必须为非负数字。");
      return;
    }

    if (!Number.isFinite(thresholdRate) || thresholdRate < 0) {
      setThresholdMessage("比率阈值必须为非负数字。");
      return;
    }

    setThresholdSaving(true);
    setThresholdMessage(null);

    try {
      const saved = await apiClient.upsertVarianceWarningThreshold(projectId, {
        stageCode: thresholdForm.stageCode.trim() || null,
        disciplineCode: thresholdForm.disciplineCode.trim() || null,
        thresholdAmount,
        thresholdRate,
      });
      setThresholds((current) => upsertThreshold(current, saved));
      setThresholdForm(defaultThresholdForm);
      setThresholdMessage("阈值配置已保存。");
    } catch (submitError) {
      setThresholdMessage(
        submitError instanceof ApiError
          ? submitError.message
          : "阈值配置保存失败，请稍后重试。",
      );
    } finally {
      setThresholdSaving(false);
    }
  }

  async function handleExpireStaleRecommendations() {
    if (!projectId) {
      return;
    }

    setBatchExpiring(true);
    setActionMessage(null);

    try {
      const response = await apiClient.expireStaleAiRecommendations({
        projectId,
        recommendationType:
          activeQuery.recommendationType === ""
            ? undefined
            : (activeQuery.recommendationType as AiRecommendationType),
        resourceType: activeQuery.resourceType || undefined,
        resourceId: activeQuery.resourceId || undefined,
        stageCode: activeQuery.stageCode || undefined,
        disciplineCode: activeQuery.disciplineCode || undefined,
        reason: "人工批量失效",
      });
      await loadRecommendations();
      setActionMessage(`已批量失效 ${response.items.length} 条待处理推荐。`);
    } catch (submitError) {
      setActionMessage(
        submitError instanceof ApiError
          ? submitError.message
          : "AI 推荐批量失效失败，请稍后重试。",
      );
    } finally {
      setBatchExpiring(false);
    }
  }

  async function handleOpenContextPreview(recommendation: AiRecommendation) {
    if (!projectId) {
      return;
    }

    setContextPreview({
      recommendation,
      payload: null,
      loading: true,
      error: null,
    });

    try {
      const payload = await apiClient.getAiRecommendationContext(projectId, {
        recommendationType: recommendation.recommendationType,
        resourceType: recommendation.resourceType,
        resourceId: recommendation.resourceId,
        stageCode: recommendation.stageCode ?? undefined,
        disciplineCode: recommendation.disciplineCode ?? undefined,
      });
      setContextPreview({
        recommendation,
        payload,
        loading: false,
        error: null,
      });
    } catch (previewError) {
      setContextPreview({
        recommendation,
        payload: null,
        loading: false,
        error:
          previewError instanceof ApiError
            ? previewError.message
            : "AI 输入上下文加载失败。",
      });
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
            <select
              aria-label="阶段"
              onChange={(event) => updateFilter("stageCode", event.target.value)}
              value={filters.stageCode}
            >
              <option value="">全部</option>
              {state.workspace.availableStages.map((stage) => (
                <option key={stage.stageCode} value={stage.stageCode}>
                  {formatStageOption(stage.stageCode, stage.stageName)}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            专业
            <select
              aria-label="专业"
              onChange={(event) => updateFilter("disciplineCode", event.target.value)}
              value={filters.disciplineCode}
            >
              <option value="">全部</option>
              {state.workspace.disciplines.map((discipline) => (
                <option
                  key={discipline.disciplineCode}
                  value={discipline.disciplineCode}
                >
                  {formatDisciplineOption(
                    discipline.disciplineCode,
                    discipline.disciplineName,
                  )}
                </option>
              ))}
            </select>
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
        <h2>偏差预警阈值</h2>
        {thresholdMessage ? (
          <p className="page-description">{thresholdMessage}</p>
        ) : null}
        <div className="form-grid">
          <label className="form-field">
            阈值阶段
            <select
              aria-label="阈值阶段"
              onChange={(event) =>
                setThresholdForm((current) => ({
                  ...current,
                  stageCode: event.target.value,
                }))
              }
              value={thresholdForm.stageCode}
            >
              <option value="">项目默认</option>
              {state.workspace.availableStages.map((stage) => (
                <option key={stage.stageCode} value={stage.stageCode}>
                  {formatStageOption(stage.stageCode, stage.stageName)}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            阈值专业
            <select
              aria-label="阈值专业"
              onChange={(event) =>
                setThresholdForm((current) => ({
                  ...current,
                  disciplineCode: event.target.value,
                }))
              }
              value={thresholdForm.disciplineCode}
            >
              <option value="">全部专业</option>
              {state.workspace.disciplines.map((discipline) => (
                <option
                  key={discipline.disciplineCode}
                  value={discipline.disciplineCode}
                >
                  {formatDisciplineOption(
                    discipline.disciplineCode,
                    discipline.disciplineName,
                  )}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            金额阈值
            <input
              aria-label="金额阈值"
              min="0"
              onChange={(event) =>
                setThresholdForm((current) => ({
                  ...current,
                  thresholdAmount: event.target.value,
                }))
              }
              placeholder="5000"
              type="number"
              value={thresholdForm.thresholdAmount}
            />
          </label>
          <label className="form-field">
            比率阈值
            <input
              aria-label="比率阈值"
              min="0"
              onChange={(event) =>
                setThresholdForm((current) => ({
                  ...current,
                  thresholdRate: event.target.value,
                }))
              }
              placeholder="8"
              type="number"
              value={thresholdForm.thresholdRate}
            />
          </label>
        </div>
        <div className="button-row">
          <button
            className="primary-button"
            disabled={!canHandleRecommendations || thresholdSaving}
            onClick={() => {
              void handleThresholdSubmit();
            }}
            type="button"
          >
            保存阈值
          </button>
        </div>
        {thresholds.length > 0 ? (
          <div className="recommendation-meta-list">
            {thresholds.map((threshold) => (
              <p className="page-description" key={threshold.id}>
                {formatThreshold(threshold)}
              </p>
            ))}
          </div>
        ) : (
          <p className="page-description">当前未配置阈值。</p>
        )}
      </section>

      <section className="panel">
        <h2>异步生成</h2>
        {jobMessage ? <p className="page-description">{jobMessage}</p> : null}
        <div className="form-grid">
          <label className="form-field">
            生成类型
            <select
              aria-label="生成类型"
              onChange={(event) =>
                setAsyncJobForm((current) => ({
                  ...current,
                  recommendationType: event.target.value as AiRecommendationType,
                }))
              }
              value={asyncJobForm.recommendationType}
            >
              {recommendationTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            目标版本
            <select
              aria-label="目标版本"
              onChange={(event) =>
                setAsyncJobForm((current) => ({
                  ...current,
                  billVersionId: event.target.value,
                  resourceId:
                    current.resourceType === "bill_version"
                      ? event.target.value
                      : current.resourceId,
                }))
              }
              value={asyncJobForm.billVersionId}
            >
              <option value="">默认版本</option>
              {state.workspace.billVersions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.versionName}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            目标资源类型
            <input
              aria-label="目标资源类型"
              onChange={(event) =>
                setAsyncJobForm((current) => ({
                  ...current,
                  resourceType: event.target.value,
                }))
              }
              value={asyncJobForm.resourceType}
            />
          </label>
          <label className="form-field">
            目标资源 ID
            <input
              aria-label="目标资源 ID"
              onChange={(event) =>
                setAsyncJobForm((current) => ({
                  ...current,
                  resourceId: event.target.value,
                }))
              }
              placeholder="bill-item-001"
              value={asyncJobForm.resourceId}
            />
          </label>
          <label className="form-field">
            任务阶段
            <select
              aria-label="任务阶段"
              onChange={(event) =>
                setAsyncJobForm((current) => ({
                  ...current,
                  stageCode: event.target.value,
                }))
              }
              value={asyncJobForm.stageCode}
            >
              <option value="">默认阶段</option>
              {state.workspace.availableStages.map((stage) => (
                <option key={stage.stageCode} value={stage.stageCode}>
                  {formatStageOption(stage.stageCode, stage.stageName)}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            任务专业
            <select
              aria-label="任务专业"
              onChange={(event) =>
                setAsyncJobForm((current) => ({
                  ...current,
                  disciplineCode: event.target.value,
                }))
              }
              value={asyncJobForm.disciplineCode}
            >
              <option value="">默认专业</option>
              {state.workspace.disciplines.map((discipline) => (
                <option
                  key={discipline.disciplineCode}
                  value={discipline.disciplineCode}
                >
                  {formatDisciplineOption(
                    discipline.disciplineCode,
                    discipline.disciplineName,
                  )}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            生成数量
            <input
              aria-label="生成数量"
              min="1"
              max="100"
              onChange={(event) =>
                setAsyncJobForm((current) => ({
                  ...current,
                  limit: event.target.value,
                }))
              }
              type="number"
              value={asyncJobForm.limit}
            />
          </label>
        </div>
        <div className="button-row">
          <button
            className="primary-button"
            disabled={!canHandleRecommendations || jobSubmitting}
            onClick={() => {
              void handleCreateAsyncRecommendationJob();
            }}
            type="button"
          >
            生成推荐
          </button>
        </div>
        {recommendationJobs.length > 0 ? (
          <div className="recommendation-meta-list">
            {recommendationJobs.slice(0, 5).map((job) => (
              <p className="page-description" key={job.id}>
                {job.id} · {formatJobStatus(job.status)} ·{" "}
                {formatProjectDateTime(job.createdAt)}
                {job.errorMessage ? ` · ${job.errorMessage}` : ""}
              </p>
            ))}
          </div>
        ) : (
          <p className="page-description">当前暂无 AI 推荐任务。</p>
        )}
      </section>

      <section className="panel">
        <h2>Provider 诊断</h2>
        <div className="recommendation-meta-list">
          <p className="page-description">
            最近任务 {providerTelemetrySummary.totalCount} 个 · 成功{" "}
            {providerTelemetrySummary.successCount} 个 · 失败{" "}
            {providerTelemetrySummary.failureCount} 个
            {providerTelemetrySummary.averageDurationMs === null
              ? ""
              : ` · 平均耗时 ${providerTelemetrySummary.averageDurationMs}ms`}
            {providerTelemetrySummary.p95DurationMs === null
              ? ""
              : ` · P95 ${providerTelemetrySummary.p95DurationMs}ms`}
            {providerTelemetrySummary.maxRetryCount === null
              ? ""
              : ` · 最大重试 ${providerTelemetrySummary.maxRetryCount}`}
            {providerTelemetrySummary.consecutiveFailureCount > 0
              ? ` · 连续失败 ${providerTelemetrySummary.consecutiveFailureCount}`
              : ""}
          </p>
          {providerTelemetrySummary.groups.slice(0, 3).map((group) => (
            <p className="page-description" key={`${group.provider}:${group.model ?? "-"}`}>
              {group.provider} / {group.model ?? "-"} · 成功 {group.successCount} · 失败{" "}
              {group.failureCount}
              {group.p95DurationMs === null ? "" : ` · P95 ${group.p95DurationMs}ms`}
            </p>
          ))}
          {providerTelemetrySummary.alerts.map((alert) => (
            <p className="recommendation-expired" key={alert}>
              {alert}
            </p>
          ))}
          {providerDiagnostics.message ? (
            <p className="page-description">{providerDiagnostics.message}</p>
          ) : null}
          {providerDiagnostics.health ? (
            <p className="page-description">
              {formatProviderHealth(providerDiagnostics.health)}
            </p>
          ) : null}
        </div>
        <div className="button-row">
          <button
            className="primary-button secondary"
            disabled={providerDiagnostics.loading}
            onClick={() => {
              void handleCheckProviderHealth();
            }}
            type="button"
          >
            检查 Provider
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>推荐列表</h2>
        {actionMessage ? <p className="page-description">{actionMessage}</p> : null}
        <div className="button-row">
          <button
            className="primary-button secondary"
            disabled={
              !canHandleRecommendations ||
              batchExpiring ||
              state.recommendations.summary.statusCounts.generated === 0
            }
            onClick={() => {
              void handleExpireStaleRecommendations();
            }}
            type="button"
          >
            批量标记失效
          </button>
        </div>
        {state.recommendations.items.length > 0 ? (
          <div className="recommendation-group-list">
            {recommendationGroups.map((group) => (
              <section className="recommendation-group" key={group.resourceType}>
                <h3>资源 {group.resourceType} · {group.items.length} 条</h3>
                <div className="project-list">
                  {group.items.map((recommendation) => (
                    <article
                      className={
                        recommendation.status === "expired"
                          ? "project-link recommendation-card expired"
                          : "project-link recommendation-card"
                      }
                      key={recommendation.id}
                    >
                      <h4>
                        {formatRecommendationType(recommendation.recommendationType)} ·{" "}
                        {formatRecommendationStatus(recommendation.status)}
                      </h4>
                      {recommendation.status === "expired" ? (
                        <p className="recommendation-expired">已失效 · 不再建议执行</p>
                      ) : null}
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
                      {formatRecommendationTrace(recommendation.outputPayload) ? (
                        <p className="page-description">
                          {formatRecommendationTrace(recommendation.outputPayload)}
                        </p>
                      ) : null}
                      {formatRecommendationProvider(recommendation.inputPayload) ? (
                        <p className="page-description">
                          {formatRecommendationProvider(recommendation.inputPayload)}
                        </p>
                      ) : null}
                      <p className="page-description">
                        生成人 {recommendation.createdBy}
                      </p>
                      <div className="version-card-actions">
                        <button
                          className="connection-button secondary"
                          onClick={() => {
                            void handleOpenContextPreview(recommendation);
                          }}
                          type="button"
                        >
                          预览上下文
                        </button>
                      </div>
                      {recommendation.status === "expired" ? (
                        <ExpiredRecommendationReason recommendation={recommendation} />
                      ) : null}
                      {recommendation.status === "generated" && canHandleRecommendations ? (
                        <>
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
                                setAcceptTarget(recommendation);
                                setActionMessage(null);
                              }}
                              type="button"
                            >
                              接受
                            </button>
                          </div>
                          {acceptTarget?.id === recommendation.id ? (
                            <div
                              aria-label="确认接受 AI 推荐"
                              className="action-confirmation"
                              role="dialog"
                            >
                              <p className="page-description">
                                确认接受后，系统会按该推荐写入正式业务链并保留审计记录。
                              </p>
                              <p className="page-description">
                                {formatRecommendationType(recommendation.recommendationType)} ·{" "}
                                {recommendation.resourceType} · {recommendation.resourceId}
                              </p>
                              <div className="version-card-actions">
                                <button
                                  className="connection-button secondary"
                                  disabled={actionTargetId === recommendation.id}
                                  onClick={() => setAcceptTarget(null)}
                                  type="button"
                                >
                                  取消
                                </button>
                                <button
                                  className="connection-button"
                                  disabled={actionTargetId === recommendation.id}
                                  onClick={() => {
                                    void handleRecommendation(recommendation, "accept");
                                  }}
                                  type="button"
                                >
                                  确认接受
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </>
                      ) : recommendation.status === "generated" ? (
                        <p className="page-description">
                          当前用户仅可查看推荐，不能接受或忽略。
                        </p>
                      ) : (
                        <>
                          <AcceptedChangeSummary recommendation={recommendation} />
                          <p className="page-description">
                            处理人 {recommendation.handledBy ?? "-"} · 原因{" "}
                            {recommendation.statusReason ?? "-"}
                          </p>
                          <p className="page-description">
                            处理时间{" "}
                            {recommendation.handledAt
                              ? formatProjectDateTime(recommendation.handledAt)
                              : "-"}
                          </p>
                          {recommendation.status === "accepted" &&
                          canHandleRecommendations &&
                          canRollbackRecommendation(recommendation) ? (
                            <>
                              <div className="version-card-actions">
                                <button
                                  className="connection-button secondary"
                                  disabled={actionTargetId === recommendation.id}
                                  onClick={() => {
                                    setRollbackTarget(recommendation);
                                    setActionMessage(null);
                                  }}
                                  type="button"
                                >
                                  撤销接受
                                </button>
                              </div>
                              {rollbackTarget?.id === recommendation.id ? (
                                <div
                                  aria-label="确认撤销 AI 推荐"
                                  className="action-confirmation"
                                  role="dialog"
                                >
                                  <p className="page-description">
                                    撤销前将校验业务数据是否仍与接受快照一致；若已被修改或引用，需要人工处理。
                                  </p>
                                  <AcceptedChangeSummary recommendation={recommendation} />
                                  <div className="version-card-actions">
                                    <button
                                      className="connection-button secondary"
                                      disabled={actionTargetId === recommendation.id}
                                      onClick={() => setRollbackTarget(null)}
                                      type="button"
                                    >
                                      取消
                                    </button>
                                    <button
                                      className="connection-button"
                                      disabled={actionTargetId === recommendation.id}
                                      onClick={() => {
                                        void handleRollbackRecommendation(recommendation);
                                      }}
                                      type="button"
                                    >
                                      确认撤销
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                            </>
                          ) : null}
                        </>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <EmptyState title="没有匹配推荐" body="当前筛选条件下没有 AI 推荐。" />
        )}
      </section>
      {contextPreview ? (
        <div
          aria-label="AI 输入上下文预览"
          className="action-confirmation"
          role="dialog"
        >
          <h2>AI 输入上下文预览</h2>
          <p className="page-description">
            {formatRecommendationType(contextPreview.recommendation.recommendationType)} ·{" "}
            {contextPreview.recommendation.resourceType} ·{" "}
            {contextPreview.recommendation.resourceId}
          </p>
          {contextPreview.loading ? (
            <p className="page-description">正在加载上下文...</p>
          ) : contextPreview.error ? (
            <p className="page-description">{contextPreview.error}</p>
          ) : (
            <ContextPreviewDetails payload={contextPreview.payload ?? {}} />
          )}
          <div className="version-card-actions">
            <button
              className="connection-button secondary"
              onClick={() => setContextPreview(null)}
              type="button"
            >
              关闭
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function groupRecommendationsByResourceType(items: AiRecommendation[]) {
  const grouped = new Map<string, AiRecommendation[]>();

  for (const item of items) {
    const group = grouped.get(item.resourceType) ?? [];
    group.push(item);
    grouped.set(item.resourceType, group);
  }

  return Array.from(grouped.entries()).map(([resourceType, groupItems]) => ({
    resourceType,
    items: groupItems,
  }));
}

function ContextPreviewDetails(props: { payload: Record<string, unknown> }) {
  const sections = Object.entries(props.payload);

  if (sections.length === 0) {
    return <p className="page-description">当前推荐没有可展示的输入上下文。</p>;
  }

  return (
    <div className="context-preview-grid">
      {sections.map(([key, value]) => (
        <section className="context-preview-section" key={key}>
          <h3>{formatContextKey(key)}</h3>
          {renderContextValue(value)}
        </section>
      ))}
    </div>
  );
}

function renderContextValue(value: unknown): ReactElement {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <p className="page-description">暂无数据</p>;
    }

    return (
      <div className="context-preview-list">
        {value.slice(0, 8).map((item, index) => (
          <div className="context-preview-item" key={index}>
            {renderContextValue(item)}
          </div>
        ))}
        {value.length > 8 ? (
          <p className="page-description">其余 {value.length - 8} 项已折叠。</p>
        ) : null}
      </div>
    );
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return <p className="page-description">暂无数据</p>;
    }

    return (
      <dl className="context-preview-fields">
        {entries.slice(0, 12).map(([entryKey, entryValue]) => (
          <div key={entryKey}>
            <dt>{formatContextKey(entryKey)}</dt>
            <dd>{formatContextPrimitive(entryValue)}</dd>
          </div>
        ))}
        {entries.length > 12 ? (
          <div>
            <dt>更多字段</dt>
            <dd>{entries.length - 12} 项</dd>
          </div>
        ) : null}
      </dl>
    );
  }

  return <p className="page-description">{formatContextPrimitive(value)}</p>;
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

function readOptionalPositiveInteger(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function updateRecommendationState(
  current: RecommendationState | null,
  updated: AiRecommendation,
  activeQuery: Record<string, string>,
): RecommendationState | null {
  if (!current) {
    return current;
  }

  const items = current.recommendations.items.flatMap((item) => {
    if (item.id !== updated.id) {
      return [item];
    }

    return matchesActiveRecommendationFilters(updated, activeQuery) ? [updated] : [];
  });

  return {
    ...current,
    recommendations: {
      ...current.recommendations,
      items,
      summary: summarizeVisibleRecommendations(items),
    },
  };
}

function matchesActiveRecommendationFilters(
  recommendation: AiRecommendation,
  activeQuery: Record<string, string>,
) {
  if (
    activeQuery.recommendationType &&
    recommendation.recommendationType !== activeQuery.recommendationType
  ) {
    return false;
  }

  if (activeQuery.status && recommendation.status !== activeQuery.status) {
    return false;
  }

  if (activeQuery.resourceType && recommendation.resourceType !== activeQuery.resourceType) {
    return false;
  }

  if (activeQuery.resourceId && recommendation.resourceId !== activeQuery.resourceId) {
    return false;
  }

  if (activeQuery.stageCode && recommendation.stageCode !== activeQuery.stageCode) {
    return false;
  }

  if (
    activeQuery.disciplineCode &&
    recommendation.disciplineCode !== activeQuery.disciplineCode
  ) {
    return false;
  }

  return true;
}

function summarizeVisibleRecommendations(items: AiRecommendation[]) {
  return {
    totalCount: items.length,
    statusCounts: {
      generated: items.filter((item) => item.status === "generated").length,
      accepted: items.filter((item) => item.status === "accepted").length,
      ignored: items.filter((item) => item.status === "ignored").length,
      expired: items.filter((item) => item.status === "expired").length,
      rolled_back: items.filter((item) => item.status === "rolled_back").length,
    },
    typeCounts: {
      bill_recommendation: items.filter(
        (item) => item.recommendationType === "bill_recommendation",
      ).length,
      quota_recommendation: items.filter(
        (item) => item.recommendationType === "quota_recommendation",
      ).length,
      variance_warning: items.filter(
        (item) => item.recommendationType === "variance_warning",
      ).length,
    },
  };
}

function upsertThreshold(
  current: VarianceWarningThreshold[],
  saved: VarianceWarningThreshold,
) {
  const next = current.filter(
    (item) =>
      (item.stageCode ?? null) !== (saved.stageCode ?? null) ||
      (item.disciplineCode ?? null) !== (saved.disciplineCode ?? null),
  );
  return [...next, saved].sort(compareThresholdScope);
}

function formatThreshold(threshold: VarianceWarningThreshold) {
  const stageScope = threshold.stageCode ? threshold.stageCode : "全部阶段";
  const disciplineScope = threshold.disciplineCode
    ? threshold.disciplineCode
    : "全部专业";
  const scope = `${stageScope} · ${disciplineScope}`;
  return `${scope} · 金额 ${formatPlainNumber(threshold.thresholdAmount)} · 比率 ${formatPercent(
    threshold.thresholdRate,
  )}`;
}

function compareThresholdScope(
  left: VarianceWarningThreshold,
  right: VarianceWarningThreshold,
) {
  const stageCompare = (left.stageCode ?? "").localeCompare(right.stageCode ?? "");
  if (stageCompare !== 0) {
    return stageCompare;
  }
  return (left.disciplineCode ?? "").localeCompare(right.disciplineCode ?? "");
}

function formatStageOption(stageCode: string, stageName: string) {
  return stageName === stageCode ? stageCode : `${stageName} (${stageCode})`;
}

function formatDisciplineOption(disciplineCode: string, disciplineName: string) {
  return disciplineName === disciplineCode
    ? disciplineCode
    : `${disciplineName} (${disciplineCode})`;
}

function formatContextKey(key: string) {
  const labels: Record<string, string> = {
    project: "项目",
    currentStage: "当前阶段",
    targetResource: "目标资源",
    billVersion: "清单版本",
    billItem: "清单项",
    quotaLine: "定额行",
    varianceSummary: "偏差摘要",
    summaryDetails: "汇总明细",
    knowledge: "知识上下文",
    memory: "记忆上下文",
  };
  return labels[key] ?? key;
}

function formatContextPrimitive(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
  }
  if (typeof value === "boolean") {
    return value ? "是" : "否";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

function formatPlainNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function formatPercent(value: number) {
  const percent = value * 100;
  return `${Number.isInteger(percent) ? percent : Number(percent.toFixed(2))}%`;
}

function formatRecommendationType(type: AiRecommendationType) {
  const option = recommendationTypeOptions.find((item) => item.value === type);
  return option?.label ?? type;
}

function formatRecommendationStatus(status: AiRecommendationStatus) {
  const option = statusOptions.find((item) => item.value === status);
  return option?.label ?? status;
}

function formatJobStatus(status: BackgroundJob["status"]) {
  const labels: Record<BackgroundJob["status"], string> = {
    queued: "排队中",
    processing: "处理中",
    completed: "已完成",
    failed: "失败",
  };
  return labels[status] ?? status;
}

function formatProviderHealth(health: AiProviderHealthResponse) {
  const provider = health.provider ?? "openai_compatible";
  const model = health.model ?? "-";
  const status = health.healthy ? "健康" : "异常";
  const configured = health.configured ? "已配置" : "未配置";
  return `${provider} / ${model} · ${configured} · ${status}${
    health.message ? ` · ${health.message}` : ""
  }`;
}

function formatProviderDiagnosticsApiError(error: ApiError) {
  const details = readObjectFromUnknown(error.details);
  if (!details) {
    return error.message;
  }

  return `${error.message}。原始错误：${JSON.stringify(details)}`;
}

function formatRollbackApiError(error: ApiError) {
  if (error.code !== "AI_RECOMMENDATION_ROLLBACK_BLOCKED") {
    return error.message;
  }

  const details = readObjectFromUnknown(error.details);
  const reason =
    typeof details?.reason === "string" ? details.reason : "unknown";
  const resourceType =
    typeof details?.resourceType === "string" ? details.resourceType : "资源";
  const resourceId =
    typeof details?.resourceId === "string" ? details.resourceId : "-";
  const label = typeof details?.label === "string" && details.label ? details.label : "";

  return `无法自动撤销：${formatRollbackBlockedReason(reason)}（${resourceType} · ${resourceId}${
    label ? ` · ${label}` : ""
  }），请人工核对后处理。`;
}

function formatRollbackBlockedReason(reason: string) {
  const labels: Record<string, string> = {
    resource_missing: "业务资源已缺失",
    resource_modified: "业务资源已被修改",
    resource_has_children: "清单下存在子清单",
    resource_has_quota_lines: "清单下存在定额行",
  };
  return labels[reason] ?? "业务数据当前不可安全回滚";
}

function readObjectFromUnknown(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readAcceptedChanges(recommendation: AiRecommendation) {
  const value = recommendation.outputPayload.acceptedChanges;
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is Record<string, unknown> =>
      item !== null && typeof item === "object" && !Array.isArray(item),
  );
}

function canRollbackRecommendation(recommendation: AiRecommendation) {
  const changes = readAcceptedChanges(recommendation);
  return (
    changes.length > 0 &&
    changes.every((change) => change.rollbackSupported === true)
  );
}

function AcceptedChangeSummary(props: { recommendation: AiRecommendation }) {
  const changes = readAcceptedChanges(props.recommendation);
  if (changes.length === 0) {
    return null;
  }

  return (
    <div className="recommendation-meta-list">
      {changes.map((change, index) => (
        <p className="page-description" key={`${change.resourceType}-${change.resourceId}-${index}`}>
          本次接受{formatAcceptedChangeAction(change.action)}{" "}
          {formatContextPrimitive(change.resourceType)} ·{" "}
          {formatContextPrimitive(change.resourceId)}
          {typeof change.label === "string" && change.label ? ` · ${change.label}` : ""}
        </p>
      ))}
    </div>
  );
}

function formatAcceptedChangeAction(value: unknown) {
  return value === "delete" ? "删除了" : "创建了";
}

function formatRecommendationPayload(payload: Record<string, unknown>) {
  const prompt = typeof payload.prompt === "string" ? payload.prompt : null;
  const promptType =
    typeof payload.promptType === "string" ? payload.promptType : null;
  const billItemCode =
    typeof payload.billItemCode === "string" ? payload.billItemCode : null;
  const billItemName =
    typeof payload.billItemName === "string" ? payload.billItemName : null;
  if (promptType === "missing_quota" && prompt) {
    return [
      billItemCode || billItemName
        ? `缺失定额提示 · ${[billItemCode, billItemName].filter(Boolean).join(" ")}`
        : "缺失定额提示",
      prompt,
    ].join(" · ");
  }

  const reason = typeof payload.reason === "string" ? payload.reason : null;
  const itemName = typeof payload.itemName === "string" ? payload.itemName : null;
  const quotaName = typeof payload.quotaName === "string" ? payload.quotaName : null;
  const warning = typeof payload.warning === "string" ? payload.warning : null;
  return [reason, itemName, quotaName, warning].filter(Boolean).join(" · ") || "查看详情";
}

function formatRecommendationTrace(payload: Record<string, unknown>) {
  const traceId =
    typeof payload.aiAssistTraceId === "string" ? payload.aiAssistTraceId : null;
  const responseSummary =
    payload.aiResponseSummary &&
    typeof payload.aiResponseSummary === "object" &&
    !Array.isArray(payload.aiResponseSummary)
      ? (payload.aiResponseSummary as Record<string, unknown>)
      : null;
  const valueCount =
    typeof responseSummary?.valueCount === "number" ? responseSummary.valueCount : null;

  if (!traceId) {
    return null;
  }

  return valueCount === null
    ? `追溯 ${traceId}`
    : `追溯 ${traceId} · 输出字段 ${valueCount}`;
}

function formatRecommendationProvider(payload: Record<string, unknown>) {
  const providerPayload =
    payload.aiProvider &&
    typeof payload.aiProvider === "object" &&
    !Array.isArray(payload.aiProvider)
      ? (payload.aiProvider as Record<string, unknown>)
      : null;
  const provider =
    typeof providerPayload?.provider === "string" ? providerPayload.provider : null;
  const model = typeof providerPayload?.model === "string" ? providerPayload.model : null;

  return provider && model ? `来源 ${provider} / ${model}` : null;
}

function ExpiredRecommendationReason(props: { recommendation: AiRecommendation }) {
  const details = formatStaleReason(props.recommendation.inputPayload);

  return (
    <div className="recommendation-expired-detail">
      <p className="page-description">
        失效原因 {props.recommendation.statusReason ?? "系统判定推荐上下文已变化"}
      </p>
      {details ? <p className="page-description">{details}</p> : null}
    </div>
  );
}

function formatStaleReason(payload: Record<string, unknown>) {
  const staleReason =
    payload.staleReason &&
    typeof payload.staleReason === "object" &&
    !Array.isArray(payload.staleReason)
      ? (payload.staleReason as Record<string, unknown>)
      : null;

  if (!staleReason) {
    return null;
  }

  const previousVersionId =
    typeof staleReason.previousVersionId === "string"
      ? staleReason.previousVersionId
      : null;
  const currentVersionId =
    typeof staleReason.currentVersionId === "string"
      ? staleReason.currentVersionId
      : null;

  if (previousVersionId && currentVersionId) {
    return `版本 ${previousVersionId} → ${currentVersionId}`;
  }

  const previousStageCode =
    typeof staleReason.previousStageCode === "string"
      ? staleReason.previousStageCode
      : null;
  const currentStageCode =
    typeof staleReason.currentStageCode === "string"
      ? staleReason.currentStageCode
      : null;

  return previousStageCode && currentStageCode
    ? `阶段 ${previousStageCode} → ${currentStageCode}`
    : null;
}
