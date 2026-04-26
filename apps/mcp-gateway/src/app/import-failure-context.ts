function normalizeImportFailedItems(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      lineNo: typeof item.lineNo === "number" ? item.lineNo : null,
      reasonCode:
        typeof item.reasonCode === "string" && item.reasonCode.length > 0
          ? item.reasonCode
          : "unknown",
      reasonLabel:
        typeof item.reasonLabel === "string" && item.reasonLabel.length > 0
          ? item.reasonLabel
          : "未分类",
      errorMessage:
        typeof item.errorMessage === "string" && item.errorMessage.length > 0
          ? item.errorMessage
          : "系统未记录",
      projectId: typeof item.projectId === "string" ? item.projectId : null,
      resourceType: typeof item.resourceType === "string" ? item.resourceType : null,
      action: typeof item.action === "string" ? item.action : null,
      keys: Array.isArray(item.keys)
        ? item.keys.filter(
            (value): value is string => typeof value === "string" && value.length > 0,
          )
        : [],
      retryEventSnapshot:
        item.retryEventSnapshot &&
        typeof item.retryEventSnapshot === "object" &&
        !Array.isArray(item.retryEventSnapshot)
          ? (item.retryEventSnapshot as Record<string, unknown>)
          : null,
    }));
}

function normalizeFailureSnapshots(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      lineNo: typeof item.lineNo === "number" ? item.lineNo : null,
      reasonCode:
        typeof item.reasonCode === "string" && item.reasonCode.length > 0
          ? item.reasonCode
          : null,
      resourceType:
        typeof item.resourceType === "string" && item.resourceType.length > 0
          ? item.resourceType
          : null,
      action:
        typeof item.action === "string" && item.action.length > 0 ? item.action : null,
      retryEventSnapshot:
        item.retryEventSnapshot &&
        typeof item.retryEventSnapshot === "object" &&
        !Array.isArray(item.retryEventSnapshot)
          ? (item.retryEventSnapshot as Record<string, unknown>)
          : null,
    }))
    .filter((item) => item.retryEventSnapshot);
}

function summarizeImportFailureValues(values: Array<string | null>) {
  const counts = new Map<string, number>();

  values.forEach((value) => {
    const key = value && value.length > 0 ? value : "未提供";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

export function buildImportFailureContextResource(input: {
  importTasksPayload: Record<string, unknown>;
  importTaskId?: string;
  failureReason?: string;
  failureResourceType?: string;
  failureAction?: string;
}) {
  const items = Array.isArray(input.importTasksPayload.items)
    ? input.importTasksPayload.items.filter(
        (item): item is Record<string, unknown> => !!item && typeof item === "object",
      )
    : [];

  const selectedTask =
    (input.importTaskId
      ? items.find((item) => item.id === input.importTaskId)
      : null) ??
    items.find((item) => item.status === "failed") ??
    items[0] ??
    null;
  const selectedTaskMetadata =
    selectedTask?.metadata && typeof selectedTask.metadata === "object"
      ? (selectedTask.metadata as Record<string, unknown>)
      : null;

  const failedItems = normalizeImportFailedItems(selectedTaskMetadata?.failedItems);
  const failureSnapshots = normalizeFailureSnapshots(selectedTaskMetadata?.failureSnapshots);
  const filteredFailedItems = failedItems.filter((item) => {
    if (input.failureReason && item.reasonCode !== input.failureReason) {
      return false;
    }
    if (input.failureResourceType && item.resourceType !== input.failureResourceType) {
      return false;
    }
    if (input.failureAction && item.action !== input.failureAction) {
      return false;
    }
    return true;
  });

  return {
    importTaskId: typeof selectedTask?.id === "string" ? selectedTask.id : null,
    sourceLabel:
      selectedTask && typeof selectedTask.sourceLabel === "string"
        ? selectedTask.sourceLabel
        : null,
    sourceFileName:
      selectedTask && typeof selectedTask.sourceFileName === "string"
        ? selectedTask.sourceFileName
        : null,
    status:
      selectedTask && typeof selectedTask.status === "string" ? selectedTask.status : null,
    retryCount:
      selectedTask && typeof selectedTask.retryCount === "number"
        ? selectedTask.retryCount
        : null,
    retryLimit:
      selectedTask && typeof selectedTask.retryLimit === "number"
        ? selectedTask.retryLimit
        : null,
    canRetry:
      selectedTask && typeof selectedTask.canRetry === "boolean"
        ? selectedTask.canRetry
        : null,
    retryContext:
      selectedTaskMetadata?.retryContext &&
      typeof selectedTaskMetadata.retryContext === "object" &&
      !Array.isArray(selectedTaskMetadata.retryContext)
        ? selectedTaskMetadata.retryContext
        : null,
    failureSummary:
      Array.isArray(selectedTaskMetadata?.failureSummary)
        ? selectedTaskMetadata.failureSummary
        : [],
    failureSnapshots,
    filteredSummary: {
      itemCount: filteredFailedItems.length,
      missingFieldCount: filteredFailedItems.filter(
        (item) =>
          item.errorMessage.includes("缺少") || item.reasonLabel.includes("缺少"),
      ).length,
      retrySnapshotCount: filteredFailedItems.filter((item) => item.retryEventSnapshot).length,
      resourceTypes: summarizeImportFailureValues(
        filteredFailedItems.map((item) => item.resourceType),
      ),
      actions: summarizeImportFailureValues(filteredFailedItems.map((item) => item.action)),
    },
    failedItems: filteredFailedItems,
  };
}
