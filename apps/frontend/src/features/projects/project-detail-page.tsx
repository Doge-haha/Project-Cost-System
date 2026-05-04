import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { apiClient, ApiError } from "../../lib/api";
import type {
  ApiHealthResponse,
  AuditLogRecord,
  AiProviderHealthResponse,
  AiProviderTelemetrySummary,
  BackgroundJobListResponse,
  BillVersion,
  ProjectWorkspace,
  SummaryResponse,
} from "../../lib/types";
import { EmptyState } from "../shared/empty-state";
import { ErrorState } from "../shared/error-state";
import { LoadingState } from "../shared/loading-state";
import { BillVersionSelector } from "../shared/bill-version-selector";
import {
  appendFailureCollaborationParams,
  buildFailureCollaborationUnitLabel,
  formatFailureReasonLabel,
  normalizeFailureSubsetFilter,
  normalizeFailureReason,
} from "./failure-reason-label";
import {
  buildProjectDetailNavigation,
  pickInitialBillVersionId,
} from "./project-detail-navigation";
import { buildProjectDashboardSummary } from "./project-dashboard-summary";
import { buildProjectVersionCards } from "./project-version-cards";
import {
  clearRecentProcessingLink,
  readRecentProcessingLink,
  saveRecentProcessingLink,
} from "./recent-processing-link";
import { RecentProcessingSummaryCard } from "./recent-processing-summary-card";
import {
  buildAdjustedWorkspaceSummary,
  normalizeRefreshResultKind,
  normalizeRefreshResultStatus,
} from "./processing-refresh-summary";
import { buildProcessingRefreshBatchEntries } from "./processing-refresh-batch";
import {
  buildProjectDetailRefreshBatchSummaryLabel,
  buildProjectDetailRefreshNotice,
  buildActivityPath,
  buildSummaryItemPath,
  clearRefreshState,
  formatAction,
  formatResourceType,
  formatResultStatus,
  matchesRefreshResourceType,
} from "./project-detail-model";
import { buildAbsoluteAppUrl } from "./project-link-utils";
import { formatProjectDateTime } from "./project-date-utils";

type ProjectDetailState = {
  workspace: ProjectWorkspace;
  recentActivity: AuditLogRecord[];
  providerTelemetry: AiProviderTelemetrySummary | null;
};

type RuntimeDiagnosticsState = {
  apiHealth: ApiHealthResponse | null;
  providerHealth: AiProviderHealthResponse | null;
  jobsSummary: BackgroundJobListResponse["summary"] | null;
  providerTelemetry: AiProviderTelemetrySummary | null;
  loading: boolean;
  message: string | null;
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

export function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.projectId;
  const [searchParams, setSearchParams] = useSearchParams();
  const failureReason = normalizeFailureReason(searchParams.get("failureReason"));
  const failureReasonLabel = formatFailureReasonLabel(failureReason);
  const failureResourceType = normalizeFailureSubsetFilter(
    searchParams.get("failureResourceType"),
  );
  const failureAction = normalizeFailureSubsetFilter(searchParams.get("failureAction"));
  const failureCollaborationUnitLabel = useMemo(
    () =>
      failureReasonLabel
        ? buildFailureCollaborationUnitLabel({
            failureReasonLabel,
            failureResourceType,
            failureAction,
          })
        : null,
    [failureAction, failureReasonLabel, failureResourceType],
  );
  const [state, setState] = useState<ProjectDetailState | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<SummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [copiedLinkPath, setCopiedLinkPath] = useState<string | null>(null);
  const [recentCopiedLink, setRecentCopiedLink] = useState(
    readRecentProcessingLink(projectId),
  );
  const [activityCopyMessage, setActivityCopyMessage] = useState<string | null>(null);
  const [activityCopiedLinkPath, setActivityCopiedLinkPath] = useState<string | null>(null);
  const [versionActionMessage, setVersionActionMessage] = useState<string | null>(null);
  const [versionActionError, setVersionActionError] = useState<string | null>(null);
  const [versionActionTargetId, setVersionActionTargetId] = useState<string | null>(null);
  const [selectedBillVersionId, setSelectedBillVersionId] = useState<string | null>(
    null,
  );
  const [runtimeDiagnostics, setRuntimeDiagnostics] =
    useState<RuntimeDiagnosticsState>({
      apiHealth: null,
      providerHealth: null,
      jobsSummary: null,
      providerTelemetry: null,
      loading: false,
      message: null,
    });

  const selectedBillVersion = useMemo(
    () =>
      state?.workspace.billVersions.find(
        (version) => version.id === selectedBillVersionId,
      ) ??
      state?.workspace.billVersions[0] ??
      null,
    [selectedBillVersionId, state?.workspace.billVersions],
  );
  const refreshSource = searchParams.get("refresh");
  const refreshResultStatus = normalizeRefreshResultStatus(searchParams.get("resultStatus"));
  const refreshResult = formatResultStatus(refreshResultStatus);
  const refreshItemName = searchParams.get("resultName");
  const refreshItemKind = normalizeRefreshResultKind(searchParams.get("resultKind"));
  const refreshItemId = searchParams.get("resultId");
  const refreshBatchCount = Number(searchParams.get("batchCount") ?? "0");
  const refreshBatchSummary = searchParams.get("batchSummary");
  const refreshBatchIdList = useMemo(
    () =>
      (searchParams.get("batchIds") ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    [searchParams],
  );
  const refreshBatchIds = useMemo(
    () => new Set(refreshBatchIdList),
    [refreshBatchIdList],
  );
  const refreshBatchSummaryLabel = buildProjectDetailRefreshBatchSummaryLabel({
    refreshSource,
    refreshBatchCount,
    refreshBatchSummary,
  });
  const adjustedWorkspaceSummary = useMemo(
    () =>
      state
        ? buildAdjustedWorkspaceSummary(state.workspace, refreshItemKind, refreshResultStatus)
        : null,
    [refreshItemKind, refreshResultStatus, state],
  );
  const refreshBatchEntries = projectId
    ? buildProcessingRefreshBatchEntries({
        projectId,
        refreshItemKind,
        refreshResultStatus,
        refreshBatchIds: refreshBatchIdList,
        refreshBatchSummary,
      })
    : [];
  const isRefreshedActivitySelected = (item: AuditLogRecord) =>
    (refreshItemId === item.resourceId || refreshBatchIds.has(item.resourceId)) &&
    matchesRefreshResourceType(refreshItemKind, item.resourceType);

  async function loadProjectDetail() {
    if (!projectId) {
      setError("项目标识缺失，无法加载详情。");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [workspace, recentActivity, providerTelemetry] = await Promise.all([
        apiClient.getProjectWorkspace(projectId),
        apiClient.listProjectAuditLogs(projectId, { limit: 8 }),
        apiClient
          .getAiProviderTelemetrySummary(projectId, { limit: 20 })
          .catch(() => emptyProviderTelemetrySummary),
      ]);
      setState({
        workspace,
        recentActivity: recentActivity.items,
        providerTelemetry,
      });
      setSelectedBillVersionId((current) =>
        current ?? pickInitialBillVersionId(workspace.billVersions),
      );
    } catch (fetchError) {
      setError(
        fetchError instanceof ApiError
          ? fetchError.message
          : "项目详情加载失败，请检查 API 连通性。",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProjectDetail();
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !selectedBillVersionId) {
      setSelectedSummary(null);
      return;
    }

    let active = true;

    void apiClient
      .getSummary(projectId, { billVersionId: selectedBillVersionId })
      .then((summary) => {
        if (active) {
          setSelectedSummary(summary);
        }
      })
      .catch(() => {
        if (active) {
          setSelectedSummary(null);
        }
      });

    return () => {
      active = false;
    };
  }, [projectId, selectedBillVersionId]);

  useEffect(() => {
    const rawFailureReason = searchParams.get("failureReason");
    if (!rawFailureReason || rawFailureReason === failureReason) {
      return;
    }

    const next = new URLSearchParams(searchParams);
    next.delete("failureReason");
    next.delete("failureResourceType");
    next.delete("failureAction");
    setSearchParams(next, { replace: true });
  }, [failureReason, searchParams, setSearchParams]);

  useEffect(() => {
    if (failureReason) {
      return;
    }

    if (!searchParams.get("failureResourceType") && !searchParams.get("failureAction")) {
      return;
    }

    const next = new URLSearchParams(searchParams);
    next.delete("failureResourceType");
    next.delete("failureAction");
    setSearchParams(next, { replace: true });
  }, [failureReason, searchParams, setSearchParams]);

  useEffect(() => {
    setCopyMessage(null);
    setCopiedLinkPath(null);
  }, [failureReason]);

  useEffect(() => {
    setRecentCopiedLink(readRecentProcessingLink(projectId));
  }, [projectId]);

  useEffect(() => {
    if (!copyMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCopyMessage(null);
    }, 2500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [copyMessage]);

  useEffect(() => {
    if (!activityCopyMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setActivityCopyMessage(null);
      setActivityCopiedLinkPath(null);
    }, 2500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activityCopyMessage]);

  async function copyCurrentCollaborationLink() {
    if (typeof window === "undefined" || !window.navigator?.clipboard?.writeText) {
      setError("当前环境不支持复制链接，请手动复制地址栏。");
      return;
    }

    try {
      const url = new URL(window.location.href);
      url.search = searchParams.toString();
      await window.navigator.clipboard.writeText(url.toString());
      const copiedPath = `/projects/${projectId}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
      setCopyMessage("已复制当前协作链接，可直接发给协作同事。");
      setCopiedLinkPath(copiedPath);
      setRecentCopiedLink(
        saveRecentProcessingLink({
          projectId: projectId ?? "",
          path: copiedPath,
          label: "项目工作台协作视角",
          collaborationUnitLabel: failureCollaborationUnitLabel,
          sourceLabel: "项目工作台",
        }),
      );
      setError(null);
    } catch {
      setError("协作链接复制失败，请稍后重试。");
    }
  }

  function clearCollaborationView() {
    const next = new URLSearchParams(searchParams);
    next.delete("failureReason");
    next.delete("failureResourceType");
    next.delete("failureAction");
    setSearchParams(next);
  }

  function dismissRefreshNotice() {
    if (projectId && refreshBatchSummaryLabel && refreshSource) {
      const currentPath = `/projects/${projectId}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
      setRecentCopiedLink(
        saveRecentProcessingLink({
          projectId,
          path: currentPath,
          label: refreshBatchSummaryLabel,
          sourceLabel: "项目工作台",
          actionType: "batch-refresh",
          batchEntries: refreshBatchEntries,
        }),
      );
    }

    setSearchParams(clearRefreshState(searchParams), { replace: true });
  }

  async function copyActivityLink(path: string, resourceLabel: string) {
    if (typeof window === "undefined" || !window.navigator?.clipboard?.writeText) {
      setError("当前环境不支持复制链接，请手动复制地址栏。");
      return;
    }

    try {
      await window.navigator.clipboard.writeText(buildAbsoluteAppUrl(path));
      setActivityCopyMessage(`已复制${resourceLabel}处理链接，可直接发给协作同事。`);
      setActivityCopiedLinkPath(path);
      setRecentCopiedLink(
        saveRecentProcessingLink({
          projectId: projectId ?? "",
          path,
          label: `${resourceLabel}处理入口`,
          sourceLabel: "项目工作台",
        }),
      );
      setError(null);
    } catch {
      setError("处理链接复制失败，请稍后重试。");
    }
  }

  async function runBillVersionAction(input: {
    billVersionId: string;
    title: string;
    action: "lock" | "unlock";
  }) {
    if (!projectId) {
      return;
    }

    setVersionActionTargetId(input.billVersionId);
    setVersionActionMessage(null);
    setVersionActionError(null);

    try {
      if (input.action === "lock") {
        await apiClient.lockBillVersion(projectId, input.billVersionId);
        setVersionActionMessage(`${input.title} 已锁定。`);
      } else {
        await apiClient.unlockBillVersion(
          projectId,
          input.billVersionId,
          "项目工作台解锁",
        );
        setVersionActionMessage(`${input.title} 已解锁。`);
      }
      await loadProjectDetail();
    } catch (actionError) {
      setVersionActionError(
        actionError instanceof ApiError
          ? actionError.message
          : "清单版本状态更新失败，请稍后重试。",
      );
    } finally {
      setVersionActionTargetId(null);
    }
  }

  async function refreshRuntimeDiagnostics() {
    if (!projectId) {
      return;
    }

    setRuntimeDiagnostics((current) => ({
      ...current,
      loading: true,
      message: null,
    }));

    try {
      const [apiHealth, providerHealth, jobs, providerTelemetry] =
        await Promise.all([
          apiClient.getApiHealth(),
          apiClient.getAiProviderHealth(),
          apiClient.listBackgroundJobs(projectId),
          apiClient.getAiProviderTelemetrySummary(projectId, { limit: 20 }),
        ]);

      setRuntimeDiagnostics({
        apiHealth,
        providerHealth,
        jobsSummary: jobs.summary,
        providerTelemetry,
        loading: false,
        message: "运行诊断已刷新。",
      });
    } catch (diagnosticsError) {
      setRuntimeDiagnostics((current) => ({
        ...current,
        loading: false,
        message:
          diagnosticsError instanceof ApiError
            ? formatRuntimeDiagnosticsError(diagnosticsError)
            : "运行诊断刷新失败。",
      }));
    }
  }

  if (loading) {
    return <LoadingState title="正在加载项目详情" />;
  }

  if (error) {
    return (
      <ErrorState
        body={error}
        onRetry={() => {
          void loadProjectDetail();
        }}
      />
    );
  }

  if (!state) {
    return (
      <EmptyState
        title="项目详情为空"
        body="还没有拿到项目详情数据，请稍后重试。"
      />
    );
  }

  const { workspace } = state;
  const permissionSummary = workspace.currentUser.permissionSummary;
  const navigation =
    selectedBillVersion && projectId
      ? buildProjectDetailNavigation({
          projectId,
          billVersionId: selectedBillVersion.id,
        })
      : null;
  const versionCards = projectId
    ? buildProjectVersionCards({
        projectId,
        selectedBillVersionId,
        versions: workspace.billVersions,
        canEditProject: permissionSummary.canEditProject,
      })
    : [];
  const dashboardCards =
    selectedBillVersion && selectedSummary
      ? buildProjectDashboardSummary({
          project: workspace.project,
          selectedBillVersion,
          summary: selectedSummary,
          currentStage: workspace.currentStage,
          permissionSummary: workspace.currentUser.permissionSummary,
        })
      : null;
  const permissionHighlights = [
    `角色：${permissionSummary.roleLabel}`,
    permissionSummary.canManageProject ? "可管理项目" : "不可管理项目",
    permissionSummary.canEditProject ? "可编辑授权范围" : "仅可查看授权范围",
  ];
  const importLatestTask = workspace.importStatus.latestTask;
  const providerTelemetry = state.providerTelemetry;
  const refreshNotice = buildProjectDetailRefreshNotice({
    refreshSource,
    refreshItemName,
    refreshResult,
    refreshBatchCount,
    refreshBatchSummary,
  });

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="app-eyebrow">{workspace.project.code}</p>
          <h2 className="page-title">{workspace.project.name}</h2>
          <p className="page-description">
            当前状态 {workspace.project.status}。
            {workspace.currentStage
              ? ` 当前阶段 ${workspace.currentStage.stageName}。`
              : " 当前还没有阶段配置。"}
          </p>
        </div>
      </header>

      {refreshNotice ? (
        <section className="panel panel-focus">
          <h3>刷新提示</h3>
          <p className="page-description">{refreshNotice}</p>
          {refreshBatchEntries.length > 0 ? (
            <>
              <p className="page-description">本轮处理对象</p>
              <ul className="inline-list">
                {refreshBatchEntries.map((entry) => (
                  <li key={entry.id}>
                    <Link className="breadcrumbs-link" to={entry.path}>
                      {entry.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <div className="version-card-actions">
            <button
              className="connection-button secondary"
              onClick={dismissRefreshNotice}
              type="button"
            >
              收起提示
            </button>
          </div>
        </section>
      ) : null}

      <section className="stat-grid">
        {dashboardCards ? (
          dashboardCards.map((card) => (
            <article className="stat-card" key={card.label}>
              <p className="stat-label">{card.label}</p>
              <p className="stat-value">{card.value}</p>
              <p className="page-description">{card.helper}</p>
            </article>
          ))
        ) : (
          <>
            <article className="stat-card">
              <p className="stat-label">阶段数量</p>
              <p className="stat-value">{workspace.availableStages.length}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">专业数量</p>
              <p className="stat-value">{workspace.disciplines.length}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">清单版本</p>
              <p className="stat-value">{workspace.billVersions.length}</p>
            </article>
          </>
        )}
      </section>

      <section className="detail-grid">
        <article className="panel">
          <h3>运行诊断</h3>
          <p className="page-description">
            API{" "}
            {runtimeDiagnostics.apiHealth
              ? formatApiHealth(runtimeDiagnostics.apiHealth)
              : "未刷新"}{" "}
            · Provider{" "}
            {runtimeDiagnostics.providerHealth
              ? formatProviderHealth(runtimeDiagnostics.providerHealth)
              : "未刷新"}
          </p>
          {runtimeDiagnostics.jobsSummary ? (
            <p className="page-description">
              Worker 任务 {runtimeDiagnostics.jobsSummary.totalCount} 个 · 失败{" "}
              {runtimeDiagnostics.jobsSummary.statusCounts.failed ?? 0} · 报表导出{" "}
              {runtimeDiagnostics.jobsSummary.jobTypeCounts.report_export ?? 0} · 项目重算{" "}
              {runtimeDiagnostics.jobsSummary.jobTypeCounts.project_recalculate ?? 0} · AI 推荐{" "}
              {runtimeDiagnostics.jobsSummary.jobTypeCounts.ai_recommendation ?? 0}
            </p>
          ) : null}
          {runtimeDiagnostics.providerTelemetry ? (
            <p className="page-description">
              Provider 任务 {runtimeDiagnostics.providerTelemetry.totalCount} 个 · 失败{" "}
              {runtimeDiagnostics.providerTelemetry.failureCount} · 连续失败{" "}
              {runtimeDiagnostics.providerTelemetry.consecutiveFailureCount}
            </p>
          ) : null}
          {runtimeDiagnostics.providerTelemetry?.alerts.slice(0, 2).map((alert) => (
            <p className="recommendation-expired" key={alert}>
              {alert}
            </p>
          ))}
          {runtimeDiagnostics.message ? (
            <p className="page-description">{runtimeDiagnostics.message}</p>
          ) : null}
          <div className="version-card-actions">
            <button
              className="connection-button secondary"
              disabled={runtimeDiagnostics.loading}
              onClick={() => {
                void refreshRuntimeDiagnostics();
              }}
              type="button"
            >
              {runtimeDiagnostics.loading ? "刷新中" : "刷新运行诊断"}
            </button>
            <Link className="breadcrumbs-link" to={`/projects/${projectId}/jobs`}>
              查看任务状态
            </Link>
            <Link className="breadcrumbs-link" to={`/projects/${projectId}/ai-recommendations`}>
              查看 Provider 诊断
            </Link>
          </div>
        </article>
        <article
          className={
            refreshItemKind === "review" ? "panel panel-focus" : "panel"
          }
        >
          <h3>阶段工作台</h3>
          {workspace.currentStage ? (
            <p className="page-description">
              当前阶段：{workspace.currentStage.stageName} ·{" "}
              {workspace.currentStage.stageCode}
            </p>
          ) : null}
          <ul className="inline-list">
            {workspace.availableStages.map((stage) => (
              <li key={stage.id}>
                {stage.stageName} · {stage.stageCode} · {stage.status}
              </li>
            ))}
          </ul>
        </article>
        <article
          className={
            refreshItemKind === "process-document" ? "panel panel-focus" : "panel"
          }
        >
          <h3>专业</h3>
          <ul className="inline-list">
            {workspace.disciplines.map((discipline) => (
              <li key={discipline.id}>
                {discipline.disciplineName} · {discipline.disciplineCode}
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="detail-grid">
        <article
          className={
            refreshItemKind === "review" || refreshItemKind === "process-document"
              ? "panel panel-focus"
              : "panel"
          }
        >
          <h3>待办摘要</h3>
          <p className="page-description">
            共 {adjustedWorkspaceSummary?.todoSummary.totalCount ?? workspace.todoSummary.totalCount}{" "}
            项待办
          </p>
          <p className="page-description">
            <Link className="breadcrumbs-link" to={`/projects/${projectId}/inbox?focus=todo`}>
              打开待办页
            </Link>
          </p>
          <ul className="inline-list">
            {(adjustedWorkspaceSummary?.todoSummary.items ?? workspace.todoSummary.items).map((item) => (
              <li key={item}>
                {buildSummaryItemPath(projectId!, item) ? (
                  <Link
                    className="breadcrumbs-link"
                    to={buildSummaryItemPath(projectId!, item) ?? "#"}
                  >
                    {item}
                  </Link>
                ) : (
                  item
                )}
              </li>
            ))}
          </ul>
        </article>
        <article className="panel">
          <h3>风险摘要</h3>
          <p className="page-description">
            共 {adjustedWorkspaceSummary?.riskSummary.totalCount ?? workspace.riskSummary.totalCount}{" "}
            项风险
          </p>
          <p className="page-description">
            <Link className="breadcrumbs-link" to={`/projects/${projectId}/inbox?focus=risk`}>
              打开风险跟进
            </Link>
          </p>
          <ul className="inline-list">
            {(adjustedWorkspaceSummary?.riskSummary.items ?? workspace.riskSummary.items).map((item) => (
              <li key={item}>
                {buildSummaryItemPath(projectId!, item) ? (
                  <Link
                    className="breadcrumbs-link"
                    to={buildSummaryItemPath(projectId!, item) ?? "#"}
                  >
                    {item}
                  </Link>
                ) : (
                  item
                )}
              </li>
            ))}
          </ul>
        </article>
        <article className="panel">
          <h3>导入状态</h3>
          <p className="page-description">
            队列 {workspace.importStatus.queuedCount} · 处理中{" "}
            {workspace.importStatus.processingCount} · 失败{" "}
            {workspace.importStatus.failedCount} · 已完成{" "}
            {workspace.importStatus.completedCount}
          </p>
          {failureReasonLabel ? (
            <p className="page-description">
              当前协作视角：{failureReasonLabel}
            </p>
          ) : null}
          {failureCollaborationUnitLabel ? (
            <p className="page-description">
              当前协作处理单元：{failureCollaborationUnitLabel}
            </p>
          ) : null}
          {failureReasonLabel ? (
            <div className="connection-actions">
              <button
                className="connection-button secondary"
                onClick={() => {
                  void copyCurrentCollaborationLink();
                }}
                type="button"
              >
                复制当前协作链接
              </button>
              <button
                className="connection-button secondary"
                onClick={() => {
                  clearCollaborationView();
                }}
                type="button"
              >
                清除协作视角
              </button>
            </div>
          ) : null}
          {copyMessage ? (
            <div className="version-card-actions">
              <p className="page-description">{copyMessage}</p>
              {copiedLinkPath ? (
                <Link className="breadcrumbs-link" to={copiedLinkPath}>
                  打开刚复制入口
                </Link>
              ) : null}
            </div>
          ) : null}
          {!copyMessage && recentCopiedLink ? (
            <RecentProcessingSummaryCard
              formatDateTime={formatProjectDateTime}
              link={recentCopiedLink}
              onClear={() => {
                clearRecentProcessingLink();
                setRecentCopiedLink(null);
              }}
            />
          ) : null}
          <div className="version-card-actions">
            <Link
              className="breadcrumbs-link"
              to={(() => {
                const next = new URLSearchParams();
                if (failureReason) {
                  next.set("status", "failed");
                  appendFailureCollaborationParams(next, {
                    failureReason,
                    failureResourceType,
                    failureAction,
                  });
                }
                return `/projects/${projectId}/jobs${next.toString() ? `?${next.toString()}` : ""}`;
              })()}
            >
              打开任务状态
            </Link>
            <Link
              className="breadcrumbs-link"
              to={(() => {
                const next = new URLSearchParams();
                next.set("focus", "import");
                appendFailureCollaborationParams(next, {
                  failureReason,
                  failureResourceType,
                  failureAction,
                });
                return `/projects/${projectId}/inbox?${next.toString()}`;
              })()}
            >
              打开导入跟进
            </Link>
          </div>
          <ul className="inline-list">
            <li>{workspace.importStatus.note}</li>
            {importLatestTask ? (
              <li>
                最近导入：{importLatestTask.sourceLabel} · {importLatestTask.status}
              </li>
            ) : (
              <li>当前没有导入任务记录</li>
            )}
          </ul>
        </article>
      </section>

      <section className="detail-grid">
        <article className="panel">
          <h3>当前用户权限</h3>
          <p className="page-description">
            {workspace.currentUser.displayName} · {permissionSummary.roleCode}
          </p>
          <ul className="inline-list">
            {permissionHighlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="page-description">范围摘要</p>
          <ul className="inline-list">
            {permissionSummary.scopeSummary.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="page-description">可见阶段</p>
          <ul className="inline-list">
            {(permissionSummary.visibleStageCodes.length > 0
              ? permissionSummary.visibleStageCodes
              : ["未授权阶段"]).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="page-description">可见专业</p>
          <ul className="inline-list">
            {(permissionSummary.visibleDisciplineCodes.length > 0
              ? permissionSummary.visibleDisciplineCodes
              : ["未授权专业"]).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article
          className={
            refreshItemKind === "review" || refreshItemKind === "process-document"
              ? "panel panel-focus"
              : "panel"
          }
        >
          <h3>最近动态</h3>
          <p className="page-description">最近 8 条项目操作时间线</p>
          <p className="page-description">
            <Link className="breadcrumbs-link" to={`/projects/${projectId}/audit-logs`}>
              查看全部审计日志
            </Link>
          </p>
          {activityCopyMessage ? (
            <div className="version-card-actions">
              <p className="page-description">{activityCopyMessage}</p>
              {activityCopiedLinkPath ? (
                <Link className="breadcrumbs-link" to={activityCopiedLinkPath}>
                  打开刚复制入口
                </Link>
              ) : null}
            </div>
          ) : null}
          {state.recentActivity.length > 0 ? (
            <div className="activity-list">
              {state.recentActivity.map((item) => (
                (() => {
                  const activityPath = buildActivityPath(
                    projectId ?? "",
                    item,
                    failureReason,
                    failureResourceType,
                    failureAction,
                  );
                  const resourceLabel = formatResourceType(item.resourceType);
                  const content = (
                    <>
                      <p className="activity-title">
                        {formatResourceType(item.resourceType)} · {formatAction(item.action)}
                      </p>
                      <p className="page-description">
                        操作人 {item.operatorId}
                        {item.stageCode ? ` · 阶段 ${item.stageCode}` : ""} ·{" "}
                        {formatProjectDateTime(item.createdAt)}
                      </p>
                      <p className="page-description">资源 {item.resourceId}</p>
                    </>
                  );

                  if (activityPath) {
                    return (
                      <article
                        className={
                          isRefreshedActivitySelected(item)
                            ? "activity-item selected"
                            : "activity-item"
                        }
                        key={item.id}
                      >
                        <Link
                          className={
                            isRefreshedActivitySelected(item)
                              ? "activity-item selected"
                              : "activity-item"
                          }
                          to={activityPath}
                        >
                          {content}
                        </Link>
                        <div className="version-card-actions">
                          <button
                            className="connection-button secondary"
                            onClick={() => {
                              void copyActivityLink(activityPath, resourceLabel);
                            }}
                            type="button"
                          >
                            {`复制${resourceLabel}处理链接`}
                          </button>
                        </div>
                      </article>
                    );
                  }

                  return (
                    <article
                      className={
                        isRefreshedActivitySelected(item)
                          ? "activity-item selected"
                          : "activity-item"
                      }
                      key={item.id}
                    >
                      {content}
                    </article>
                  );
                })()
              ))}
            </div>
          ) : (
            <EmptyState title="还没有最近动态" body="当前项目还没有可展示的操作记录。" />
          )}
        </article>
        <article className="panel">
          <h3>版本工作台</h3>
          {versionActionMessage ? (
            <p className="page-description">{versionActionMessage}</p>
          ) : null}
          {versionActionError ? (
            <p className="page-description">{versionActionError}</p>
          ) : null}
          {workspace.billVersions.length > 0 ? (
            <div className="project-list">
              {versionCards.map((card) => (
                <article
                  className={card.isSelected ? "project-link selected" : "project-link"}
                  key={card.id}
                >
                  <div className="version-card-header">
                    <div>
                      <h3>{card.title}</h3>
                      <p className="page-description">{card.subtitle}</p>
                    </div>
                    <span className="version-status-chip">{card.statusLabel}</span>
                  </div>
                  <p className="page-description">{card.itemCountLabel}</p>
                  <div className="version-card-actions">
                    <button
                      className="connection-button secondary"
                      onClick={() => {
                        setSelectedBillVersionId(card.id);
                      }}
                      type="button"
                    >
                      {card.isSelected ? "当前已选" : "设为当前版本"}
                    </button>
                    <Link className="app-nav-link active" to={card.billItemsPath}>
                      清单页
                    </Link>
                    <Link className="app-nav-link active" to={card.summaryPath}>
                      汇总页
                    </Link>
                    {card.canLock ? (
                      <button
                        className="connection-button secondary"
                        disabled={versionActionTargetId === card.id}
                        onClick={() => {
                          void runBillVersionAction({
                            billVersionId: card.id,
                            title: card.title,
                            action: "lock",
                          });
                        }}
                        type="button"
                      >
                        {versionActionTargetId === card.id ? "锁定中" : "锁定版本"}
                      </button>
                    ) : null}
                    {card.canUnlock ? (
                      <button
                        className="connection-button secondary"
                        disabled={versionActionTargetId === card.id}
                        onClick={() => {
                          void runBillVersionAction({
                            billVersionId: card.id,
                            title: card.title,
                            action: "unlock",
                          });
                        }}
                        type="button"
                      >
                        {versionActionTargetId === card.id ? "解锁中" : "解锁版本"}
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="还没有清单版本"
              body="等项目创建出 bill version 后，这里会出现版本摘要卡片。"
            />
          )}
        </article>
        <article className="panel">
          <h3>下一步导航</h3>
          {selectedBillVersion && navigation ? (
            <div className="project-list">
              <BillVersionSelector
                label="当前版本"
                onChange={(billVersionId) => {
                  setSelectedBillVersionId(billVersionId);
                }}
                selectedVersionId={selectedBillVersion.id}
                versions={workspace.billVersions}
              />
              <Link className="project-link" to={navigation.billItemsPath}>
                <h3>进入清单页</h3>
                <p className="page-description">
                  当前版本：{selectedBillVersion.versionName}
                </p>
              </Link>
              <Link className="project-link" to={navigation.summaryPath}>
                <h3>查看汇总页</h3>
                <p className="page-description">
                  当前版本汇总、系统值、最终值与偏差摘要
                </p>
              </Link>
              <Link className="project-link" to={navigation.auditLogsPath}>
                <h3>查看审计日志</h3>
                <p className="page-description">
                  按资源、动作、操作人和时间追溯项目关键变更
                </p>
              </Link>
              <Link className="project-link" to={navigation.knowledgePath}>
                <h3>查看知识与记忆</h3>
                <p className="page-description">
                  查看 AI 抽取的项目经验、风险提示和长期偏好
                </p>
              </Link>
              <Link className="project-link" to={navigation.aiRecommendationsPath}>
                <h3>Provider 诊断</h3>
                <p className="page-description">
                  最近 Provider 任务 {providerTelemetry?.totalCount ?? 0} 个 · 成功{" "}
                  {providerTelemetry?.successCount ?? 0} · 失败{" "}
                  {providerTelemetry?.failureCount ?? 0}
                  {providerTelemetry?.p95DurationMs === null ||
                  providerTelemetry?.p95DurationMs === undefined
                    ? ""
                    : ` · P95 ${providerTelemetry.p95DurationMs}ms`}
                  {providerTelemetry?.consecutiveFailureCount
                    ? ` · 连续失败 ${providerTelemetry.consecutiveFailureCount}`
                    : ""}
                </p>
                {providerTelemetry?.alerts.slice(0, 2).map((alert) => (
                  <p className="recommendation-expired" key={alert}>
                    {alert}
                  </p>
                ))}
                <p className="page-description">
                  进入 AI 推荐页检查 Provider 连通性并处理清单推荐、定额推荐和偏差预警
                </p>
              </Link>
            </div>
          ) : (
            <EmptyState
              title="还没有清单版本"
              body="等项目创建出 bill version 后，这里就能进入清单页和汇总页。"
            />
          )}
        </article>
      </section>
    </div>
  );
}

function formatApiHealth(health: ApiHealthResponse) {
  const service = health.service ?? "@saas-pricing/api";
  const status = health.status ?? (health.ok ? "up" : "down");
  return `${service} · ${status}`;
}

function formatProviderHealth(health: AiProviderHealthResponse) {
  const configured = health.configured ? "已配置" : "未配置";
  const status = health.healthy ? "健康" : "异常";
  return `${configured} · ${status}${health.message ? ` · ${health.message}` : ""}`;
}

function formatRuntimeDiagnosticsError(error: ApiError) {
  if (!error.details || typeof error.details !== "object") {
    return error.message;
  }
  return `${error.message}。原始错误：${JSON.stringify(error.details)}`;
}
