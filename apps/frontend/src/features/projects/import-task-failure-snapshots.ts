import type { ImportTask } from "../../lib/types";

export type ParsedImportTaskFailedItem = {
  lineNo: number | null;
  reasonCode: string;
  reasonLabel: string;
  errorMessage: string;
  tableName?: string | null;
  sourceId?: string | null;
  itemCode?: string | null;
  projectId: string | null;
  resourceType: string | null;
  action: string | null;
  keys: string[];
  retryEventSnapshot: Record<string, unknown> | null;
};

export type ParsedFailureSnapshot = {
  lineNo: number | null;
  reasonCode: string | null;
  resourceType: string | null;
  action: string | null;
  retryEventSnapshot: Record<string, unknown> | null;
};

export type FailureSubsetExportPayload = {
  taskId: string;
  scope: {
    failureReason: string | null;
    failureResourceType: string | null;
    failureAction: string | null;
  };
  failedItems: ParsedImportTaskFailedItem[];
  failureSnapshots: ParsedFailureSnapshot[];
};

function parseRetryEventSnapshot(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function parseImportTaskFailureSnapshots(task: ImportTask) {
  const items = Array.isArray(task.metadata.failureSnapshots)
    ? task.metadata.failureSnapshots
    : [];

  return items
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map(
      (item): ParsedFailureSnapshot => ({
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
        retryEventSnapshot: parseRetryEventSnapshot(item.retryEventSnapshot),
      }),
    )
    .filter((item) => item.retryEventSnapshot);
}

export function parseImportTaskFailedItems(task: ImportTask): ParsedImportTaskFailedItem[] {
  const items = Array.isArray(task.metadata.failedItems) ? task.metadata.failedItems : [];
  const snapshots = parseImportTaskFailureSnapshots(task);

  return items
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item, index) => {
      const lineNo = typeof item.lineNo === "number" ? item.lineNo : null;
      const reasonCode =
        typeof item.reasonCode === "string" && item.reasonCode.length > 0
          ? item.reasonCode
          : "unknown";
      const resourceType =
        typeof item.resourceType === "string" && item.resourceType.length > 0
          ? item.resourceType
          : null;
      const action =
        typeof item.action === "string" && item.action.length > 0 ? item.action : null;

      const matchedSnapshot =
        snapshots.find((snapshot) => snapshot.lineNo !== null && snapshot.lineNo === lineNo) ??
        snapshots.find(
          (snapshot) =>
            snapshot.lineNo === null &&
            snapshot.reasonCode === reasonCode &&
            snapshot.resourceType === resourceType &&
            snapshot.action === action,
        ) ??
        (snapshots.length === items.length ? snapshots[index] ?? null : null);

      return {
        lineNo,
        reasonCode,
        reasonLabel:
          typeof item.reasonLabel === "string" && item.reasonLabel.length > 0
            ? item.reasonLabel
            : "未分类",
        errorMessage:
          typeof item.errorMessage === "string" && item.errorMessage.length > 0
            ? item.errorMessage
            : "系统未记录",
        tableName: typeof item.tableName === "string" ? item.tableName : null,
        sourceId: typeof item.sourceId === "string" ? item.sourceId : null,
        itemCode: typeof item.itemCode === "string" ? item.itemCode : null,
        projectId: typeof item.projectId === "string" ? item.projectId : null,
        resourceType,
        action,
        keys: Array.isArray(item.keys)
          ? item.keys.filter(
              (value): value is string => typeof value === "string" && value.length > 0,
            )
          : [],
        retryEventSnapshot:
          parseRetryEventSnapshot(item.retryEventSnapshot) ??
          matchedSnapshot?.retryEventSnapshot ??
          null,
      };
    });
}

export function buildFailureSubsetExportPayload(input: {
  taskId: string;
  failureReason: string | null;
  failureResourceType: string | null;
  failureAction: string | null;
  failedItems: ParsedImportTaskFailedItem[];
}): FailureSubsetExportPayload {
  return {
    taskId: input.taskId,
    scope: {
      failureReason: input.failureReason,
      failureResourceType: input.failureResourceType,
      failureAction: input.failureAction,
    },
    failedItems: input.failedItems,
    failureSnapshots: input.failedItems
      .filter((item) => item.retryEventSnapshot)
      .map((item) => ({
        lineNo: item.lineNo,
        reasonCode: item.reasonCode,
        resourceType: item.resourceType,
        action: item.action,
        retryEventSnapshot: item.retryEventSnapshot,
      })),
  };
}
