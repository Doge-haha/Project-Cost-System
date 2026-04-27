import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { apiClient, ApiError } from "../../lib/api";
import type { BackgroundJob, ImportTask, ProjectWorkspace } from "../../lib/types";
import { AppBreadcrumbs, buildProjectVersionBreadcrumbs } from "../shared/breadcrumbs";
import { EmptyState } from "../shared/empty-state";
import { ErrorState } from "../shared/error-state";
import { LoadingState } from "../shared/loading-state";
import { normalizeFailureReason } from "./failure-reason-label";
import { parseImportTaskFailedItems } from "./import-task-failure-snapshots";
import {
  formatDetectedFormat,
  parseFailureSummary,
  parseImportPreviewItems,
  parseImportSummary,
  parseRetryHistory,
} from "./import-task-view-model";
import {
  buildFailureSubsetBatchEntries,
  buildFailureSubsetWorkOrderSummary,
  buildFailureSummaryState,
  buildFailureRetryState,
  buildSelectedFailedItemDetailState,
  buildUploadComparisonSummaryState,
  buildTeamHandoffSummary,
  buildUpstreamHandoffSummary,
} from "./project-job-status-model";
import {
  buildCurrentJobStatusViewUrl,
  buildErrorReportActionKey,
  buildFailureSubsetDownload,
  buildSuggestedErrorReportFileName,
  type ErrorReportFormat,
  type ErrorReportScope,
  buildNextJobStatusSearchParams,
  buildRecentJobStatusProcessingLinkInput,
  buildJobStatusReturnParams,
  buildUploadReturnToFailureContext,
  parseFailedLine,
  parseOptionalFilterValue,
  parseStatusFilter,
  resolveJobStatusSelection,
  triggerClientDownload,
} from "./project-job-status-utils";
import {
  clearRecentProcessingLink,
  readRecentProcessingLink,
  saveRecentProcessingLink,
} from "./recent-processing-link";
import { formatProjectDateTime } from "./project-date-utils";
import { RecentProcessingSummaryCard } from "./recent-processing-summary-card";
import {
  formatImportSource,
  formatImportStatus,
} from "./project-job-status-formatters";
import {
  ProjectJobStatusUploadSection,
  type ProjectJobStatusUploadCompleted,
} from "./project-job-status-upload-section";
import { ProjectJobStatusImportTaskList } from "./project-job-status-import-task-list";
import { ProjectJobStatusFilterSection } from "./project-job-status-filter-section";
import { ProjectJobStatusJobPanels } from "./project-job-status-job-panels";

type ProjectJobStatusState = {
  workspace: ProjectWorkspace;
  importTasks: ImportTask[];
  jobs: BackgroundJob[];
};

const RETRY_INPUT_INCOMPLETE_ERROR_MESSAGE =
  "当前失败范围中有条目缺少可重建输入，请先导出当前范围或回源修数后再重新导入。";

export function ProjectJobStatusPage() {
  const params = useParams();
  const projectId = params.projectId;
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = parseStatusFilter(searchParams.get("status"));
  const focusedJobId = searchParams.get("jobId");
  const focusedImportTaskId = searchParams.get("importTaskId");
  const selectedFailureReasonCode = normalizeFailureReason(
    searchParams.get("failureReason"),
  );
  const selectedResourceTypeFilter = parseOptionalFilterValue(
    searchParams.get("failureResourceType"),
  );
  const selectedActionFilter = parseOptionalFilterValue(searchParams.get("failureAction"));
  const selectedFailedLine = parseFailedLine(searchParams.get("failedLine"));
  const [state, setState] = useState<ProjectJobStatusState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImportTaskId, setSelectedImportTaskId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryCompleted, setRetryCompleted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadCompleted, setUploadCompleted] =
    useState<ProjectJobStatusUploadCompleted | null>(null);
  const [uploadFileName, setUploadFileName] = useState("");
  const [uploadFileContent, setUploadFileContent] = useState("");
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [copyMessageReason, setCopyMessageReason] = useState<{
    code: string;
    label: string;
  } | null>(null);
  const [copiedLinkPath, setCopiedLinkPath] = useState<string | null>(null);
  const [recentCopiedLink, setRecentCopiedLink] = useState(
    readRecentProcessingLink(projectId),
  );
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);
  const [downloadMessageReason, setDownloadMessageReason] = useState<{
    code: string;
    label: string;
  } | null>(null);
  const [downloadingErrorReports, setDownloadingErrorReports] = useState<string[]>([]);
  const [uploadCallout, setUploadCallout] = useState<string | null>(null);
  const [lastDownloadedScopeLabel, setLastDownloadedScopeLabel] = useState<string | null>(null);
  const isRetryInputIncompleteError = error === RETRY_INPUT_INCOMPLETE_ERROR_MESSAGE;
  const uploadSectionRef = useRef<HTMLElement | null>(null);

  const selectedJob = useMemo(
    () => state?.jobs.find((job) => job.id === selectedJobId) ?? state?.jobs[0] ?? null,
    [selectedJobId, state?.jobs],
  );
  const selectedImportTask = useMemo(
    () =>
      state?.importTasks.find((task) => task.id === selectedImportTaskId) ??
      state?.importTasks[0] ??
      null,
    [selectedImportTaskId, state?.importTasks],
  );
  const selectedJobMatchesImportTask = useMemo(
    () =>
      Boolean(
        selectedJob &&
          selectedImportTask &&
          selectedImportTask.latestJobId &&
          selectedImportTask.latestJobId === selectedJob.id,
      ),
    [selectedImportTask, selectedJob],
  );
  const selectedImportSummary = useMemo(
    () => (selectedImportTask ? parseImportSummary(selectedImportTask) : null),
    [selectedImportTask],
  );
  const selectedImportPreviewItems = useMemo(
    () => (selectedImportTask ? parseImportPreviewItems(selectedImportTask) : []),
    [selectedImportTask],
  );
  const selectedImportRetryHistory = useMemo(
    () => (selectedImportTask ? parseRetryHistory(selectedImportTask) : []),
    [selectedImportTask],
  );
  const selectedImportFailureSummary = useMemo(
    () => (selectedImportTask ? parseFailureSummary(selectedImportTask) : []),
    [selectedImportTask],
  );
  const selectedImportFailedItems = useMemo(
    () => (selectedImportTask ? parseImportTaskFailedItems(selectedImportTask) : []),
    [selectedImportTask],
  );
  const failureReasonFilteredItems = useMemo(
    () =>
      selectedFailureReasonCode
        ? selectedImportFailedItems.filter(
            (item) => item.reasonCode === selectedFailureReasonCode,
          )
        : selectedImportFailedItems,
    [selectedFailureReasonCode, selectedImportFailedItems],
  );
  const filteredImportFailedItems = useMemo(
    () =>
      failureReasonFilteredItems.filter((item) => {
        const resourceType = item.resourceType ?? "未提供";
        const action = item.action ?? "未提供";

        if (selectedResourceTypeFilter && resourceType !== selectedResourceTypeFilter) {
          return false;
        }

        if (selectedActionFilter && action !== selectedActionFilter) {
          return false;
        }

        return true;
      }),
    [failureReasonFilteredItems, selectedActionFilter, selectedResourceTypeFilter],
  );
  const {
    selectedFailedItem,
    selectedFailedItemIndex,
    selectedPreviewItem,
    previousFailedItem,
    nextFailedItem,
    selectedFailedItemMissingKeys,
    selectedFailedItemExtraPreviewKeys,
  } = useMemo(
    () =>
      buildSelectedFailedItemDetailState({
        filteredImportFailedItems,
        selectedFailedLine,
        selectedImportPreviewItems,
      }),
    [filteredImportFailedItems, selectedFailedLine, selectedImportPreviewItems],
  );
  const selectedFailureReasonLabel = useMemo(
    () =>
      selectedImportFailureSummary.find(
        (item) => item.reasonCode === selectedFailureReasonCode,
      )?.reasonLabel ?? null,
    [selectedFailureReasonCode, selectedImportFailureSummary],
  );
  const {
    filteredFailureResourceSummary,
    filteredFailureActionSummary,
    filteredFailureMissingFieldCount,
    filteredFailurePreviewCount,
    hasFailureSubsetFilters,
    filteredFailureRetrySnapshotCount,
    canRetryCurrentFailureScope,
    canRetryCurrentFailureSubset,
    topFilteredFailureResourceType,
    topFilteredFailureAction,
    currentFailureSubsetLabel,
    failureActionSuggestions,
  } = useMemo(
    () =>
      buildFailureSummaryState({
        failureReasonFilteredItems,
        filteredImportFailedItems,
        selectedImportPreviewItems,
        selectedResourceTypeFilter,
        selectedActionFilter,
        selectedFailureReasonCode,
        selectedFailureReasonLabel,
        selectedJobMatchesImportTask,
        selectedJobType: selectedJob?.jobType ?? null,
      }),
    [
      failureReasonFilteredItems,
      filteredImportFailedItems,
      selectedImportPreviewItems,
      selectedResourceTypeFilter,
      selectedActionFilter,
      selectedFailureReasonCode,
      selectedFailureReasonLabel,
      selectedJobMatchesImportTask,
      selectedJob?.jobType,
    ],
  );
  const currentViewUrl = useMemo(() => buildCurrentViewUrl(), [
    projectId,
    searchParams,
    selectedActionFilter,
    selectedFailedLine,
    selectedFailureReasonCode,
    selectedResourceTypeFilter,
    statusFilter,
  ]);
  const suggestedExportFileName = useMemo(() => buildSuggestedExportFileName(), [
    hasFailureSubsetFilters,
    selectedActionFilter,
    selectedFailureReasonCode,
    selectedImportTask,
    selectedResourceTypeFilter,
  ]);
  const uploadedImportTask = useMemo(
    () =>
      uploadCompleted
        ? state?.importTasks.find((task) => task.id === uploadCompleted.uploadedTaskId) ?? null
        : null,
    [state?.importTasks, uploadCompleted],
  );
  const uploadComparisonSummary = useMemo(() => {
    if (!uploadCompleted) {
      return null;
    }

    if (!uploadedImportTask) {
      return null;
    }

    if (uploadedImportTask.status === "queued" || uploadedImportTask.status === "processing") {
      return null;
    }

    return buildUploadComparisonSummaryState({
      baselineItems: uploadCompleted.comparisonBaselineItems,
      currentItems: parseImportTaskFailedItems(uploadedImportTask),
    });
  }, [uploadedImportTask, uploadCompleted]);
  const currentFailureSubsetWorkOrder = useMemo(
    () =>
      buildFailureSubsetWorkOrderSummary({
        scopeLabel: currentFailureSubsetLabel,
        itemCount: filteredImportFailedItems.length,
        retrySnapshotCount: filteredFailureRetrySnapshotCount,
        topResourceType: topFilteredFailureResourceType,
        topAction: topFilteredFailureAction,
        suggestedAction: failureActionSuggestions[0] ?? null,
        suggestedExportFileName,
        currentUrl: currentViewUrl,
      }),
    [
      currentFailureSubsetLabel,
      currentViewUrl,
      failureActionSuggestions,
      filteredFailureRetrySnapshotCount,
      filteredImportFailedItems.length,
      suggestedExportFileName,
      topFilteredFailureAction,
      topFilteredFailureResourceType,
    ],
  );
  const currentFailureSubsetBatchEntries = useMemo(
    () =>
      projectId
        ? buildFailureSubsetBatchEntries({
            projectId,
            statusFilter,
            failureReasonCode: selectedFailureReasonCode,
            failureResourceType: selectedResourceTypeFilter,
            failureAction: selectedActionFilter,
            failedItems: filteredImportFailedItems,
          })
        : [],
    [
      filteredImportFailedItems,
      projectId,
      selectedActionFilter,
      selectedFailureReasonCode,
      selectedResourceTypeFilter,
      statusFilter,
    ],
  );
  const retryContextParams = useMemo(() => {
    return buildJobStatusReturnParams({
      target: "inbox",
      failureReasonCode: selectedFailureReasonCode,
    });
  }, [selectedFailureReasonCode]);
  const projectReturnParams = useMemo(() => {
    return buildJobStatusReturnParams({
      target: "project",
      failureReasonCode: selectedFailureReasonCode,
    });
  }, [selectedFailureReasonCode]);

  useEffect(() => {
    const rawFailureReason = searchParams.get("failureReason");
    if (!rawFailureReason || rawFailureReason === selectedFailureReasonCode) {
      return;
    }

    const next = new URLSearchParams(searchParams);
    next.delete("failureReason");
    setSearchParams(next, { replace: true });
  }, [searchParams, selectedFailureReasonCode, setSearchParams]);

  useEffect(() => {
    const rawFailedLine = searchParams.get("failedLine");
    if (!rawFailedLine) {
      return;
    }

    if (
      selectedFailedLine &&
      filteredImportFailedItems.some((item) => item.lineNo === selectedFailedLine)
    ) {
      return;
    }

    const next = new URLSearchParams(searchParams);
    next.delete("failedLine");
    setSearchParams(next, { replace: true });
  }, [filteredImportFailedItems, searchParams, selectedFailedLine, setSearchParams]);

  useEffect(() => {
    const rawResourceType = searchParams.get("failureResourceType");
    if (!rawResourceType) {
      return;
    }

    if (!selectedImportTask) {
      return;
    }

    const isValid = filteredFailureResourceSummary.some((item) => item.label === rawResourceType);
    if (isValid) {
      return;
    }

    const next = new URLSearchParams(searchParams);
    next.delete("failureResourceType");
    next.delete("failedLine");
    setSearchParams(next, { replace: true });
  }, [filteredFailureResourceSummary, searchParams, selectedImportTask, setSearchParams]);

  useEffect(() => {
    const rawAction = searchParams.get("failureAction");
    if (!rawAction) {
      return;
    }

    if (!selectedImportTask) {
      return;
    }

    const isValid = filteredFailureActionSummary.some((item) => item.label === rawAction);
    if (isValid) {
      return;
    }

    const next = new URLSearchParams(searchParams);
    next.delete("failureAction");
    next.delete("failedLine");
    setSearchParams(next, { replace: true });
  }, [filteredFailureActionSummary, searchParams, selectedImportTask, setSearchParams]);

  useEffect(() => {
    setCopyMessage(null);
    setCopyMessageReason(null);
    setDownloadMessage(null);
    setDownloadMessageReason(null);
  }, [selectedFailureReasonCode]);

  useEffect(() => {
    if (!copyMessage && !downloadMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCopyMessage(null);
      setCopyMessageReason(null);
      setCopiedLinkPath(null);
      setDownloadMessage(null);
      setDownloadMessageReason(null);
    }, 2500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [copyMessage, downloadMessage]);

  useEffect(() => {
    setRecentCopiedLink(readRecentProcessingLink(projectId));
  }, [projectId]);

  useEffect(() => {
    if (!selectedFailureReasonCode || !selectedImportTask) {
      return;
    }

    const hasMatchedReason = selectedImportFailureSummary.some(
      (item) => item.reasonCode === selectedFailureReasonCode,
    );

    if (hasMatchedReason) {
      return;
    }

    const next = new URLSearchParams(searchParams);
    next.delete("failureReason");
    setSearchParams(next, { replace: true });
  }, [
    searchParams,
    selectedFailureReasonCode,
    selectedImportTask,
    selectedImportFailureSummary,
    setSearchParams,
  ]);

  function setFailureReasonFilter(reasonCode: string | null) {
    setSearchParams(
      buildNextJobStatusSearchParams({
        currentSearch: searchParams,
        action: "setFailureReason",
        value: reasonCode,
      }),
    );
  }

  function setFailureResourceTypeFilter(resourceType: string | null) {
    setSearchParams(
      buildNextJobStatusSearchParams({
        currentSearch: searchParams,
        action: "setFailureResourceType",
        value: resourceType,
      }),
    );
  }

  function setFailureActionFilter(action: string | null) {
    setSearchParams(
      buildNextJobStatusSearchParams({
        currentSearch: searchParams,
        action: "setFailureAction",
        value: action,
      }),
    );
  }

  function clearFailureSubfilters() {
    setSearchParams(
      buildNextJobStatusSearchParams({
        currentSearch: searchParams,
        action: "clearFailureSubfilters",
      }),
    );
  }

  function buildCurrentViewUrl() {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    return buildCurrentJobStatusViewUrl({
      origin,
      projectId,
      statusFilter,
      failureReasonCode: selectedFailureReasonCode,
      failureResourceType: selectedResourceTypeFilter,
      failureAction: selectedActionFilter,
      failedLine: selectedFailedLine,
    });
  }

  function buildSuggestedExportFileName() {
    return buildSuggestedErrorReportFileName({
      importTaskId: selectedImportTask?.id,
      failureReasonCode: selectedFailureReasonCode,
      failureResourceType: selectedResourceTypeFilter,
      failureAction: selectedActionFilter,
      hasFailureSubsetFilters,
    });
  }

  function setFailedItemFocus(lineNo: number | null) {
    setSearchParams(
      buildNextJobStatusSearchParams({
        currentSearch: searchParams,
        action: "setFailedLine",
        value: lineNo,
      }),
    );
  }

  async function loadJobs(options?: {
    preferredImportTaskId?: string | null;
    preferredJobId?: string | null;
  }) {
    if (!projectId) {
      setError("项目标识缺失，无法加载任务状态。");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [workspace, importTasks, jobs] = await Promise.all([
        apiClient.getProjectWorkspace(projectId),
        apiClient.listProjectImportTasks(projectId),
        apiClient.listProjectBackgroundJobs(projectId, {
          status: statusFilter === "all" ? undefined : statusFilter,
        }),
      ]);

      setState({
        workspace,
        importTasks: importTasks.items,
        jobs: jobs.items,
      });
      const selection = resolveJobStatusSelection({
        importTasks: importTasks.items,
        jobs: jobs.items,
        focusedImportTaskId,
        focusedJobId,
        selectedImportTaskId,
        selectedJobId,
        preferredImportTaskId: options?.preferredImportTaskId,
        preferredJobId: options?.preferredJobId,
      });

      setSelectedImportTaskId(selection.selectedImportTaskId);
      setSelectedJobId(selection.selectedJobId);
    } catch (fetchError) {
      setError(
        fetchError instanceof ApiError
          ? fetchError.message
          : "任务状态加载失败，请检查 API 连通性。",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadJobs();
  }, [focusedImportTaskId, focusedJobId, projectId, statusFilter]);

  async function retryJob() {
    if (!selectedJob || selectedJob.status !== "failed") {
      return;
    }

    setRetrying(true);
    setError(null);

    try {
      const retryContext = canRetryCurrentFailureScope
        ? {
            failureReason: selectedFailureReasonCode,
            failureResourceType: selectedResourceTypeFilter,
            failureAction: selectedActionFilter,
          }
        : undefined;
      const retriedJob = await apiClient.retryBackgroundJob(selectedJob.id, {
        failureReason: retryContext?.failureReason,
        failureResourceType: retryContext?.failureResourceType,
        failureAction: retryContext?.failureAction,
      });
      setRetryCompleted(true);
      await loadJobs({
        preferredImportTaskId: selectedImportTask?.id ?? null,
        preferredJobId:
          retriedJob && typeof retriedJob === "object" && "id" in retriedJob
            ? String(retriedJob.id)
            : selectedJob.id,
      });
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.code === "IMPORT_TASK_RETRY_INPUT_INCOMPLETE"
            ? RETRY_INPUT_INCOMPLETE_ERROR_MESSAGE
            : submitError.message
          : "任务重试失败，请稍后重试。",
      );
    } finally {
      setRetrying(false);
    }
  }

  async function uploadImportFile() {
    if (!projectId || !uploadFileName.trim() || !uploadFileContent.trim()) {
      setError("请选择导入文件并确认文件内容已读取。");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const { returnToFailurePath, returnToFailureLabel } =
        buildUploadReturnToFailureContext({
          projectId,
          search: searchParams,
          selectedImportTask,
          failureReasonCode: selectedFailureReasonCode,
          currentFailureSubsetLabel,
        });
      const result = await apiClient.uploadProjectImportFile({
        projectId,
        fileName: uploadFileName.trim(),
        fileContent: uploadFileContent,
        sourceType: "file_upload",
        sourceLabel: `文件导入：${uploadFileName.trim()}`,
      });
      setUploadCompleted({
        fileName: uploadFileName.trim(),
        eventCount: result.eventCount,
        uploadedTaskId: result.task.id,
        uploadedTaskLabel: `${uploadFileName.trim()} · ${result.task.id}`,
        returnToFailurePath,
        returnToFailureLabel,
        comparisonBaselineItems:
          selectedImportTask?.status === "failed" ? filteredImportFailedItems : [],
      });
      setUploadCallout(null);
      setSelectedImportTaskId(result.task.id);
      setUploadFileName("");
      setUploadFileContent("");
      await loadJobs({
        preferredImportTaskId: result.task.id,
        preferredJobId: result.job.id,
      });
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : "导入文件上传失败，请稍后重试。",
      );
    } finally {
      setUploading(false);
    }
  }

  async function copyCurrentFilterLink() {
    if (typeof window === "undefined" || !window.navigator?.clipboard?.writeText) {
      setError("当前环境不支持复制链接，请手动复制地址栏。");
      return;
    }

    try {
      const url = new URL(window.location.href);
      url.search = searchParams.toString();
      await window.navigator.clipboard.writeText(url.toString());
      const recentLinkInput = buildRecentJobStatusProcessingLinkInput({
        projectId: projectId ?? "",
        search: searchParams,
        label: "任务状态筛选视角",
        collaborationUnitLabel: currentFailureSubsetLabel,
        batchEntries: currentFailureSubsetBatchEntries,
        selectedFailedItem,
      });
      setCopyMessage("已复制当前筛选链接，可直接发给协作同事。");
      setCopiedLinkPath(recentLinkInput.path);
      setCopyMessageReason(
        selectedFailureReasonCode && selectedFailureReasonLabel
          ? {
              code: selectedFailureReasonCode,
              label: selectedFailureReasonLabel,
            }
          : null,
      );
      setRecentCopiedLink(saveRecentProcessingLink(recentLinkInput));
      setError(null);
    } catch {
      setError("筛选链接复制失败，请稍后重试。");
    }
  }

  async function copyCurrentProcessingLink() {
    if (typeof window === "undefined" || !window.navigator?.clipboard?.writeText) {
      setError("当前环境不支持复制链接，请手动复制地址栏。");
      return;
    }

    try {
      const recentLinkInput = buildRecentJobStatusProcessingLinkInput({
        projectId: projectId ?? "",
        search: searchParams,
        label: "任务状态处理入口",
        collaborationUnitLabel: currentFailureSubsetLabel,
        batchEntries: currentFailureSubsetBatchEntries,
        selectedFailedItem,
      });
      await window.navigator.clipboard.writeText(buildCurrentViewUrl());
      setCopyMessage("已复制当前处理链接，可直接发给协作同事。");
      setCopiedLinkPath(recentLinkInput.path);
      setCopyMessageReason(
        selectedFailureReasonCode && selectedFailureReasonLabel
          ? {
              code: selectedFailureReasonCode,
              label: selectedFailureReasonLabel,
            }
          : null,
      );
      setRecentCopiedLink(saveRecentProcessingLink(recentLinkInput));
      setError(null);
    } catch {
      setError("处理链接复制失败，请稍后重试。");
    }
  }

  async function copyCurrentFailureSubsetWorkOrder() {
    if (typeof window === "undefined" || !window.navigator?.clipboard?.writeText) {
      setError("当前环境不支持复制处理单，请手动复制页面内容。");
      return;
    }

    try {
      await window.navigator.clipboard.writeText(currentFailureSubsetWorkOrder);
      setCopyMessage("已复制当前失败子集处理单，可直接作为协作处理单元转交。");
      setCopiedLinkPath(
        `/projects/${projectId}/jobs${searchParams.toString() ? `?${searchParams.toString()}` : ""}`,
      );
      setCopyMessageReason(
        selectedFailureReasonCode && selectedFailureReasonLabel
          ? {
              code: selectedFailureReasonCode,
              label: selectedFailureReasonLabel,
            }
          : null,
      );
      setError(null);
    } catch {
      setError("处理单复制失败，请稍后重试。");
    }
  }

  async function copyTeamHandoffSummary() {
    if (typeof window === "undefined" || !window.navigator?.clipboard?.writeText) {
      setError("当前环境不支持复制摘要，请手动复制页面内容。");
      return;
    }

    try {
      await window.navigator.clipboard.writeText(
        buildTeamHandoffSummary({
          scopeLabel: currentFailureSubsetLabel,
          itemCount: filteredImportFailedItems.length,
          missingFieldCount: filteredFailureMissingFieldCount,
          previewCount: filteredFailurePreviewCount,
          retrySnapshotCount: filteredFailureRetrySnapshotCount,
          topResourceType: topFilteredFailureResourceType,
          topAction: topFilteredFailureAction,
          suggestions: failureActionSuggestions,
          currentUrl: buildCurrentViewUrl(),
        }),
      );
      setCopyMessage("已复制协作同事版处理摘要，可直接发给当前跟进同事。");
      setCopiedLinkPath(null);
      setCopyMessageReason(
        selectedFailureReasonCode && selectedFailureReasonLabel
          ? {
              code: selectedFailureReasonCode,
              label: selectedFailureReasonLabel,
            }
          : null,
      );
      setError(null);
    } catch {
      setError("处理摘要复制失败，请稍后重试。");
    }
  }

  async function copyUpstreamHandoffSummary() {
    if (typeof window === "undefined" || !window.navigator?.clipboard?.writeText) {
      setError("当前环境不支持复制摘要，请手动复制页面内容。");
      return;
    }

    try {
      await window.navigator.clipboard.writeText(
        buildUpstreamHandoffSummary({
          scopeLabel: currentFailureSubsetLabel,
          itemCount: filteredImportFailedItems.length,
          missingFieldCount: filteredFailureMissingFieldCount,
          previewCount: filteredFailurePreviewCount,
          retrySnapshotCount: filteredFailureRetrySnapshotCount,
          topResourceType: topFilteredFailureResourceType,
          topAction: topFilteredFailureAction,
          suggestions: failureActionSuggestions,
          currentUrl: buildCurrentViewUrl(),
          suggestedExportFileName: buildSuggestedExportFileName(),
        }),
      );
      setCopyMessage("已复制上游数据方版处理摘要，可直接发给上游排查。");
      setCopiedLinkPath(null);
      setCopyMessageReason(
        selectedFailureReasonCode && selectedFailureReasonLabel
          ? {
              code: selectedFailureReasonCode,
              label: selectedFailureReasonLabel,
            }
          : null,
      );
      setError(null);
    } catch {
      setError("处理摘要复制失败，请稍后重试。");
    }
  }

  function getErrorReportActionKey(scope: ErrorReportScope, format: ErrorReportFormat) {
    return buildErrorReportActionKey(scope, format);
  }

  function isDownloadingErrorReport(scope: ErrorReportScope, format: ErrorReportFormat) {
    return downloadingErrorReports.includes(getErrorReportActionKey(scope, format));
  }

  function downloadCurrentSubsetLocally(format: ErrorReportFormat) {
    if (!selectedImportTask) {
      return;
    }

    triggerClientDownload({
      ...buildFailureSubsetDownload({
        taskId: selectedImportTask.id,
        format,
        failureReasonCode: selectedFailureReasonCode,
        failureResourceType: selectedResourceTypeFilter,
        failureAction: selectedActionFilter,
        failedItems: filteredImportFailedItems,
      }),
    });
  }

  async function downloadErrorReport(options?: {
    format?: ErrorReportFormat;
    scope?: ErrorReportScope;
  }) {
    if (!projectId || !selectedImportTask) {
      return;
    }

    const scope = options?.scope ?? "filtered";
    const format = options?.format ?? "json";
    const actionKey = getErrorReportActionKey(scope, format);
    if (downloadingErrorReports.includes(actionKey)) {
      return;
    }
    if (scope === "filtered" && filteredImportFailedItems.length === 0) {
      setError(null);
      setDownloadMessage("当前筛选下没有失败条目，已跳过导出。");
      setDownloadMessageReason(null);
      return;
    }

    setDownloadingErrorReports((current) => [...current, actionKey]);
    try {
      if (scope === "filtered" && hasFailureSubsetFilters) {
        downloadCurrentSubsetLocally(format);
      } else {
        const failureReason = scope === "all" ? undefined : selectedFailureReasonCode;
        await apiClient.downloadImportTaskErrorReport(
          projectId,
          selectedImportTask.id,
          failureReason,
          format,
        );
      }
      setError(null);
      if (scope === "all") {
        setLastDownloadedScopeLabel("全部失败条目");
        setDownloadMessage(`已导出整批失败条目（${format.toUpperCase()}）。`);
        setDownloadMessageReason(
          selectedFailureReasonCode && selectedFailureReasonLabel
            ? {
                code: selectedFailureReasonCode,
                label: selectedFailureReasonLabel,
              }
            : null,
        );
      } else {
        setLastDownloadedScopeLabel(currentFailureSubsetLabel);
        setDownloadMessage(
          `已导出当前${hasFailureSubsetFilters ? "子集" : "筛选"}（${currentFailureSubsetLabel}，${format.toUpperCase()}）。`,
        );
        setDownloadMessageReason(
          selectedFailureReasonCode && selectedFailureReasonLabel
            ? {
                code: selectedFailureReasonCode,
                label: selectedFailureReasonLabel,
              }
            : null,
        );
      }
    } catch (downloadError) {
      setError(
        downloadError instanceof ApiError
          ? downloadError.message
          : "错误报告下载失败，请稍后重试。",
      );
    } finally {
      setDownloadingErrorReports((current) =>
        current.filter((item) => item !== actionKey),
      );
    }
  }

  function jumpToUploadSection() {
    const scopeLabel = lastDownloadedScopeLabel ?? "当前失败范围";
    setUploadCallout(
      `已定位到上传区。修复“${scopeLabel}”后，可直接上传新的 JSON/JSONL 文件重新导入。`,
    );
    if (typeof uploadSectionRef.current?.scrollIntoView === "function") {
      uploadSectionRef.current.scrollIntoView({
        block: "start",
        inline: "nearest",
      });
    }
  }

  if (loading) {
    return <LoadingState title="正在加载任务状态" />;
  }

  if (error && !state) {
    return (
      <ErrorState
        title="任务状态暂时不可用"
        body={error}
        onRetry={() => {
          void loadJobs();
        }}
      />
    );
  }

  if (!state || !projectId) {
    return (
      <EmptyState title="任务状态为空" body="还没有拿到任务状态数据，请稍后重试。" />
    );
  }

  const breadcrumbs = buildProjectVersionBreadcrumbs({
    currentLabel: "任务状态页",
    projectId,
    projectName: state.workspace.project.name,
    versionLabel: "导入与任务状态",
  });

  return (
    <div className="page-stack">
      <AppBreadcrumbs items={breadcrumbs} />

      <header className="page-header">
        <div>
          <p className="app-eyebrow">{state.workspace.project.code}</p>
          <h2 className="page-title">任务状态页</h2>
          <p className="page-description">
            从项目工作台继续跟进导入和异步任务，先看失败原因，再决定是否重试。
          </p>
        </div>
      </header>

      {error ? (
        <ErrorState
          actions={
            isRetryInputIncompleteError ? (
              <>
                <button
                  className="connection-button primary"
                  disabled={isDownloadingErrorReport(
                    selectedFailureReasonCode ? "filtered" : "all",
                    "json",
                  )}
                  onClick={() => {
                    void downloadErrorReport({
                      format: "json",
                      scope: selectedFailureReasonCode ? "filtered" : "all",
                    });
                  }}
                  type="button"
                >
                  {selectedFailureReasonCode
                    ? hasFailureSubsetFilters
                      ? "先导出当前子集（JSON）"
                      : "先导出当前筛选（JSON）"
                    : "先导出整批失败条目（JSON）"}
                </button>
                <button
                  className="connection-button secondary"
                  onClick={() => {
                    setError(null);
                  }}
                  type="button"
                >
                  继续查看当前失败范围
                </button>
              </>
            ) : undefined
          }
          body={error}
        />
      ) : null}

      <ProjectJobStatusUploadSection
        onClearUploadCompleted={() => {
          setUploadCompleted(null);
        }}
        onFileSelected={({ fileName, content }) => {
          setUploadFileName(fileName);
          setUploadFileContent(content);
        }}
        onUpload={() => {
          void uploadImportFile();
        }}
        uploadCallout={uploadCallout}
        uploadComparisonSummary={uploadComparisonSummary}
        uploadCompleted={uploadCompleted}
        uploadFileContent={uploadFileContent}
        uploadFileName={uploadFileName}
        uploading={uploading}
        uploadSectionRef={uploadSectionRef}
      />

      <ProjectJobStatusFilterSection
        onStatusFilterChange={(filter) => {
          const next = new URLSearchParams(searchParams);
          if (filter === "all") {
            next.delete("status");
          } else {
            next.set("status", filter);
          }
          setSearchParams(next);
        }}
        statusFilter={statusFilter}
      />

      <section className="detail-grid">
        <ProjectJobStatusImportTaskList
          importTasks={state.importTasks}
          jobs={state.jobs}
          onSelectImportTask={setSelectedImportTaskId}
          onSelectJob={setSelectedJobId}
          selectedImportTask={selectedImportTask}
        />

        <article className={`panel ${selectedImportTask ? "panel-focus" : ""}`}>
          <h3>批次详情</h3>
          {selectedImportTask ? (
            <div className="page-stack">
              <p className="page-description">
                {selectedImportTask.sourceLabel} ·{" "}
                {formatImportStatus(selectedImportTask.status)}
              </p>
              <p className="page-description">
                来源 {formatImportSource(selectedImportTask.sourceType)} · 格式{" "}
                {formatDetectedFormat(selectedImportTask)}
              </p>
              <p className="page-description">
                文件 {selectedImportTask.sourceFileName ?? "未提供"} · 批次{" "}
                {selectedImportTask.sourceBatchNo ?? "系统未分配"}
              </p>
              <p className="page-description">
                总条目 {selectedImportTask.totalItemCount} · 已导入{" "}
                {selectedImportTask.importedItemCount} · 记忆{" "}
                {selectedImportTask.memoryItemCount} · 失败{" "}
                {selectedImportTask.failedItemCount}
              </p>
              <p className="page-description">
                重试 {selectedImportTask.retryCount}/{selectedImportTask.retryLimit} ·{" "}
                {selectedImportTask.canRetry ? "仍可重试" : "已达到重试上限"}
              </p>
              <p className="page-description">
                关联任务：{selectedImportTask.latestJobId ?? "待生成"}
              </p>
              <p className="page-description">
                最近错误：{selectedImportTask.latestErrorMessage ?? "当前没有错误信息"}
              </p>
              {selectedImportTask.failureDetails.length > 0 ? (
                <ul className="inline-list">
                  {selectedImportTask.failureDetails.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              ) : (
                <p className="page-description">当前没有失败明细。</p>
              )}
              {selectedImportSummary ? (
                <div className="project-list">
                  <article className="project-link selected">
                    <h3>解析概览</h3>
                    <p className="page-description">
                      共 {selectedImportSummary.totalEventCount} 条事件 · 资源类型{" "}
                      {selectedImportSummary.resourceTypes.join(" / ") || "未识别"} · 动作{" "}
                      {selectedImportSummary.actions.join(" / ") || "未识别"}
                    </p>
                    <p className="page-description">
                      字段：{selectedImportSummary.fieldKeys.join("、") || "系统未记录"}
                    </p>
                    <p className="page-description">
                      缺少 projectId：{selectedImportSummary.missingProjectIdCount} 条 · 缺少
                      action：{selectedImportSummary.missingActionCount} 条
                    </p>
                  </article>
                </div>
              ) : null}
              {selectedImportPreviewItems.length > 0 ? (
                <div className="project-list">
                  <article className="project-link selected">
                    <h3>条目预览</h3>
                    <ul className="inline-list">
                      {selectedImportPreviewItems.map((item) => (
                        <li
                          key={`${item.lineNo ?? "line"}-${item.projectId ?? "project"}-${
                            item.action ?? "action"
                          }`}
                        >
                          第 {item.lineNo ?? "-"} 条 · 项目 {item.projectId ?? "未提供"} · 资源{" "}
                          {item.resourceType ?? "未提供"} · 动作 {item.action ?? "未提供"} · 字段{" "}
                          {item.keys.join("、") || "未记录"}
                        </li>
                      ))}
                    </ul>
                  </article>
                </div>
              ) : null}
              {selectedImportFailureSummary.length > 0 ? (
                <div className="project-list">
                  <article className="project-link selected">
                    <h3>失败原因归类</h3>
                    {selectedFailureReasonLabel ? (
                      <p className="page-description">
                        当前协作视角：{selectedFailureReasonLabel}
                      </p>
                    ) : null}
                    <p className="page-description">
                      {selectedFailureReasonLabel
                        ? hasFailureSubsetFilters
                          ? `导出当前子集将包含：${currentFailureSubsetLabel}；导出整批将包含：全部失败条目。`
                          : `导出当前筛选将包含：${selectedFailureReasonLabel}；导出整批将包含：全部失败条目。`
                        : "当前可导出范围：全部失败条目。"}
                    </p>
                    {selectedFailureReasonCode ? (
                      <div>
                        <p className="page-description">
                          {hasFailureSubsetFilters ? "导出当前子集" : "导出当前筛选"}
                        </p>
                        <div className="version-card-actions">
                          <button
                            className="connection-button secondary"
                            disabled={isDownloadingErrorReport("filtered", "json")}
                            onClick={() => {
                              void downloadErrorReport({
                                format: "json",
                                scope: "filtered",
                              });
                            }}
                            type="button"
                          >
                            {isDownloadingErrorReport("filtered", "json")
                              ? "导出中"
                              : hasFailureSubsetFilters
                                ? "导出当前子集（JSON）"
                                : "导出当前筛选（JSON）"}
                          </button>
                          <button
                            className="connection-button secondary"
                            disabled={isDownloadingErrorReport("filtered", "csv")}
                            onClick={() => {
                              void downloadErrorReport({
                                format: "csv",
                                scope: "filtered",
                              });
                            }}
                            type="button"
                          >
                            {isDownloadingErrorReport("filtered", "csv")
                              ? "导出中"
                              : hasFailureSubsetFilters
                                ? "导出当前子集（CSV）"
                                : "导出当前筛选（CSV）"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <div>
                      <p className="page-description">导出整批失败条目</p>
                      <div className="version-card-actions">
                        <button
                          className="connection-button secondary"
                          disabled={isDownloadingErrorReport("all", "json")}
                          onClick={() => {
                            void downloadErrorReport({
                              format: "json",
                              scope: "all",
                            });
                          }}
                          type="button"
                        >
                          {isDownloadingErrorReport("all", "json")
                            ? "导出中"
                            : "导出整批（JSON）"}
                        </button>
                        <button
                          className="connection-button secondary"
                          disabled={isDownloadingErrorReport("all", "csv")}
                          onClick={() => {
                            void downloadErrorReport({
                              format: "csv",
                              scope: "all",
                            });
                          }}
                          type="button"
                        >
                          {isDownloadingErrorReport("all", "csv")
                            ? "导出中"
                            : "导出整批（CSV）"}
                        </button>
                      </div>
                    </div>
                    <div className="version-card-actions">
                      <button
                        className="connection-button secondary"
                        onClick={() => {
                          void copyCurrentFilterLink();
                        }}
                        type="button"
                      >
                        复制当前筛选链接
                      </button>
                      {selectedFailureReasonCode ? (
                        <button
                          className="connection-button secondary"
                          onClick={() => {
                            setFailureReasonFilter(null);
                          }}
                          type="button"
                        >
                          清除协作视角
                        </button>
                      ) : null}
                      <button
                        className={
                          selectedFailureReasonCode === null
                            ? "connection-button primary"
                            : "connection-button secondary"
                        }
                        onClick={() => {
                          setFailureReasonFilter(null);
                        }}
                        type="button"
                      >
                        查看全部失败条目
                      </button>
                    </div>
                    <ul className="inline-list">
                      {selectedImportFailureSummary.map((item) => (
                        <li key={item.reasonCode}>
                          <button
                            className={
                              item.reasonCode === selectedFailureReasonCode
                                ? "connection-button primary"
                                : "connection-button secondary"
                            }
                            onClick={() => {
                              setFailureReasonFilter(item.reasonCode);
                            }}
                            type="button"
                          >
                            {item.reasonLabel} · {item.count} 条
                          </button>
                        </li>
                      ))}
                    </ul>
                    {copyMessage ? (
                      <div className="version-card-actions">
                        <p className="page-description">{copyMessage}</p>
                        {copiedLinkPath ? (
                          <Link className="breadcrumbs-link" to={copiedLinkPath}>
                            打开刚复制入口
                          </Link>
                        ) : null}
                        {copyMessageReason ? (
                          <button
                            className="connection-button secondary"
                            onClick={() => {
                              setFailureReasonFilter(copyMessageReason.code);
                            }}
                            type="button"
                          >
                            继续查看当前筛选
                          </button>
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
                    {downloadMessage ? (
                      <div className="version-card-actions">
                        <p className="page-description">{downloadMessage}</p>
                        <button
                          className="connection-button secondary"
                          onClick={() => {
                            jumpToUploadSection();
                          }}
                          type="button"
                        >
                          去重新导入修复文件
                        </button>
                        {downloadMessageReason ? (
                          <button
                            className="connection-button secondary"
                            onClick={() => {
                              setFailureReasonFilter(downloadMessageReason.code);
                            }}
                            type="button"
                          >
                            {`继续查看${downloadMessageReason.label}`}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                </div>
              ) : null}
              {filteredImportFailedItems.length > 0 ? (
                <div className="project-list">
                  <article className="project-link selected">
                    <h3>当前筛选运营摘要</h3>
                    <p className="page-description">
                      当前范围：{selectedFailureReasonLabel ?? "全部失败条目"} · 共{" "}
                      {filteredImportFailedItems.length} 条
                    </p>
                    {(selectedResourceTypeFilter || selectedActionFilter) ? (
                      <p className="page-description">
                        当前收束：
                        {selectedResourceTypeFilter
                          ? `资源 ${selectedResourceTypeFilter}`
                          : "资源未收束"}
                        {" · "}
                        {selectedActionFilter ? `动作 ${selectedActionFilter}` : "动作未收束"}
                      </p>
                    ) : null}
                    <p className="page-description">
                      缺字段相关：{filteredFailureMissingFieldCount} 条 · 可回看原始预览：
                      {filteredFailurePreviewCount} 条 · 可重建快照：
                      {filteredFailureRetrySnapshotCount} 条
                    </p>
                    <div className="page-description">资源类型分布：</div>
                    <div className="version-card-actions">
                      {filteredFailureResourceSummary.map((item) => (
                        <button
                          className={
                            item.label === selectedResourceTypeFilter
                              ? "connection-button primary"
                              : "connection-button secondary"
                          }
                          key={`resource-${item.label}`}
                          onClick={() => {
                            setFailureResourceTypeFilter(
                              item.label === selectedResourceTypeFilter ? null : item.label,
                            );
                          }}
                          type="button"
                        >
                          {item.label} · {item.count} 条
                        </button>
                      ))}
                    </div>
                    <div className="page-description">动作分布：</div>
                    <div className="version-card-actions">
                      {filteredFailureActionSummary.map((item) => (
                        <button
                          className={
                            item.label === selectedActionFilter
                              ? "connection-button primary"
                              : "connection-button secondary"
                          }
                          key={`action-${item.label}`}
                          onClick={() => {
                            setFailureActionFilter(
                              item.label === selectedActionFilter ? null : item.label,
                            );
                          }}
                          type="button"
                        >
                          {item.label} · {item.count} 条
                        </button>
                      ))}
                    </div>
                    <div className="version-card-actions">
                      <button
                        className="connection-button secondary"
                        onClick={() => {
                          void copyCurrentProcessingLink();
                        }}
                        type="button"
                      >
                        复制当前处理链接
                      </button>
                      <button
                        className={
                          !selectedResourceTypeFilter && !selectedActionFilter
                            ? "connection-button primary"
                            : "connection-button secondary"
                        }
                        onClick={() => {
                          clearFailureSubfilters();
                        }}
                        type="button"
                      >
                        查看当前原因下全部条目
                      </button>
                    </div>
                  </article>
                </div>
              ) : null}
              {failureActionSuggestions.length > 0 ? (
                <div className="project-list">
                  <article className="project-link selected">
                    <h3>批量动作建议</h3>
                    <p className="page-description">
                      基于当前范围“{currentFailureSubsetLabel}”的轻量建议，先帮助判断下一步怎么处理。
                    </p>
                    <div className="version-card-actions">
                      <button
                        className="connection-button secondary"
                        onClick={() => {
                          void copyTeamHandoffSummary();
                        }}
                        type="button"
                      >
                        复制给协作同事
                      </button>
                      <button
                        className="connection-button secondary"
                        onClick={() => {
                          void copyUpstreamHandoffSummary();
                        }}
                        type="button"
                      >
                        复制给上游数据方
                      </button>
                    </div>
                    <ul className="inline-list">
                      {failureActionSuggestions.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </article>
                </div>
              ) : null}
              {selectedFailureReasonCode && filteredImportFailedItems.length > 0 ? (
                <div className="project-list">
                  <article className="project-link selected">
                    <h3>当前失败子集处理单</h3>
                    <p className="page-description">
                      建议将当前子集作为一个独立处理单元交接，避免再次口头解释范围。
                    </p>
                    <p className="page-description">处理范围：{currentFailureSubsetLabel}</p>
                    <p className="page-description">
                      失败条目：{filteredImportFailedItems.length} 条
                    </p>
                    <p className="page-description">
                      可重建快照：{filteredFailureRetrySnapshotCount} 条
                    </p>
                    <p className="page-description">
                      主要资源类型：{topFilteredFailureResourceType ?? "未识别"}
                    </p>
                    <p className="page-description">
                      主要动作：{topFilteredFailureAction ?? "未识别"}
                    </p>
                    {failureActionSuggestions[0] ? (
                      <p className="page-description">建议动作：{failureActionSuggestions[0]}</p>
                    ) : null}
                    {suggestedExportFileName ? (
                      <p className="page-description">
                        建议导出文件：{suggestedExportFileName}
                      </p>
                    ) : null}
                    <p className="page-description">处理链接：{currentViewUrl}</p>
                    <div className="version-card-actions">
                      <button
                        className="connection-button secondary"
                        onClick={() => {
                          void copyCurrentFailureSubsetWorkOrder();
                        }}
                        type="button"
                      >
                        复制当前处理单
                      </button>
                    </div>
                  </article>
                </div>
              ) : null}
              {selectedImportFailedItems.length > 0 ? (
                <div className="project-list">
                  <article className="project-link selected">
                    <h3>失败条目</h3>
                    {selectedFailureReasonLabel ? (
                      <p className="page-description">
                        当前筛选：{selectedFailureReasonLabel}
                      </p>
                    ) : null}
                    {selectedFailedItem ? (
                      <div className="version-card-actions">
                        <p className="page-description">
                          当前定位：第 {selectedFailedItem.lineNo ?? "-"} 条 ·{" "}
                          {selectedFailedItem.reasonLabel}
                        </p>
                        <button
                          className="connection-button secondary"
                          onClick={() => {
                            setFailedItemFocus(null);
                          }}
                          type="button"
                        >
                          取消单条定位
                        </button>
                      </div>
                    ) : (
                      <p className="page-description">
                        可点击任一失败条目进入单条回看，复制链接时会保留当前定位。
                      </p>
                    )}
                    <ul className="inline-list">
                      {filteredImportFailedItems.map((item, index) => (
                        <li
                          key={`${item.lineNo ?? index}-${item.reasonCode}-${item.errorMessage}`}
                        >
                          <button
                            className={
                              item.lineNo === selectedFailedItem?.lineNo
                                ? "connection-button primary"
                                : "connection-button secondary"
                            }
                            onClick={() => {
                              setFailedItemFocus(item.lineNo ?? null);
                            }}
                            type="button"
                          >
                            第 {item.lineNo ?? "-"} 条 · {item.reasonLabel} · {item.errorMessage} ·
                            项目 {item.projectId ?? "未提供"} · 资源{" "}
                            {item.resourceType ?? "未提供"} · 动作 {item.action ?? "未提供"} ·
                            字段 {item.keys.join("、") || "未记录"}
                            {item.retryEventSnapshot ? " · 可重建快照已就绪" : ""}
                          </button>
                        </li>
                      ))}
                    </ul>
                    {selectedFailedItem ? (
                      <div className="project-list">
                        <article className="project-link selected">
                          <h3>单条回看</h3>
                          <p className="page-description">
                            当前进度：第 {selectedFailedItemIndex + 1} /{" "}
                            {filteredImportFailedItems.length} 条
                          </p>
                          <p className="page-description">
                            第 {selectedFailedItem.lineNo ?? "-"} 条 ·{" "}
                            {selectedFailedItem.reasonLabel}
                          </p>
                          <p className="page-description">
                            错误信息：{selectedFailedItem.errorMessage}
                          </p>
                          <p className="page-description">
                            项目 {selectedFailedItem.projectId ?? "未提供"} · 资源{" "}
                            {selectedFailedItem.resourceType ?? "未提供"} · 动作{" "}
                            {selectedFailedItem.action ?? "未提供"}
                          </p>
                          <p className="page-description">
                            相关字段：{selectedFailedItem.keys.join("、") || "未记录"}
                          </p>
                          <p className="page-description">
                            当前链接已保留该条定位，便于协作同事打开后直接回看同一条失败记录。
                          </p>
                          {selectedFailedItem.retryEventSnapshot ? (
                            <p className="page-description">
                              本条已具备可重建快照，可直接纳入当前子集重试。
                            </p>
                          ) : null}
                          <div className="version-card-actions">
                            <button
                              className="connection-button secondary"
                              onClick={() => {
                                void copyCurrentProcessingLink();
                              }}
                              type="button"
                            >
                              复制当前处理链接
                            </button>
                          </div>
                          {selectedPreviewItem ? (
                            <div className="project-list">
                              <article className="project-link selected">
                                <h3>原始条目预览</h3>
                                <p className="page-description">
                                  第 {selectedPreviewItem.lineNo ?? "-"} 条 · 项目{" "}
                                  {selectedPreviewItem.projectId ?? "未提供"} · 资源{" "}
                                  {selectedPreviewItem.resourceType ?? "未提供"} · 动作{" "}
                                  {selectedPreviewItem.action ?? "未提供"}
                                </p>
                                <p className="page-description">
                                  原始字段：{selectedPreviewItem.keys.join("、") || "未记录"}
                                </p>
                                <p className="page-description">
                                  失败条目字段：{selectedFailedItem.keys.join("、") || "未记录"}
                                </p>
                                <p className="page-description">
                                  缺少关键字段：
                                  {selectedFailedItemMissingKeys.join("、") || "未发现"}
                                </p>
                                <p className="page-description">
                                  仅原始条目存在的字段：
                                  {selectedFailedItemExtraPreviewKeys.join("、") || "未发现"}
                                </p>
                              </article>
                            </div>
                          ) : (
                            <p className="page-description">
                              当前批次没有保留这条失败记录的原始预览，暂时只能查看失败摘要。
                            </p>
                          )}
                          <div className="version-card-actions">
                            <button
                              className="connection-button secondary"
                              disabled={!previousFailedItem}
                              onClick={() => {
                                setFailedItemFocus(previousFailedItem?.lineNo ?? null);
                              }}
                              type="button"
                            >
                              上一条失败记录
                            </button>
                            <button
                              className="connection-button secondary"
                              disabled={!nextFailedItem}
                              onClick={() => {
                                setFailedItemFocus(nextFailedItem?.lineNo ?? null);
                              }}
                              type="button"
                            >
                              下一条失败记录
                            </button>
                            <button
                              className="connection-button secondary"
                              onClick={() => {
                                setFailedItemFocus(null);
                              }}
                              type="button"
                            >
                              返回失败列表
                            </button>
                          </div>
                        </article>
                      </div>
                    ) : null}
                  </article>
                </div>
              ) : null}
              {selectedImportRetryHistory.length > 0 ? (
                <div className="project-list">
                  <article className="project-link selected">
                    <h3>重试历史</h3>
                    <ul className="inline-list">
                      {selectedImportRetryHistory.map((item, index) => (
                        <li key={`${item.attempt ?? index}-${item.triggeredAt ?? index}`}>
                          第 {item.attempt ?? "-"} 次 · 由 {item.operatorId} 发起 · 来自状态{" "}
                          {item.previousStatus} · 时间{" "}
                          {item.triggeredAt ? formatProjectDateTime(item.triggeredAt) : "未记录"}
                        </li>
                      ))}
                    </ul>
                  </article>
                </div>
              ) : null}
              <label className="connection-label">
                批次元数据
                <textarea
                  aria-label="批次元数据"
                  className="connection-textarea"
                  readOnly
                  rows={8}
                  value={JSON.stringify(selectedImportTask.metadata, null, 2)}
                />
              </label>
            </div>
          ) : (
            <EmptyState
              title="选择一个批次"
              body="从左侧选择导入任务后，这里会展示批次详情和失败摘要。"
            />
          )}
        </article>
      </section>

      <ProjectJobStatusJobPanels
        canRetryCurrentFailureScope={canRetryCurrentFailureScope}
        canRetryCurrentFailureSubset={canRetryCurrentFailureSubset}
        currentFailureSubsetLabel={currentFailureSubsetLabel}
        hasFailureSubsetFilters={hasFailureSubsetFilters}
        importTasks={state.importTasks}
        jobs={state.jobs}
        onRetryJob={() => {
          void retryJob();
        }}
        onSelectImportTask={setSelectedImportTaskId}
        onSelectJob={setSelectedJobId}
        projectId={projectId}
        projectReturnParams={projectReturnParams}
        retryCompleted={retryCompleted}
        retryContextParams={retryContextParams}
        retrying={retrying}
        selectedFailureReasonLabel={selectedFailureReasonLabel}
        selectedJob={selectedJob}
        selectedJobMatchesImportTask={selectedJobMatchesImportTask}
      />
    </div>
  );
}
