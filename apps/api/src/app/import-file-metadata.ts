import type {
  ImportFailedItem,
  ImportFailureReasonCode,
  ParsedImportFile,
} from "./import-file-parser.js";

function buildFailureSummary(failedItems: ImportFailedItem[]) {
  const groups = new Map<
    ImportFailureReasonCode,
    { reasonCode: ImportFailureReasonCode; reasonLabel: string; count: number }
  >();

  for (const item of failedItems) {
    const current = groups.get(item.reasonCode);
    if (current) {
      current.count += 1;
      continue;
    }

    groups.set(item.reasonCode, {
      reasonCode: item.reasonCode,
      reasonLabel: item.reasonLabel,
      count: 1,
    });
  }

  return Array.from(groups.values());
}

export function buildFailureDetails(failedItems: ImportFailedItem[]): string[] {
  return Array.from(
    new Set(
      failedItems.flatMap((item) => [item.reasonLabel, item.errorMessage]).filter(Boolean),
    ),
  ).slice(0, 5);
}

export function buildImportFileMetadata(parsedFile: ParsedImportFile) {
  const { events, detectedFormat, failedItems, totalItemCount } = parsedFile;
  const previewItems = events.slice(0, 5).map((event, index) => ({
    lineNo: index + 1,
    projectId:
      typeof event.projectId === "string" && event.projectId.length > 0
        ? event.projectId
        : null,
    resourceType:
      typeof event.resourceType === "string" && event.resourceType.length > 0
        ? event.resourceType
        : null,
    action:
      typeof event.action === "string" && event.action.length > 0 ? event.action : null,
    keys: Object.keys(event).slice(0, 6),
  }));
  const failureSummary = buildFailureSummary(failedItems);

  return {
    detectedFormat,
    parseSummary: {
      totalEventCount: totalItemCount,
      fieldKeys: Array.from(
        new Set(
          events.flatMap((event) => Object.keys(event).filter((key) => key.length > 0)),
        ),
      ).slice(0, 8),
      resourceTypes: Array.from(
        new Set(
          events
            .map((event) => event.resourceType)
            .filter(
              (value): value is string => typeof value === "string" && value.length > 0,
            ),
        ),
      ).slice(0, 6),
      actions: Array.from(
        new Set(
          events
            .map((event) => event.action)
            .filter(
              (value): value is string => typeof value === "string" && value.length > 0,
            ),
        ),
      ).slice(0, 6),
      missingProjectIdCount: failedItems.filter(
        (item) => item.reasonCode === "missing_field" && item.errorMessage === "缺少 projectId",
      ).length,
      missingActionCount: failedItems.filter(
        (item) => item.reasonCode === "missing_field" && item.errorMessage === "缺少 action",
      ).length,
    },
    previewItems,
    failedItems,
    failureSummary,
    retryHistory: [],
  };
}
