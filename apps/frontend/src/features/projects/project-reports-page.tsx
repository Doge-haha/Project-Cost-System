import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { apiClient, ApiError } from "../../lib/api";
import type {
  BackgroundJob,
  BillVersion,
  ProjectWorkspace,
  ReportExportTask,
} from "../../lib/types";
import { AppBreadcrumbs, type BreadcrumbItem } from "../shared/breadcrumbs";
import { BillVersionSelector } from "../shared/bill-version-selector";
import { EmptyState } from "../shared/empty-state";
import { ErrorState } from "../shared/error-state";
import { LoadingState } from "../shared/loading-state";

type ReportCenterState = {
  workspace: ProjectWorkspace;
  jobs: BackgroundJob[];
  tasksById: Record<string, ReportExportTask>;
};

type ReportTemplate = {
  id: string;
  templateName: string;
  reportType: ReportExportTask["reportType"];
  templateSource: "built_in_standard" | "enterprise";
  version: string;
  stageScope: string[];
  outputFormats: string[];
  fieldMappings: string[];
  baseTemplateId?: string | null;
};

type ReportOutputFormat = "json" | "excel" | "pdf";

const builtInReportTemplates: ReportTemplate[] = [
  {
    id: "tpl-standard-summary-v1",
    templateName: "国标汇总报表",
    reportType: "summary",
    templateSource: "built_in_standard",
    version: "1.0",
    stageScope: ["estimate", "budget", "settlement"],
    outputFormats: ["JSON", "Excel", "PDF"],
    fieldMappings: ["totalSystemAmount", "totalFinalAmount", "varianceAmount"],
  },
  {
    id: "tpl-standard-variance-v1",
    templateName: "国标偏差分析报表",
    reportType: "variance",
    templateSource: "built_in_standard",
    version: "1.0",
    stageScope: ["estimate", "budget", "settlement"],
    outputFormats: ["JSON", "Excel", "PDF"],
    fieldMappings: ["itemCode", "systemAmount", "finalAmount", "varianceRate"],
  },
  {
    id: "tpl-standard-stage-bill-v1",
    templateName: "国标阶段清单报表",
    reportType: "stage_bill",
    templateSource: "built_in_standard",
    version: "1.0",
    stageScope: ["estimate", "budget", "settlement"],
    outputFormats: ["JSON", "Excel", "PDF"],
    fieldMappings: ["itemCode", "itemName", "quantity", "finalAmount"],
  },
  {
    id: "tpl-standard-settlement-summary-v1",
    templateName: "国标结算汇总报表",
    reportType: "summary",
    templateSource: "built_in_standard",
    version: "0.1",
    stageScope: ["settlement"],
    outputFormats: ["JSON", "Excel", "PDF"],
    fieldMappings: [
      "contractBaselineAmount",
      "approvedChangeAmount",
      "settlementAmount",
      "varianceAmount",
    ],
  },
];

function formatReportType(reportType: ReportExportTask["reportType"]) {
  if (reportType === "variance") {
    return "偏差明细";
  }
  if (reportType === "stage_bill") {
    return "阶段清单";
  }
  return "汇总";
}

function formatTemplateSource(source: ReportTemplate["templateSource"]) {
  return source === "enterprise" ? "企业模板" : "内置国标模板";
}

function formatOutputFormat(format: ReportOutputFormat) {
  if (format === "excel") {
    return "Excel";
  }
  if (format === "pdf") {
    return "PDF";
  }
  return "JSON";
}

function formatExportStatus(status: ReportExportTask["status"] | BackgroundJob["status"]) {
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

function getReportExportTaskId(job: BackgroundJob) {
  const payloadTaskId = job.payload.reportExportTaskId;
  if (typeof payloadTaskId === "string" && payloadTaskId.length > 0) {
    return payloadTaskId;
  }
  const resultTaskId = job.result?.taskId;
  return typeof resultTaskId === "string" && resultTaskId.length > 0
    ? resultTaskId
    : null;
}

function pickVersion(versions: BillVersion[], billVersionId?: string | null) {
  return (
    versions.find((version) => version.id === billVersionId) ??
    versions[0] ??
    null
  );
}

function getReportTemplateId(job: BackgroundJob, task?: ReportExportTask | null) {
  if (typeof task?.reportTemplateId === "string") {
    return task.reportTemplateId;
  }
  return typeof job.payload.reportTemplateId === "string"
    ? job.payload.reportTemplateId
    : null;
}

function getOutputFormat(
  job: BackgroundJob,
  task?: ReportExportTask | null,
): ReportOutputFormat | null {
  const value = task?.outputFormat ?? job.payload.outputFormat;
  return value === "json" || value === "excel" || value === "pdf" ? value : null;
}

export function ProjectReportsPage() {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = params.projectId;
  const selectedBillVersionId = searchParams.get("billVersionId");
  const [state, setState] = useState<ReportCenterState | null>(null);
  const [creatingReportType, setCreatingReportType] = useState<
    ReportExportTask["reportType"] | null
  >(null);
  const [refreshingTaskId, setRefreshingTaskId] = useState<string | null>(null);
  const [downloadingTaskId, setDownloadingTaskId] = useState<string | null>(null);
  const [retryingTaskId, setRetryingTaskId] = useState<string | null>(null);
  const [enterpriseTemplates, setEnterpriseTemplates] = useState<ReportTemplate[]>(
    [],
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    builtInReportTemplates[0]!.id,
  );
  const [selectedOutputFormat, setSelectedOutputFormat] =
    useState<ReportOutputFormat>("json");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const selectedVersion = useMemo(
    () => pickVersion(state?.workspace.billVersions ?? [], selectedBillVersionId),
    [selectedBillVersionId, state?.workspace.billVersions],
  );
  const canExportReports = Boolean(
    state?.workspace.currentUser.permissionSummary.canExportReports,
  );
  const reportTemplates = useMemo(
    () => [...builtInReportTemplates, ...enterpriseTemplates],
    [enterpriseTemplates],
  );
  const selectedTemplate = useMemo(
    () =>
      reportTemplates.find((template) => template.id === selectedTemplateId) ??
      reportTemplates[0]!,
    [reportTemplates, selectedTemplateId],
  );

  function getTemplateForReportType(reportType: ReportExportTask["reportType"]) {
    return selectedTemplate.reportType === reportType
      ? selectedTemplate
      : reportTemplates.find((template) => template.reportType === reportType);
  }

  async function loadReportCenter() {
    if (!projectId) {
      setError("项目标识缺失，无法加载报表中心。");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [workspace, jobsResponse] = await Promise.all([
        apiClient.getProjectWorkspace(projectId),
        apiClient.listProjectBackgroundJobs(projectId, {
          jobType: "report_export",
        }),
      ]);
      const taskEntries = await Promise.all(
        jobsResponse.items
          .map(getReportExportTaskId)
          .filter((taskId): taskId is string => Boolean(taskId))
          .map(async (taskId) => {
            try {
              return [taskId, await apiClient.getReportExportTask(taskId)] as const;
            } catch {
              return null;
            }
          }),
      );
      const taskEntryPairs = taskEntries.filter(
        (entry): entry is readonly [string, ReportExportTask] => entry !== null,
      );

      setState({
        workspace,
        jobs: jobsResponse.items,
        tasksById: Object.fromEntries(taskEntryPairs),
      });
    } catch (fetchError) {
      setError(
        fetchError instanceof ApiError
          ? fetchError.message
          : "报表中心加载失败，请确认 API 已启动。",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReportCenter();
  }, [projectId]);

  async function createExportTask(
    reportType: ReportExportTask["reportType"],
    scope?: {
      stageCode?: string | null;
      disciplineCode?: string | null;
      retrySourceTaskId?: string;
      reportTemplateId?: string | null;
      outputFormat?: ReportOutputFormat | null;
    },
  ) {
    if (!projectId) {
      return;
    }
    setCreatingReportType(reportType);
    setRetryingTaskId(scope?.retrySourceTaskId ?? null);
    setMessage(null);
    try {
      const template = scope ? null : getTemplateForReportType(reportType);
      const response = await apiClient.createReportExportTask({
        projectId,
        reportType,
        stageCode: scope
          ? (scope.stageCode ?? undefined)
          : selectedVersion?.stageCode,
        disciplineCode: scope
          ? (scope.disciplineCode ?? undefined)
          : selectedVersion?.disciplineCode,
        reportTemplateId: scope
          ? (scope.reportTemplateId ?? undefined)
          : template?.id,
        outputFormat: scope
          ? (scope.outputFormat ?? undefined)
          : selectedOutputFormat,
      });
      setState((current) =>
        current
          ? {
              ...current,
              jobs: [
                {
                  id: response.job.id,
                  jobType: response.job.jobType,
                  status: response.job.status,
                  requestedBy: response.result.requestedBy,
                  projectId: response.result.projectId,
                  payload: {
                    reportExportTaskId: response.result.id,
                    reportTemplateId: scope
                      ? (scope.reportTemplateId ?? undefined)
                      : template?.id,
                    outputFormat: scope
                      ? (scope.outputFormat ?? undefined)
                      : selectedOutputFormat,
                  },
                  result: null,
                  errorMessage: null,
                  createdAt: response.result.createdAt,
                  completedAt: response.result.completedAt ?? null,
                },
                ...current.jobs,
              ],
              tasksById: {
                ...current.tasksById,
                [response.result.id]: response.result,
              },
            }
          : current,
      );
      setMessage(
        scope?.retrySourceTaskId
          ? `已重新发起${formatReportType(reportType)}导出任务。`
          : `已创建${formatReportType(reportType)}导出任务。`,
      );
    } catch (createError) {
      setMessage(
        createError instanceof ApiError
          ? createError.message
          : "创建导出任务失败。",
      );
    } finally {
      setCreatingReportType(null);
      setRetryingTaskId(null);
    }
  }

  async function refreshTask(taskId: string) {
    setRefreshingTaskId(taskId);
    setMessage(null);
    try {
      const task = await apiClient.getReportExportTask(taskId);
      setState((current) =>
        current
          ? {
              ...current,
              tasksById: {
                ...current.tasksById,
                [task.id]: task,
              },
            }
          : current,
      );
      setMessage(`导出任务状态：${formatExportStatus(task.status)}。`);
    } catch (refreshError) {
      setMessage(
        refreshError instanceof ApiError
          ? refreshError.message
          : "刷新导出任务失败。",
      );
    } finally {
      setRefreshingTaskId(null);
    }
  }

  async function downloadTask(taskId: string) {
    setDownloadingTaskId(taskId);
    setMessage(null);
    try {
      await apiClient.downloadReportExportTask(taskId);
      setMessage("导出文件已开始下载。");
    } catch (downloadError) {
      setMessage(
        downloadError instanceof ApiError
          ? downloadError.message
          : "下载导出文件失败。",
      );
    } finally {
      setDownloadingTaskId(null);
    }
  }

  function copyBuiltInTemplate(template: ReportTemplate) {
    if (template.templateSource !== "built_in_standard") {
      return;
    }
    const copiedTemplate: ReportTemplate = {
      ...template,
      id: `${template.id}-enterprise-${enterpriseTemplates.length + 1}`,
      templateName: `${template.templateName}企业版`,
      templateSource: "enterprise",
      version: "1.1",
      baseTemplateId: template.id,
    };
    setEnterpriseTemplates((current) => [copiedTemplate, ...current]);
    setSelectedTemplateId(copiedTemplate.id);
    setMessage(`已复制 ${template.templateName} 为企业模板。`);
  }

  if (loading) {
    return <LoadingState title="正在加载报表中心" />;
  }

  if (error) {
    return (
      <ErrorState
        body={error}
        onRetry={() => {
          void loadReportCenter();
        }}
      />
    );
  }

  if (!state || !projectId) {
    return <EmptyState title="报表中心为空" body="还没有拿到报表中心数据。" />;
  }

  const breadcrumbs: BreadcrumbItem[] = [
    { label: "项目", to: "/projects" },
    { label: state.workspace.project.name, to: `/projects/${projectId}` },
    { label: "报表中心", to: null },
  ];

  return (
    <div className="page-stack">
      <AppBreadcrumbs items={breadcrumbs} />
      <header className="page-header">
        <div>
          <p className="app-eyebrow">{state.workspace.project.code}</p>
          <h2 className="page-title">报表中心</h2>
          <p className="page-description">
            发起汇总/偏差/阶段清单异步导出，跟踪任务状态，并在完成后下载结果。
          </p>
        </div>
        <Link className="app-nav-link active" to={`/projects/${projectId}`}>
          返回项目详情
        </Link>
      </header>

      <section className="panel">
        <div className="page-header">
          <div>
            <h3>导出范围</h3>
            <p className="page-description">
              当前导出会继承所选版本的阶段和专业范围。
            </p>
          </div>
          <div className="summary-actions">
            {selectedVersion ? (
              <BillVersionSelector
                label="当前版本"
                onChange={(billVersionId) => {
                  const next = new URLSearchParams(searchParams);
                  next.set("billVersionId", billVersionId);
                  setSearchParams(next);
                }}
                selectedVersionId={selectedVersion.id}
                versions={state.workspace.billVersions}
              />
            ) : null}
            {canExportReports ? (
              <>
                <label className="connection-label">
                  报表模板
                  <select
                    aria-label="报表模板"
                    className="version-select"
                    onChange={(event) => {
                      setSelectedTemplateId(event.target.value);
                    }}
                    value={selectedTemplate.id}
                  >
                    {reportTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.templateName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="connection-label">
                  输出格式
                  <select
                    aria-label="输出格式"
                    className="version-select"
                    onChange={(event) => {
                      setSelectedOutputFormat(event.target.value as ReportOutputFormat);
                    }}
                    value={selectedOutputFormat}
                  >
                    <option value="json">JSON</option>
                    <option value="excel">Excel</option>
                    <option value="pdf">PDF</option>
                  </select>
                </label>
                <button
                  className="connection-button primary"
                  disabled={creatingReportType !== null}
                  onClick={() => {
                    void createExportTask("summary");
                  }}
                  type="button"
                >
                  {creatingReportType === "summary" ? "创建中" : "导出汇总"}
                </button>
                <button
                  className="connection-button secondary"
                  disabled={creatingReportType !== null}
                  onClick={() => {
                    void createExportTask("variance");
                  }}
                  type="button"
                >
                  {creatingReportType === "variance" ? "创建中" : "导出偏差"}
                </button>
                <button
                  className="connection-button secondary"
                  disabled={creatingReportType !== null}
                  onClick={() => {
                    void createExportTask("stage_bill");
                  }}
                  type="button"
                >
                  {creatingReportType === "stage_bill" ? "创建中" : "导出阶段清单"}
                </button>
              </>
            ) : (
              <p className="page-description">当前角色没有报表导出权限。</p>
            )}
          </div>
        </div>
        {selectedVersion ? (
          <p className="page-description">
            已选范围：{selectedVersion.versionName} · {selectedVersion.stageCode} ·{" "}
            {selectedVersion.disciplineCode}
          </p>
        ) : null}
        {message ? <p className="page-description">{message}</p> : null}
      </section>

      <section className="panel">
        <div className="page-header">
          <div>
            <h3>模板管理</h3>
            <p className="page-description">
              内置国标模板作为基线保留，企业模板通过复制扩展生成。
            </p>
          </div>
        </div>
        <div className="bill-list">
          {reportTemplates.map((template) => (
            <article className="bill-link" key={template.id}>
              <h3>
                {template.templateName} · {formatTemplateSource(template.templateSource)}
              </h3>
              <div className="bill-meta">
                <span>{formatReportType(template.reportType)}</span>
                <span>版本 {template.version}</span>
                <span>阶段 {template.stageScope.join("/")}</span>
                <span>输出 {template.outputFormats.join("/")}</span>
              </div>
              <p className="page-description">
                字段映射：{template.fieldMappings.join("、")}
              </p>
              {template.baseTemplateId ? (
                <p className="page-description">
                  来源模板：{template.baseTemplateId}
                </p>
              ) : null}
              <div className="version-card-actions">
                <button
                  className="connection-button secondary"
                  disabled={template.templateSource !== "built_in_standard"}
                  onClick={() => {
                    copyBuiltInTemplate(template);
                  }}
                  type="button"
                >
                  复制为企业模板
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="page-header">
          <div>
            <h3>导出任务</h3>
            <p className="page-description">
              仅展示当前项目的报表导出后台任务。
            </p>
          </div>
          <button
            className="connection-button secondary"
            onClick={() => {
              void loadReportCenter();
            }}
            type="button"
          >
            刷新列表
          </button>
        </div>
        {state.jobs.length === 0 ? (
          <EmptyState title="暂无导出任务" body="创建导出后，任务会出现在这里。" />
        ) : (
          <div className="bill-list export-task-list">
            {state.jobs.map((job) => {
              const taskId = getReportExportTaskId(job);
              const task = taskId ? state.tasksById[taskId] : null;
              const status = task?.status ?? job.status;
              const reportTemplateId = getReportTemplateId(job, task);
              const outputFormat = getOutputFormat(job, task);
              return (
                <article className="bill-link" key={job.id}>
                  <h3>
                    {task ? `${formatReportType(task.reportType)}导出` : "报表导出"} ·{" "}
                    {formatExportStatus(status)}
                  </h3>
                  <div className="bill-meta">
                    <span>后台任务 {job.id}</span>
                    {taskId ? <span>导出任务 {taskId}</span> : null}
                    {task?.downloadFileName ? (
                      <span>文件 {task.downloadFileName}</span>
                    ) : null}
                    {task?.downloadContentLength ? (
                      <span>{task.downloadContentLength} bytes</span>
                    ) : null}
                    {reportTemplateId ? (
                      <span>模板 {reportTemplateId}</span>
                    ) : null}
                    {outputFormat ? (
                      <span>输出 {formatOutputFormat(outputFormat)}</span>
                    ) : null}
                  </div>
                  {job.errorMessage || task?.failureMessage ? (
                    <p className="page-description">
                      {task?.failureMessage ?? job.errorMessage}
                    </p>
                  ) : null}
                  {taskId ? (
                    <div className="version-card-actions">
                      <button
                        className="connection-button secondary"
                        disabled={refreshingTaskId === taskId}
                        onClick={() => {
                          void refreshTask(taskId);
                        }}
                        type="button"
                      >
                        {refreshingTaskId === taskId ? "刷新中" : "刷新状态"}
                      </button>
                      <button
                        className="connection-button primary"
                        disabled={!task?.isDownloadReady || downloadingTaskId === taskId}
                        onClick={() => {
                          void downloadTask(taskId);
                        }}
                        type="button"
                      >
                        {downloadingTaskId === taskId ? "下载中" : "下载文件"}
                      </button>
                      {task?.hasFailed && canExportReports ? (
                        <button
                          className="connection-button secondary"
                          disabled={
                            creatingReportType !== null || retryingTaskId === taskId
                          }
                          onClick={() => {
                            void createExportTask(task.reportType, {
                              stageCode: task.stageCode,
                              disciplineCode: task.disciplineCode,
                              retrySourceTaskId: task.id,
                              reportTemplateId,
                              outputFormat,
                            });
                          }}
                          type="button"
                        >
                          {retryingTaskId === taskId ? "重发中" : "重新发起"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
