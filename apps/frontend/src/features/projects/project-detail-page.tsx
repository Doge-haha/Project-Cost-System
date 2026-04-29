import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import readXlsxFile from "read-excel-file/browser";

import { apiClient, ApiError } from "../../lib/api";
import type {
  AuditLogRecord,
  BillVersion,
  ProjectWorkspace,
  SourceBillFailureItem,
  SourceBillImportPreview,
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
};

type ParsedSourceBillFile = {
  fileName: string;
  sourceTables: {
    ZaoJia_Qd_QdList: Array<Record<string, unknown>>;
    ZaoJia_Qd_Qdxm: Array<Record<string, unknown>>;
    ZaoJia_Qd_Gznr: Array<Record<string, unknown>>;
  };
};

type SourceBillImportStep = "idle" | "selected" | "previewed" | "imported";

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
  const [billImportMessage, setBillImportMessage] = useState<string | null>(null);
  const [billImportError, setBillImportError] = useState<string | null>(null);
  const [billImportRunning, setBillImportRunning] = useState(false);
  const [billImportPreviewRunning, setBillImportPreviewRunning] = useState(false);
  const [billImportStep, setBillImportStep] = useState<SourceBillImportStep>("idle");
  const [billImportPreview, setBillImportPreview] =
    useState<SourceBillImportPreview | null>(null);
  const [billImportFailedItems, setBillImportFailedItems] = useState<
    SourceBillFailureItem[]
  >([]);
  const [billImportFailureReasonFilter, setBillImportFailureReasonFilter] =
    useState<string | null>(null);
  const [selectedSourceBillFile, setSelectedSourceBillFile] =
    useState<ParsedSourceBillFile | null>(null);
  const [selectedBillVersionId, setSelectedBillVersionId] = useState<string | null>(
    null,
  );

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
      const [workspace, recentActivity] = await Promise.all([
        apiClient.getProjectWorkspace(projectId),
        apiClient.listProjectAuditLogs(projectId, { limit: 8 }),
      ]);
      setState({
        workspace,
        recentActivity: recentActivity.items,
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

  function getSourceBillImportContext() {
    if (!state) {
      return null;
    }

    const stageCode =
      selectedBillVersion?.stageCode ??
      state.workspace.currentStage?.stageCode ??
      state.workspace.availableStages[0]?.stageCode;
    const disciplineCode =
      selectedBillVersion?.disciplineCode ??
      state.workspace.disciplines[0]?.disciplineCode;

    if (!stageCode || !disciplineCode) {
      return null;
    }

    return {
      stageCode,
      disciplineCode,
    };
  }

  async function readSourceBillFile(file: File) {
    setBillImportMessage(null);
    setBillImportError(null);
    setBillImportPreview(null);
    setBillImportFailedItems([]);
    setBillImportFailureReasonFilter(null);
    setBillImportStep("idle");

    try {
      const parsed = await parseSourceBillFile(file);
      setSelectedSourceBillFile(parsed);
      setBillImportStep("selected");
      setBillImportMessage(
        `已选择 ${parsed.fileName}，请先预览确认。`,
      );
    } catch (parseError) {
      setSelectedSourceBillFile(null);
      setBillImportError(
        parseError instanceof Error ? parseError.message : "源清单文件解析失败。",
      );
    }
  }

  async function previewSourceBillImport() {
    if (!projectId || !selectedSourceBillFile) {
      return;
    }

    const context = getSourceBillImportContext();
    if (!context) {
      setBillImportError("缺少可导入阶段或专业。");
      return;
    }

    setBillImportPreviewRunning(true);
    setBillImportError(null);

    try {
      const preview = await apiClient.previewSourceBill({
        projectId,
        stageCode: context.stageCode,
        disciplineCode: context.disciplineCode,
        sourceFileName: selectedSourceBillFile.fileName,
        sourceTables: selectedSourceBillFile.sourceTables,
      });
      setBillImportPreview(preview);
      setBillImportFailedItems(preview.failedItems);
      setBillImportStep("previewed");
      setBillImportMessage(
        `预览完成：版本 ${preview.summary.versionCount}，清单项 ${preview.summary.billItemCount}，工作内容 ${preview.summary.workItemCount}。`,
      );
    } catch (previewError) {
      setBillImportError(
        previewError instanceof ApiError
          ? previewError.message
          : "源清单预览失败，请稍后重试。",
      );
    } finally {
      setBillImportPreviewRunning(false);
    }
  }

  async function runSourceBillImport() {
    if (!projectId || !state) {
      return;
    }

    const context = getSourceBillImportContext();
    if (!context) {
      setBillImportError("缺少可导入阶段或专业。");
      return;
    }
    if (!selectedSourceBillFile) {
      setBillImportError("请先选择源清单文件。");
      return;
    }
    if (billImportStep !== "previewed" || !billImportPreview) {
      setBillImportError("请先完成导入预览并确认数量后再落库。");
      return;
    }

    setBillImportRunning(true);
    setBillImportError(null);

    try {
      const result = await apiClient.importSourceBill({
        projectId,
        stageCode: context.stageCode,
        disciplineCode: context.disciplineCode,
        sourceFileName: selectedSourceBillFile.fileName,
        sourceTables: selectedSourceBillFile.sourceTables,
      });
      setBillImportMessage(
        `导入${result.importTask.status === "completed" ? "完成" : "失败"}：清单项 ${result.summary.billItemCount}，工作内容 ${result.summary.workItemCount}，失败 ${result.summary.failedItemCount}`,
      );
      setBillImportStep("imported");
      setBillImportPreview({
        summary: result.summary,
        failedItems: result.failedItems ?? [],
      });
      setBillImportFailedItems(result.failedItems ?? []);
      setBillImportError(result.summary.failureDetails.join("\n") || null);
      setSelectedBillVersionId(result.billVersion.id);
      await loadProjectDetail();
    } catch (importError) {
      setBillImportError(
        importError instanceof ApiError
          ? importError.message
          : "源清单导入失败，请稍后重试。",
      );
    } finally {
      setBillImportRunning(false);
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
  const canImportBill = permissionSummary.canImportBill ?? permissionSummary.canEditProject;
  const importLatestTask = workspace.importStatus.latestTask;
  const sourceBillFailureSummary = buildSourceBillFailureSummary(billImportFailedItems);
  const filteredSourceBillFailures = billImportFailureReasonFilter
    ? billImportFailedItems.filter(
        (item) => item.reasonCode === billImportFailureReasonFilter,
      )
    : billImportFailedItems;
  const sourceBillRepairTemplateHref = buildSourceBillRepairTemplateHref(
    filteredSourceBillFailures,
  );
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
            {canImportBill ? (
              <>
                <label className="connection-button secondary">
                  选择源清单文件
                  <input
                    accept=".json,.csv,.xlsx,.xls,application/json,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    aria-label="选择源清单文件"
                    className="visually-hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void readSourceBillFile(file);
                      }
                    }}
                    type="file"
                  />
                </label>
                <button
                  className="connection-button secondary"
                  disabled={
                    billImportPreviewRunning ||
                    billImportRunning ||
                    !selectedSourceBillFile
                  }
                  onClick={() => {
                    void previewSourceBillImport();
                  }}
                  type="button"
                >
                  {billImportPreviewRunning ? "预览中" : "预览导入"}
                </button>
                <button
                  className="connection-button secondary"
                  disabled={
                    billImportRunning ||
                    !selectedSourceBillFile ||
                    billImportStep !== "previewed"
                  }
                  onClick={() => {
                    void runSourceBillImport();
                  }}
                  type="button"
                >
                  {billImportRunning ? "导入中" : "确认导入"}
                </button>
              </>
            ) : null}
          </div>
          {billImportPreview ? (
            <div className="project-list">
              <article className="project-link selected">
                <h3>源清单导入预览</h3>
                <p className="page-description">
                  文件 {selectedSourceBillFile?.fileName ?? "未选择"} · 状态{" "}
                  {billImportStep === "imported" ? "已导入" : "待确认"}
                </p>
                <p className="page-description">
                  版本 {billImportPreview.summary.versionCount} · 清单项{" "}
                  {billImportPreview.summary.billItemCount} · 工作内容{" "}
                  {billImportPreview.summary.workItemCount} · 失败{" "}
                  {billImportPreview.summary.failedItemCount}
                </p>
                <p className="page-description">
                  措施项 {billImportPreview.summary.measureItemCount} · 费用项{" "}
                  {billImportPreview.summary.feeItemCount} · 清单特征{" "}
                  {billImportPreview.summary.featureItemCount} · 定额线索{" "}
                  {billImportPreview.summary.quotaClueCount}
                </p>
              </article>
            </div>
          ) : null}
          {sourceBillFailureSummary.length > 0 ? (
            <div className="project-list">
              <article className="project-link selected">
                <h3>源清单失败报告</h3>
                <p className="page-description">
                  当前范围：{billImportFailureReasonFilter ?? "全部"} ·{" "}
                  {filteredSourceBillFailures.length} 条
                </p>
                <p className="page-description">
                  <a
                    className="breadcrumbs-link"
                    download="source-bill-fix-template.csv"
                    href={sourceBillRepairTemplateHref}
                  >
                    下载修复模板
                  </a>
                </p>
                <div className="version-card-actions">
                  <button
                    className={
                      billImportFailureReasonFilter === null
                        ? "connection-button primary"
                        : "connection-button secondary"
                    }
                    onClick={() => {
                      setBillImportFailureReasonFilter(null);
                    }}
                    type="button"
                  >
                    全部
                  </button>
                  {sourceBillFailureSummary.map((item) => (
                    <button
                      className={
                        billImportFailureReasonFilter === item.reasonCode
                          ? "connection-button primary"
                          : "connection-button secondary"
                      }
                      key={item.reasonCode}
                      onClick={() => {
                        setBillImportFailureReasonFilter(item.reasonCode);
                      }}
                      type="button"
                    >
                      {item.reasonLabel} · {item.count}
                    </button>
                  ))}
                </div>
                <ul className="inline-list">
                  {filteredSourceBillFailures.slice(0, 20).map((item) => (
                    <li
                      key={`${item.tableName}-${item.lineNo ?? "line"}-${item.reasonCode}-${item.sourceId ?? item.itemCode ?? "row"}`}
                    >
                      {item.reasonLabel} · {item.tableName} 第 {item.lineNo ?? "-"} 行 ·{" "}
                      {item.itemCode ?? item.sourceId ?? "未识别"} · {item.errorMessage}
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          ) : null}
          {billImportMessage ? (
            <p className="page-description">{billImportMessage}</p>
          ) : null}
          {billImportError ? (
            <ul className="inline-list">
              {billImportError.split("\n").map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}
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
              <Link className="project-link" to={navigation.reportsPath}>
                <h3>打开报表中心</h3>
                <p className="page-description">
                  发起汇总/偏差/阶段清单导出，跟踪报表任务状态和下载结果
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
                <h3>查看 AI 推荐</h3>
                <p className="page-description">
                  处理清单推荐、定额推荐和偏差预警
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

async function parseSourceBillFile(file: File): Promise<ParsedSourceBillFile> {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
    return parseSourceBillWorkbook(file);
  }

  const content = await readTextFile(file);
  if (lowerName.endsWith(".csv")) {
    return {
      fileName: file.name,
      sourceTables: tablesFromNamedRows("ZaoJia_Qd_Qdxm", parseCsvRows(content)),
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("源清单文件必须是 JSON、CSV 或 Excel 格式。");
  }

  const root =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  const rawTables =
    root.sourceTables && typeof root.sourceTables === "object"
      ? (root.sourceTables as Record<string, unknown>)
      : root;
  const sourceTables = {
    ZaoJia_Qd_QdList: readRows(rawTables, ["ZaoJia_Qd_QdList", "qdList", "billLists"]),
    ZaoJia_Qd_Qdxm: readRows(rawTables, ["ZaoJia_Qd_Qdxm", "qdxm", "billItems", "items"]),
    ZaoJia_Qd_Gznr: readRows(rawTables, ["ZaoJia_Qd_Gznr", "gznr", "workItems", "workContents"]),
  };

  if (
    sourceTables.ZaoJia_Qd_QdList.length === 0 &&
    sourceTables.ZaoJia_Qd_Qdxm.length === 0 &&
    sourceTables.ZaoJia_Qd_Gznr.length === 0
  ) {
    throw new Error("源清单文件未包含可识别表：ZaoJia_Qd_QdList、ZaoJia_Qd_Qdxm、ZaoJia_Qd_Gznr。");
  }

  return {
    fileName: file.name,
    sourceTables,
  };
}

async function parseSourceBillWorkbook(file: File): Promise<ParsedSourceBillFile> {
  const content = await readArrayBufferFile(file);
  if (isLegacyXlsWorkbook(content)) {
    throw new Error(
      "暂不支持 Excel 97-2003 .xls 源清单文件，请先另存为 .xlsx、CSV 或 JSON 后再导入。",
    );
  }

  const sheets = await readXlsxFile(content);
  const tables = emptySourceTables();

  for (const sheet of sheets) {
    mergeSourceTables(tables, tablesFromNamedRows(sheet.sheet, rowsFromWorkbookCells(sheet.data)));
  }

  if (
    tables.ZaoJia_Qd_QdList.length === 0 &&
    tables.ZaoJia_Qd_Qdxm.length === 0 &&
    tables.ZaoJia_Qd_Gznr.length === 0
  ) {
    throw new Error("Excel 文件未包含可识别工作表或表头。");
  }

  return {
    fileName: file.name,
    sourceTables: tables,
  };
}

function rowsFromWorkbookCells(rows: unknown[][]): Array<Record<string, unknown>> {
  const headers = (rows[0] ?? []).map((header) => String(header ?? "").trim());
  return rows.slice(1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
  );
}

function isLegacyXlsWorkbook(content: ArrayBuffer) {
  const signature = new Uint8Array(content.slice(0, 8));
  const oleSignature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  return oleSignature.every((value, index) => signature[index] === value);
}

function emptySourceTables(): ParsedSourceBillFile["sourceTables"] {
  return {
    ZaoJia_Qd_QdList: [],
    ZaoJia_Qd_Qdxm: [],
    ZaoJia_Qd_Gznr: [],
  };
}

function mergeSourceTables(
  target: ParsedSourceBillFile["sourceTables"],
  source: ParsedSourceBillFile["sourceTables"],
) {
  target.ZaoJia_Qd_QdList.push(...source.ZaoJia_Qd_QdList);
  target.ZaoJia_Qd_Qdxm.push(...source.ZaoJia_Qd_Qdxm);
  target.ZaoJia_Qd_Gznr.push(...source.ZaoJia_Qd_Gznr);
}

function tablesFromNamedRows(
  tableName: string,
  rows: Array<Record<string, unknown>>,
): ParsedSourceBillFile["sourceTables"] {
  const normalizedName = tableName.toLowerCase();
  const tables = emptySourceTables();
  if (normalizedName.includes("qdlist") || normalizedName.includes("清单版本")) {
    tables.ZaoJia_Qd_QdList = rows;
  } else if (
    normalizedName.includes("gznr") ||
    normalizedName.includes("工作内容")
  ) {
    tables.ZaoJia_Qd_Gznr = rows;
  } else if (
    normalizedName.includes("qdxm") ||
    normalizedName.includes("清单项") ||
    normalizedName.includes("措施项") ||
    normalizedName.includes("费用项")
  ) {
    tables.ZaoJia_Qd_Qdxm = rows;
  } else if (rows.some((row) => readCell(row, ["Gznr", "gznr", "工作内容"]))) {
    tables.ZaoJia_Qd_Gznr = rows;
  } else if (rows.some((row) => readCell(row, ["Qdmc", "QdMc", "清单名称"]))) {
    tables.ZaoJia_Qd_QdList = rows;
  } else {
    tables.ZaoJia_Qd_Qdxm = rows;
  }
  return tables;
}

function parseCsvRows(content: string): Array<Record<string, unknown>> {
  const rows = parseCsv(content);
  const headers = rows[0]?.map((header) => header.trim()) ?? [];
  return rows.slice(1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
  );
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const nextChar = content[index + 1];
    if (char === '"' && quoted && nextChar === '"') {
      currentCell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      currentRow.push(currentCell);
      currentCell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
    } else {
      currentCell += char;
    }
  }

  currentRow.push(currentCell);
  rows.push(currentRow);
  return rows.filter((row) => row.some((cell) => cell.trim().length > 0));
}

function readCell(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

function readRows(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (Array.isArray(value)) {
      return value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      );
    }
  }
  return [];
}

function readTextFile(file: File): Promise<string> {
  if (typeof file.text === "function") {
    return file.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      resolve(String(reader.result ?? ""));
    });
    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error("源清单文件读取失败。"));
    });
    reader.readAsText(file);
  });
}

function readArrayBufferFile(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") {
    return file.arrayBuffer();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      resolve(reader.result as ArrayBuffer);
    });
    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error("源清单文件读取失败。"));
    });
    reader.readAsArrayBuffer(file);
  });
}

function buildSourceBillFailureSummary(items: SourceBillFailureItem[]) {
  const counts = new Map<string, { reasonCode: string; reasonLabel: string; count: number }>();
  for (const item of items) {
    const current = counts.get(item.reasonCode) ?? {
      reasonCode: item.reasonCode,
      reasonLabel: item.reasonLabel,
      count: 0,
    };
    current.count += 1;
    counts.set(item.reasonCode, current);
  }
  return [...counts.values()];
}

function buildSourceBillRepairTemplateHref(items: SourceBillFailureItem[]) {
  return `data:text/csv;charset=utf-8,${encodeURIComponent(
    buildSourceBillRepairTemplateCsv(items),
  )}`;
}

function buildSourceBillRepairTemplateCsv(items: SourceBillFailureItem[]) {
  const keyColumns = Array.from(new Set(items.flatMap((item) => item.keys ?? [])));
  const headers = [
    "tableName",
    "lineNo",
    "reasonCode",
    "reasonLabel",
    "sourceId",
    "itemCode",
    "errorMessage",
    ...keyColumns,
  ];
  const rows = items.map((item) =>
    headers.map((header) => {
      if ((item.keys ?? []).includes(header)) {
        return "";
      }
      return readSourceBillFailureTemplateValue(item, header);
    }),
  );
  return [headers, ...rows].map((row) => row.map(escapeCsvTemplateCell).join(",")).join("\n");
}

function readSourceBillFailureTemplateValue(
  item: SourceBillFailureItem,
  key: string,
) {
  switch (key) {
    case "tableName":
      return item.tableName ?? "";
    case "lineNo":
      return item.lineNo ?? "";
    case "reasonCode":
      return item.reasonCode;
    case "reasonLabel":
      return item.reasonLabel;
    case "sourceId":
      return item.sourceId ?? "";
    case "itemCode":
      return item.itemCode ?? "";
    case "errorMessage":
      return item.errorMessage;
    default:
      return "";
  }
}

function escapeCsvTemplateCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
