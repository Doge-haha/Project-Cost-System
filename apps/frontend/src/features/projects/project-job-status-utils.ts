import type { BackgroundJob, ImportTask } from "../../lib/types";
import {
  buildFailureSubsetExportPayload,
  type ParsedImportTaskFailedItem,
} from "./import-task-failure-snapshots";
import type { RecentProcessingBatchEntry } from "./recent-processing-link";

export type JobStatusFilter = "all" | "queued" | "processing" | "completed" | "failed";
export type ErrorReportScope = "filtered" | "all";
export type ErrorReportFormat = "json" | "csv";

export function parseStatusFilter(value: string | null): JobStatusFilter {
  if (
    value === "queued" ||
    value === "processing" ||
    value === "completed" ||
    value === "failed"
  ) {
    return value;
  }
  return "all";
}

export function parseFailedLine(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function parseOptionalFilterValue(value: string | null): string | null {
  if (!value || value.length === 0) {
    return null;
  }

  return value;
}

export function buildNextJobStatusSearchParams(input: {
  currentSearch: string | URLSearchParams;
  action:
    | "setFailureReason"
    | "setFailureResourceType"
    | "setFailureAction"
    | "clearFailureSubfilters"
    | "setFailedLine";
  value?: string | number | null;
}) {
  const next = new URLSearchParams(input.currentSearch);
  if (input.action === "setFailureReason") {
    if (input.value) {
      next.set("failureReason", String(input.value));
    } else {
      next.delete("failureReason");
    }
    next.delete("failureResourceType");
    next.delete("failureAction");
    next.delete("failedLine");
    return next;
  }

  if (input.action === "setFailureResourceType") {
    if (input.value) {
      next.set("failureResourceType", String(input.value));
    } else {
      next.delete("failureResourceType");
    }
    next.delete("failedLine");
    return next;
  }

  if (input.action === "setFailureAction") {
    if (input.value) {
      next.set("failureAction", String(input.value));
    } else {
      next.delete("failureAction");
    }
    next.delete("failedLine");
    return next;
  }

  if (input.action === "setFailedLine") {
    if (input.value) {
      next.set("failedLine", String(input.value));
    } else {
      next.delete("failedLine");
    }
    return next;
  }

  next.delete("failureResourceType");
  next.delete("failureAction");
  next.delete("failedLine");
  return next;
}

export function buildRecentJobStatusProcessingLinkInput(input: {
  projectId: string;
  search: string | URLSearchParams;
  label: string;
  collaborationUnitLabel: string;
  batchEntries: RecentProcessingBatchEntry[];
  selectedFailedItem?: {
    lineNo: number | null;
    reasonLabel: string;
  } | null;
}) {
  const searchText = input.search.toString();
  const path = `/projects/${input.projectId}/jobs${searchText ? `?${searchText}` : ""}`;
  const highlightedLineNo = input.selectedFailedItem?.lineNo ?? null;
  const highlightedParams = new URLSearchParams(input.search);
  if (highlightedLineNo) {
    highlightedParams.set("failedLine", String(highlightedLineNo));
  }

  return {
    projectId: input.projectId,
    path,
    label: input.label,
    collaborationUnitLabel: input.collaborationUnitLabel,
    sourceLabel: "任务状态页",
    batchEntries: input.batchEntries,
    highlightedBatchEntryId: highlightedLineNo
      ? `failed-line-${highlightedLineNo}`
      : null,
    highlightedBatchEntryLabel: highlightedLineNo
      ? `第 ${highlightedLineNo} 条 · ${input.selectedFailedItem?.reasonLabel ?? ""}`
      : null,
    highlightedBatchEntryPath: highlightedLineNo
      ? `/projects/${input.projectId}/jobs?${highlightedParams.toString()}`
      : null,
  };
}

export function findMatchingJobIdForImportTask(
  task: ImportTask | null,
  jobs: BackgroundJob[],
) {
  if (!task?.latestJobId) {
    return null;
  }

  return jobs.some((job) => job.id === task.latestJobId) ? task.latestJobId : null;
}

export function findMatchingImportTaskIdForJob(
  job: BackgroundJob | null,
  tasks: ImportTask[],
) {
  if (!job) {
    return null;
  }

  const payloadImportTaskId =
    job.payload.importTaskId && typeof job.payload.importTaskId === "string"
      ? job.payload.importTaskId
      : null;

  if (payloadImportTaskId && tasks.some((task) => task.id === payloadImportTaskId)) {
    return payloadImportTaskId;
  }

  const matchedByLatestJob = tasks.find((task) => task.latestJobId === job.id);
  return matchedByLatestJob?.id ?? null;
}

export function resolveJobStatusSelection(input: {
  importTasks: ImportTask[];
  jobs: BackgroundJob[];
  focusedImportTaskId: string | null;
  focusedJobId: string | null;
  selectedImportTaskId: string | null;
  selectedJobId: string | null;
  preferredImportTaskId?: string | null;
  preferredJobId?: string | null;
}) {
  const nextSelectedImportTaskId =
    input.preferredImportTaskId &&
    input.importTasks.some((task) => task.id === input.preferredImportTaskId)
      ? input.preferredImportTaskId
      : input.focusedImportTaskId &&
          input.importTasks.some((task) => task.id === input.focusedImportTaskId)
        ? input.focusedImportTaskId
        : input.selectedImportTaskId &&
            input.importTasks.some((task) => task.id === input.selectedImportTaskId)
          ? input.selectedImportTaskId
          : input.focusedJobId
            ? findMatchingImportTaskIdForJob(
                input.jobs.find((job) => job.id === input.focusedJobId) ?? null,
                input.importTasks,
              )
            : null;
  const fallbackImportTaskId =
    nextSelectedImportTaskId ?? input.importTasks[0]?.id ?? null;
  const nextSelectedImportTask =
    input.importTasks.find((task) => task.id === fallbackImportTaskId) ?? null;

  const nextSelectedJobId =
    input.preferredJobId && input.jobs.some((job) => job.id === input.preferredJobId)
      ? input.preferredJobId
      : input.focusedJobId && input.jobs.some((job) => job.id === input.focusedJobId)
        ? input.focusedJobId
        : input.selectedJobId && input.jobs.some((job) => job.id === input.selectedJobId)
          ? input.selectedJobId
          : input.preferredImportTaskId || input.focusedImportTaskId
            ? findMatchingJobIdForImportTask(
                input.importTasks.find(
                  (task) => task.id === (input.preferredImportTaskId ?? input.focusedImportTaskId),
                ) ??
                  null,
                input.jobs,
              )
            : null;
  const fallbackJobId =
    nextSelectedJobId ??
    findMatchingJobIdForImportTask(nextSelectedImportTask, input.jobs) ??
    input.jobs[0]?.id ??
    null;

  return {
    selectedImportTaskId: fallbackImportTaskId,
    selectedJobId: fallbackJobId,
  };
}

function escapeCsvValue(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export function buildCsvLine(values: string[]) {
  return values.map(escapeCsvValue).join(",");
}

export function buildCurrentJobStatusViewUrl(input: {
  origin: string;
  projectId: string | null | undefined;
  statusFilter: JobStatusFilter;
  failureReasonCode: string | null;
  failureResourceType: string | null;
  failureAction: string | null;
  failedLine: number | null;
}) {
  const path = input.projectId ? `/projects/${input.projectId}/jobs` : "/projects";
  const params = new URLSearchParams();
  if (input.statusFilter !== "all") {
    params.set("status", input.statusFilter);
  }
  if (input.failureReasonCode) {
    params.set("failureReason", input.failureReasonCode);
  }
  if (input.failureResourceType) {
    params.set("failureResourceType", input.failureResourceType);
  }
  if (input.failureAction) {
    params.set("failureAction", input.failureAction);
  }
  if (input.failedLine) {
    params.set("failedLine", String(input.failedLine));
  }
  const query = params.toString();
  return `${input.origin}${path}${query ? `?${query}` : ""}`;
}

export function buildSuggestedErrorReportFileName(input: {
  importTaskId: string | null | undefined;
  failureReasonCode: string | null;
  failureResourceType: string | null;
  failureAction: string | null;
  hasFailureSubsetFilters: boolean;
}) {
  if (!input.importTaskId || !input.failureReasonCode) {
    return null;
  }

  if (input.hasFailureSubsetFilters) {
    const fileNameSegments = [
      input.importTaskId,
      "error-report",
      "current-subset",
      input.failureReasonCode,
    ];
    if (input.failureResourceType) {
      fileNameSegments.push(`resource-${input.failureResourceType}`);
    }
    if (input.failureAction) {
      fileNameSegments.push(`action-${input.failureAction}`);
    }
    return `${fileNameSegments.join("-")}.json`;
  }

  return `${input.importTaskId}-error-report-current-filter-${input.failureReasonCode}.json`;
}

export function buildErrorReportActionKey(
  scope: ErrorReportScope,
  format: ErrorReportFormat,
) {
  return `${scope}:${format}`;
}

export function buildFailureSubsetDownload(input: {
  taskId: string;
  format: ErrorReportFormat;
  failureReasonCode: string | null;
  failureResourceType: string | null;
  failureAction: string | null;
  failedItems: ParsedImportTaskFailedItem[];
}) {
  const fileNameSegments = [input.taskId, "error-report", "current-subset"];
  if (input.failureReasonCode) {
    fileNameSegments.push(input.failureReasonCode);
  }
  if (input.failureResourceType) {
    fileNameSegments.push(`resource-${input.failureResourceType}`);
  }
  if (input.failureAction) {
    fileNameSegments.push(`action-${input.failureAction}`);
  }

  const fileName = `${fileNameSegments.join("-")}.${input.format}`;
  if (input.format === "json") {
    return {
      content: JSON.stringify(
        buildFailureSubsetExportPayload({
          taskId: input.taskId,
          failureReason: input.failureReasonCode,
          failureResourceType: input.failureResourceType,
          failureAction: input.failureAction,
          failedItems: input.failedItems,
        }),
        null,
        2,
      ),
      fileName,
      mimeType: "application/json; charset=utf-8",
    };
  }

  const rows = [
    [
      "lineNo",
      "reasonCode",
      "reasonLabel",
      "errorMessage",
      "projectId",
      "resourceType",
      "action",
      "keys",
    ],
    ...input.failedItems.map((item) => [
      item.lineNo === null ? "" : String(item.lineNo),
      item.reasonCode,
      item.reasonLabel,
      item.errorMessage,
      item.projectId ?? "",
      item.resourceType ?? "",
      item.action ?? "",
      item.keys.join("|"),
    ]),
  ];

  return {
    content: rows.map((row) => buildCsvLine(row)).join("\n"),
    fileName,
    mimeType: "text/csv; charset=utf-8",
  };
}

export function triggerClientDownload(input: {
  content: string;
  fileName: string;
  mimeType: string;
}) {
  const blob = new Blob([input.content], { type: input.mimeType });
  const downloadUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = input.fileName;
  anchor.click();
  window.URL.revokeObjectURL(downloadUrl);
}

export function readSelectedFile(file: File): Promise<string> {
  if (typeof file.text === "function") {
    return file.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = () => {
      reject(new Error("FILE_READ_FAILED"));
    };
    reader.readAsText(file);
  });
}
