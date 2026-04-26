import type { ImportTask } from "../../lib/types";

export function formatDetectedFormat(task: ImportTask) {
  const detectedFormat = task.metadata.detectedFormat;
  if (detectedFormat === "json_array") {
    return "JSON 数组";
  }
  if (detectedFormat === "json_lines") {
    return "JSON Lines";
  }
  return "系统未记录";
}

export function parseImportSummary(task: ImportTask) {
  const summary =
    task.metadata.parseSummary &&
    typeof task.metadata.parseSummary === "object" &&
    !Array.isArray(task.metadata.parseSummary)
      ? (task.metadata.parseSummary as Record<string, unknown>)
      : null;

  const fieldKeys = Array.isArray(summary?.fieldKeys)
    ? summary.fieldKeys.filter(
        (value): value is string => typeof value === "string" && value.length > 0,
      )
    : [];
  const resourceTypes = Array.isArray(summary?.resourceTypes)
    ? summary.resourceTypes.filter(
        (value): value is string => typeof value === "string" && value.length > 0,
      )
    : [];
  const actions = Array.isArray(summary?.actions)
    ? summary.actions.filter(
        (value): value is string => typeof value === "string" && value.length > 0,
      )
    : [];

  return {
    totalEventCount:
      typeof summary?.totalEventCount === "number" ? summary.totalEventCount : task.totalItemCount,
    fieldKeys,
    resourceTypes,
    actions,
    missingProjectIdCount:
      typeof summary?.missingProjectIdCount === "number" ? summary.missingProjectIdCount : 0,
    missingActionCount:
      typeof summary?.missingActionCount === "number" ? summary.missingActionCount : 0,
  };
}

export function parseImportPreviewItems(task: ImportTask) {
  const items = Array.isArray(task.metadata.previewItems) ? task.metadata.previewItems : [];

  return items
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      lineNo: typeof item.lineNo === "number" ? item.lineNo : null,
      projectId: typeof item.projectId === "string" ? item.projectId : null,
      resourceType: typeof item.resourceType === "string" ? item.resourceType : null,
      action: typeof item.action === "string" ? item.action : null,
      keys: Array.isArray(item.keys)
        ? item.keys.filter(
            (value): value is string => typeof value === "string" && value.length > 0,
          )
        : [],
    }));
}

export function parseRetryHistory(task: ImportTask) {
  const items = Array.isArray(task.metadata.retryHistory) ? task.metadata.retryHistory : [];

  return items
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      attempt: typeof item.attempt === "number" ? item.attempt : null,
      operatorId: typeof item.operatorId === "string" ? item.operatorId : "未知用户",
      triggeredAt: typeof item.triggeredAt === "string" ? item.triggeredAt : null,
      previousStatus:
        typeof item.previousStatus === "string" ? item.previousStatus : "unknown",
    }));
}

export function parseFailureSummary(task: ImportTask) {
  const items = Array.isArray(task.metadata.failureSummary) ? task.metadata.failureSummary : [];

  return items
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      reasonCode:
        typeof item.reasonCode === "string" && item.reasonCode.length > 0
          ? item.reasonCode
          : "unknown",
      reasonLabel:
        typeof item.reasonLabel === "string" && item.reasonLabel.length > 0
          ? item.reasonLabel
          : "未分类",
      count: typeof item.count === "number" ? item.count : 0,
    }))
    .filter((item) => item.count > 0);
}
