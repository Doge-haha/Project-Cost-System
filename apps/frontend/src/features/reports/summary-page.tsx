import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams, useParams } from "react-router-dom";

import { apiClient, ApiError } from "../../lib/api";
import type {
  AiRecommendation,
  BillVersion,
  ProjectListItem,
  ReportExportTask,
  SummaryDetailItem,
  SummaryResponse,
  VersionCompareResponse,
} from "../../lib/types";
import { EmptyState } from "../shared/empty-state";
import { ErrorState } from "../shared/error-state";
import { LoadingState } from "../shared/loading-state";
import { AppBreadcrumbs, buildProjectVersionBreadcrumbs } from "../shared/breadcrumbs";
import { BillVersionSelector } from "../shared/bill-version-selector";
import {
  buildSummaryPageContext,
  findSelectedBillVersion,
} from "./summary-page-context";
import {
  buildVersionCompareHighlights,
  buildVersionCompareTableRows,
  formatCompareVarianceTone,
} from "./summary-compare";
import { buildSummaryHighlights } from "./summary-highlights";

function formatMoney(value: number | string | null | undefined) {
  if (value === undefined || value === null || value === "") {
    return "-";
  }
  const normalized = Number(value);
  if (Number.isNaN(normalized)) {
    return String(value);
  }
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(normalized);
}

function formatExportStatus(status: ReportExportTask["status"]) {
  if (status === "completed") {
    return "已完成";
  }
  if (status === "failed") {
    return "失败";
  }
  if (status === "processing") {
    return "处理中";
  }
  return "排队中";
}

function formatReportType(reportType: ReportExportTask["reportType"]) {
  return reportType === "variance" ? "偏差明细" : "汇总";
}

function formatPayloadText(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function SummaryPage() {
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = params.projectId;
  const billVersionId = searchParams.get("billVersionId") ?? undefined;
  const taxModeParam = searchParams.get("taxMode");
  const taxMode =
    taxModeParam === "tax_included" || taxModeParam === "tax_excluded"
      ? taxModeParam
      : undefined;
  const compareBaseBillVersionId =
    searchParams.get("compareBaseBillVersionId") ?? undefined;
  const compareTargetBillVersionId =
    searchParams.get("compareTargetBillVersionId") ?? billVersionId;
  const [project, setProject] = useState<ProjectListItem | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [details, setDetails] = useState<SummaryDetailItem[]>([]);
  const [versions, setVersions] = useState<BillVersion[]>([]);
  const [versionCompare, setVersionCompare] = useState<VersionCompareResponse | null>(
    null,
  );
  const [aiVarianceWarnings, setAiVarianceWarnings] = useState<AiRecommendation[]>([]);
  const [canExportReports, setCanExportReports] = useState(false);
  const [exportTask, setExportTask] = useState<ReportExportTask | null>(null);
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportingReportType, setExportingReportType] = useState<
    ReportExportTask["reportType"] | null
  >(null);
  const [refreshingExportTask, setRefreshingExportTask] = useState(false);
  const [downloadingExportTask, setDownloadingExportTask] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const selectedVersion = useMemo(
    () => findSelectedBillVersion(versions, billVersionId),
    [billVersionId, versions],
  );

  async function loadSummary() {
    if (!projectId) {
      setError("项目标识缺失，无法加载汇总页。");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [
        projectResponse,
        summaryResponse,
        detailsResponse,
        versionsResponse,
        workspaceResponse,
        aiVarianceWarningsResponse,
      ] =
        await Promise.all([
          apiClient.getProject(projectId),
          apiClient.getSummary(projectId, billVersionId, taxMode),
          apiClient.getSummaryDetails(projectId, billVersionId, taxMode),
          apiClient.listBillVersions(projectId),
          apiClient.getProjectWorkspace(projectId),
          apiClient.listAiRecommendations(projectId, {
            recommendationType: "variance_warning",
            status: "generated",
            limit: 5,
          }),
        ]);
      setProject(projectResponse);
      setSummary(summaryResponse);
      setDetails(detailsResponse.items);
      setVersions(versionsResponse.items);
      setCanExportReports(
        Boolean(workspaceResponse.currentUser.permissionSummary.canExportReports),
      );
      setAiVarianceWarnings(
        billVersionId
          ? aiVarianceWarningsResponse.items.filter(
              (item) => item.outputPayload.billVersionId === billVersionId,
            )
          : aiVarianceWarningsResponse.items,
      );

      if (
        compareBaseBillVersionId &&
        compareTargetBillVersionId &&
        compareBaseBillVersionId !== compareTargetBillVersionId
      ) {
        setVersionCompare(
          await apiClient.getVersionCompare(
            projectId,
            compareBaseBillVersionId,
            compareTargetBillVersionId,
          ),
        );
      } else {
        setVersionCompare(null);
      }
    } catch (fetchError) {
      setError(
        fetchError instanceof ApiError
          ? fetchError.message
          : "汇总页加载失败，请确认 API 已启动。",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSummary();
  }, [
    projectId,
    billVersionId,
    taxMode,
    compareBaseBillVersionId,
    compareTargetBillVersionId,
  ]);

  async function createExportTask(reportType: ReportExportTask["reportType"]) {
    if (!projectId) {
      return;
    }
    setExportingReportType(reportType);
    setExportMessage(null);
    try {
      const response = await apiClient.createReportExportTask({
        projectId,
        reportType,
        stageCode: selectedVersion?.stageCode,
        disciplineCode: selectedVersion?.disciplineCode,
      });
      setExportTask(response.result);
      setExportJobId(response.job.id);
      setExportMessage(`已创建${formatReportType(reportType)}导出任务。`);
    } catch (createError) {
      setExportMessage(
        createError instanceof ApiError
          ? createError.message
          : "创建导出任务失败。",
      );
    } finally {
      setExportingReportType(null);
    }
  }

  async function refreshExportTask() {
    if (!exportTask) {
      return;
    }
    setRefreshingExportTask(true);
    setExportMessage(null);
    try {
      const refreshed = await apiClient.getReportExportTask(exportTask.id);
      setExportTask(refreshed);
      setExportMessage(`导出任务状态：${formatExportStatus(refreshed.status)}。`);
    } catch (refreshError) {
      setExportMessage(
        refreshError instanceof ApiError
          ? refreshError.message
          : "刷新导出任务失败。",
      );
    } finally {
      setRefreshingExportTask(false);
    }
  }

  async function downloadExportTask() {
    if (!exportTask) {
      return;
    }
    setDownloadingExportTask(true);
    setExportMessage(null);
    try {
      await apiClient.downloadReportExportTask(exportTask.id);
      setExportMessage("导出文件已开始下载。");
    } catch (downloadError) {
      setExportMessage(
        downloadError instanceof ApiError
          ? downloadError.message
          : "下载导出文件失败。",
      );
    } finally {
      setDownloadingExportTask(false);
    }
  }

  if (loading) {
    return <LoadingState title="正在加载汇总页" />;
  }

  if (error) {
    return (
      <ErrorState
        body={error}
        onRetry={() => {
          void loadSummary();
        }}
      />
    );
  }

  if (!summary) {
    return (
      <EmptyState
        title="汇总数据为空"
        body="还没有拿到 summary 结果，请稍后再试。"
      />
    );
  }

  const versionContext =
    projectId && selectedVersion
      ? buildSummaryPageContext({
          projectId,
          billVersionId: selectedVersion.id,
        })
      : null;
  const breadcrumbs =
    projectId && selectedVersion
      ? buildProjectVersionBreadcrumbs({
          currentLabel: "汇总页",
          projectId,
          projectName: project?.name ?? projectId,
          versionLabel: selectedVersion.versionName,
        })
      : null;
  const highlightCards = buildSummaryHighlights(details);
  const compareHighlights = versionCompare
    ? buildVersionCompareHighlights(versionCompare.items)
    : [];
  const compareTableRows = versionCompare
    ? buildVersionCompareTableRows(versionCompare.items)
    : [];

  return (
    <div className="page-stack">
      {breadcrumbs ? <AppBreadcrumbs items={breadcrumbs} /> : null}
      <header className="page-header">
        <div>
          <h2 className="page-title">汇总页</h2>
          <p className="page-description">
            这里先展示最核心的系统值、最终值和偏差摘要，给后续前端联调一个清晰落点。
          </p>
          {project ? (
            <p className="page-description">
              当前项目：{project.name}（{project.code}）
            </p>
          ) : null}
          <p className="page-description">
            {selectedVersion
              ? `当前版本：${selectedVersion.versionName} · ${selectedVersion.stageCode} · ${selectedVersion.disciplineCode}`
              : billVersionId
                ? `当前按版本 ${billVersionId} 过滤，但前端还没拿到对应版本详情。`
                : "当前展示项目级汇总，尚未限定 bill version。"}
          </p>
        </div>
        {projectId ? (
          <Link className="app-nav-link active" to={`/projects/${projectId}`}>
            返回项目详情
          </Link>
        ) : null}
      </header>

      {versions.length > 0 ? (
        <section className="panel">
          <div className="page-header">
            <div>
              <h3>版本上下文</h3>
              <p className="page-description">
                汇总页会跟着 bill version 过滤条件联动，你可以在这里直接切换。
              </p>
            </div>
            <div className="summary-actions">
              {selectedVersion ? (
                <BillVersionSelector
                  onChange={(nextVersionId) => {
                    if (!projectId) {
                      return;
                    }
                    const nextSearchParams = new URLSearchParams();
                    nextSearchParams.set("billVersionId", nextVersionId);
                    if (taxMode) {
                      nextSearchParams.set("taxMode", taxMode);
                    }
                    window.history.replaceState(
                      null,
                      "",
                      `/projects/${projectId}/summary?${nextSearchParams.toString()}`,
                    );
                    window.dispatchEvent(new PopStateEvent("popstate"));
                  }}
                  selectedVersionId={selectedVersion.id}
                  versions={versions}
                />
              ) : null}
              <label className="connection-label">
                计税口径
                <select
                  aria-label="计税口径"
                  className="version-select"
                  onChange={(event) => {
                    if (!projectId) {
                      return;
                    }
                    const nextSearchParams = new URLSearchParams(searchParams);
                    nextSearchParams.set("taxMode", event.target.value);
                    void navigate(
                      `/projects/${projectId}/summary?${nextSearchParams.toString()}`,
                    );
                  }}
                  value={taxMode ?? "tax_included"}
                >
                  <option value="tax_included">含税口径</option>
                  <option value="tax_excluded">不含税口径</option>
                </select>
              </label>
              {versionContext ? (
                <Link className="app-nav-link active" to={versionContext.billItemsPath}>
                  返回当前版本清单页
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {versions.length > 1 ? (
        <section className="panel">
          <div className="page-header">
            <div>
              <h3>版本对比</h3>
              <p className="page-description">
                先选一个基准版本，再和当前版本做差异比较。
              </p>
            </div>
            <div className="compare-actions">
              <BillVersionSelector
                label="基准版本"
                onChange={(nextBaseId) => {
                  if (!projectId || !compareTargetBillVersionId) {
                    return;
                  }
                  void navigate(
                    `/projects/${projectId}/summary?billVersionId=${compareTargetBillVersionId}&compareBaseBillVersionId=${nextBaseId}&compareTargetBillVersionId=${compareTargetBillVersionId}`,
                  );
                }}
                selectedVersionId={
                  compareBaseBillVersionId ??
                  versions.find((version) => version.id !== compareTargetBillVersionId)?.id ??
                  versions[0]!.id
                }
                versions={versions}
              />
              <BillVersionSelector
                label="对比版本"
                onChange={(nextTargetId) => {
                  if (!projectId) {
                    return;
                  }
                  const nextBaseId =
                    compareBaseBillVersionId ??
                    versions.find((version) => version.id !== nextTargetId)?.id ??
                    nextTargetId;
                  void navigate(
                    `/projects/${projectId}/summary?billVersionId=${nextTargetId}&compareBaseBillVersionId=${nextBaseId}&compareTargetBillVersionId=${nextTargetId}`,
                  );
                }}
                selectedVersionId={
                  compareTargetBillVersionId ??
                  billVersionId ??
                  versions[0]!.id
                }
                versions={versions}
              />
            </div>
          </div>
          {versionCompare ? (
            <div className="compare-summary">
              <p className="page-description">
                基准版本：{versionCompare.baseVersionName}，对比版本：{versionCompare.targetVersionName}。
              </p>
              <p className="page-description">
                共对比 {versionCompare.itemCount} 个清单项，下面按最终值偏差绝对值从高到低展示。
              </p>
              <div className="highlight-grid">
                {compareHighlights.map((item) => (
                  <article className={`highlight-card ${item.tone}`} key={item.itemCode}>
                    <p className="stat-label">{item.itemCode}</p>
                    <h4 className="highlight-title">{item.itemName}</h4>
                    <p className="highlight-variance">{item.finalVarianceLabel}</p>
                    <p className="page-description">
                      {formatCompareVarianceTone(Number(item.finalVarianceLabel.replace(/,/g, "")))}
                    </p>
                  </article>
                ))}
              </div>
              {compareTableRows.length > 0 ? (
                <div className="compare-table-shell">
                  <table className="compare-table">
                    <thead>
                      <tr>
                        <th>清单编码</th>
                        <th>清单名称</th>
                        <th>基准系统值</th>
                        <th>对比系统值</th>
                        <th>系统值偏差</th>
                        <th>基准最终值</th>
                        <th>对比最终值</th>
                        <th>最终值偏差</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compareTableRows.map((row) => (
                        <tr key={row.itemCode}>
                          <td className="compare-table-code">{row.itemCode}</td>
                          <td>{row.itemName}</td>
                          <td>{row.baseSystemAmountLabel}</td>
                          <td>{row.targetSystemAmountLabel}</td>
                          <td className={`money-${row.systemTone}`}>
                            {row.systemVarianceAmountLabel}
                          </td>
                          <td>{row.baseFinalAmountLabel}</td>
                          <td>{row.targetFinalAmountLabel}</td>
                          <td className={`money-${row.finalTone}`}>
                            {row.finalVarianceAmountLabel}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="page-description">
              选择两个不同版本后，这里会显示差异最大的条目。
            </p>
          )}
        </section>
      ) : null}

      {canExportReports ? (
      <section className={exportTask ? "panel panel-focus" : "panel"}>
        <div className="page-header">
          <div>
            <h3>报表导出</h3>
            <p className="page-description">
              按当前项目与版本上下文创建异步导出任务。
            </p>
          </div>
          <div className="summary-actions">
            <button
              className="connection-button primary"
              disabled={exportingReportType !== null}
              onClick={() => {
                void createExportTask("summary");
              }}
              type="button"
            >
              {exportingReportType === "summary" ? "创建中" : "导出汇总"}
            </button>
            <button
              className="connection-button secondary"
              disabled={exportingReportType !== null}
              onClick={() => {
                void createExportTask("variance");
              }}
              type="button"
            >
              {exportingReportType === "variance" ? "创建中" : "导出偏差"}
            </button>
          </div>
        </div>
        {exportTask ? (
          <div className="bill-list export-task-list">
            <article className="bill-link">
              <h3>
                {formatReportType(exportTask.reportType)}导出 · {formatExportStatus(exportTask.status)}
              </h3>
              <div className="bill-meta">
                <span>任务 {exportTask.id}</span>
                {exportJobId ? <span>后台任务 {exportJobId}</span> : null}
                {exportTask.downloadFileName ? (
                  <span>文件 {exportTask.downloadFileName}</span>
                ) : null}
                {exportTask.downloadContentLength ? (
                  <span>{exportTask.downloadContentLength} bytes</span>
                ) : null}
              </div>
              {exportTask.failureMessage ? (
                <p className="page-description">{exportTask.failureMessage}</p>
              ) : null}
              <div className="version-card-actions">
                <button
                  className="connection-button secondary"
                  disabled={refreshingExportTask}
                  onClick={() => {
                    void refreshExportTask();
                  }}
                  type="button"
                >
                  {refreshingExportTask ? "刷新中" : "刷新状态"}
                </button>
                <button
                  className="connection-button primary"
                  disabled={!exportTask.isDownloadReady || downloadingExportTask}
                  onClick={() => {
                    void downloadExportTask();
                  }}
                  type="button"
                >
                  {downloadingExportTask ? "下载中" : "下载文件"}
                </button>
              </div>
            </article>
          </div>
        ) : null}
        {exportMessage ? <p className="page-description">{exportMessage}</p> : null}
      </section>
      ) : null}

      <section className="summary-grid">
        <article className="stat-card">
          <p className="stat-label">系统值合计</p>
          <p className="stat-value">{formatMoney(summary.totalSystemAmount)}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">最终值合计</p>
          <p className="stat-value">{formatMoney(summary.totalFinalAmount)}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">偏差金额</p>
          <p
            className={`stat-value ${
              Number(summary.varianceAmount ?? 0) >= 0
                ? "money-positive"
                : "money-negative"
            }`}
          >
            {formatMoney(summary.varianceAmount)}
          </p>
        </article>
        {summary.taxMode ? (
          <article className="stat-card">
            <p className="stat-label">
              {summary.taxMode === "tax_excluded" ? "已剔除税金" : "税金"}
            </p>
            <p className="stat-value">{formatMoney(summary.totalTaxAmount)}</p>
          </article>
        ) : null}
        <article className="stat-card">
          <p className="stat-label">清单条目数</p>
          <p className="stat-value">{summary.itemCount ?? "-"}</p>
        </article>
      </section>

      {aiVarianceWarnings.length > 0 ? (
        <section className="panel panel-focus">
          <div className="page-header">
            <div>
              <h3>AI 偏差预警</h3>
              <p className="page-description">
                当前还有 {aiVarianceWarnings.length} 条待处理预警，来自 AI 推荐结果缓存。
              </p>
            </div>
            {projectId ? (
              <Link
                className="app-nav-link active"
                to={`/projects/${projectId}/ai-recommendations?recommendationType=variance_warning&status=generated`}
              >
                查看全部预警
              </Link>
            ) : null}
          </div>
          <div className="highlight-grid">
            {aiVarianceWarnings.map((warning) => (
              <article className="highlight-card negative" key={warning.id}>
                <p className="stat-label">
                  {formatPayloadText(warning.outputPayload.itemCode) || warning.resourceId}
                </p>
                <h4 className="highlight-title">
                  {formatPayloadText(warning.outputPayload.itemName) || "偏差预警"}
                </h4>
                <p className="highlight-variance">
                  {formatMoney(
                    warning.outputPayload.varianceAmount as number | string | null,
                  )}
                </p>
                <p className="page-description">
                  {formatPayloadText(warning.outputPayload.warning) ||
                    "最终金额与系统金额偏差超过阈值。"}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {highlightCards.length > 0 ? (
        <section className="panel">
          <h3>高优先级偏差预警</h3>
          <div className="highlight-grid">
            {highlightCards.map((highlight) => (
              <article
                className={`highlight-card ${highlight.tone}`}
                key={highlight.itemId}
              >
                <p className="stat-label">
                  {highlight.itemCode} · {highlight.priorityLabel}
                </p>
                <h4 className="highlight-title">{highlight.itemName}</h4>
                <p className="highlight-variance">{highlight.varianceLabel}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {details.length === 0 ? (
        <EmptyState
          title="暂无偏差明细"
          body="当前项目还没有可展示的 summary detail 数据。"
        />
      ) : (
        <section className="panel">
          <h3>偏差明细 Top 10</h3>
          <div className="bill-list">
            {details.map((detail) => (
              <article className="bill-link" key={detail.itemId}>
                <h3>
                  {detail.itemCode} · {detail.itemName}
                </h3>
                <div className="bill-meta">
                  <span>系统值 {formatMoney(detail.systemAmount)}</span>
                  <span>最终值 {formatMoney(detail.finalAmount)}</span>
                  <span>偏差 {formatMoney(detail.varianceAmount)}</span>
                  {detail.taxAmount !== undefined ? (
                    <span>税金 {formatMoney(detail.taxAmount)}</span>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
