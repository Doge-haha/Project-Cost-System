import type { BackgroundJob, ImportTask } from "../../lib/types";

export type JobStatusFilter = "all" | "queued" | "processing" | "completed" | "failed";

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

function escapeCsvValue(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export function buildCsvLine(values: string[]) {
  return values.map(escapeCsvValue).join(",");
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
