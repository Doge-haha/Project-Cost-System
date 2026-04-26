import type { ParsedImportTaskFailedItem } from "./import-task-failure-snapshots";

export type ImportPreviewItem = {
  lineNo: number | null;
  projectId: string | null;
  resourceType: string | null;
  action: string | null;
  keys: string[];
};

type ValueCountSummary = {
  label: string;
  count: number;
};

function summarizeValueCounts(values: Array<string | null>): ValueCountSummary[] {
  const counts = new Map<string, number>();

  values.forEach((value) => {
    const key = value && value.length > 0 ? value : "未提供";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function buildFailureActionSuggestions(input: {
  itemCount: number;
  missingFieldCount: number;
  previewCount: number;
  hasSubsetFilters: boolean;
  reasonLabel: string | null;
  topResourceType: string | null;
  topAction: string | null;
}) {
  const suggestions: string[] = [];

  if (input.itemCount === 0) {
    return suggestions;
  }

  if (input.missingFieldCount > 0) {
    suggestions.push(
      `当前有 ${input.missingFieldCount} 条缺字段相关失败，建议优先回源补字段后再重新导入。`,
    );
  }

  if (input.topResourceType && input.topAction) {
    suggestions.push(
      `当前问题集中在 ${input.topResourceType} / ${input.topAction}，建议优先检查这一类导入映射和字段装配规则。`,
    );
  } else if (input.topResourceType) {
    suggestions.push(`当前问题主要集中在 ${input.topResourceType}，建议先核对该类对象的数据来源。`);
  }

  if (input.previewCount === input.itemCount) {
    suggestions.push("当前子集都保留了原始预览，适合逐条复核后再决定是否回源修数。");
  } else if (input.previewCount === 0) {
    suggestions.push("当前子集没有原始预览，建议优先导出当前范围并交给上游数据提供方排查。");
  } else {
    suggestions.push(
      `当前仅有 ${input.previewCount}/${input.itemCount} 条保留原始预览，建议先看可回看条目，再决定是否批量回源排查。`,
    );
  }

  if (input.hasSubsetFilters) {
    suggestions.push("当前已经收束到较小子集，适合直接导出当前子集并作为协作处理单元。");
  } else if (input.reasonLabel) {
    suggestions.push(`当前仍是“${input.reasonLabel}”的大范围视角，可继续按资源类型或动作收束后再处理。`);
  }

  return suggestions;
}

function buildFailedItemComparisonKey(
  item: Pick<
    ParsedImportTaskFailedItem,
    "projectId" | "resourceType" | "action" | "keys"
  >,
) {
  return JSON.stringify({
    projectId: item.projectId ?? null,
    resourceType: item.resourceType ?? null,
    action: item.action ?? null,
    keys: [...item.keys].sort(),
  });
}

export function buildSelectedFailedItemDetailState(input: {
  filteredImportFailedItems: ParsedImportTaskFailedItem[];
  selectedFailedLine: number | null;
  selectedImportPreviewItems: ImportPreviewItem[];
}) {
  const selectedFailedItem =
    input.selectedFailedLine !== null
      ? input.filteredImportFailedItems.find((item) => item.lineNo === input.selectedFailedLine) ??
        null
      : null;
  const selectedFailedItemIndex = selectedFailedItem
    ? input.filteredImportFailedItems.findIndex(
        (item) => item.lineNo === selectedFailedItem.lineNo,
      )
    : -1;
  const selectedPreviewItem = selectedFailedItem
    ? input.selectedImportPreviewItems.find((item) => item.lineNo === selectedFailedItem.lineNo) ??
      null
    : null;

  return {
    selectedFailedItem,
    selectedFailedItemIndex,
    selectedPreviewItem,
    previousFailedItem:
      selectedFailedItemIndex > 0
        ? input.filteredImportFailedItems[selectedFailedItemIndex - 1]
        : null,
    nextFailedItem:
      selectedFailedItemIndex >= 0 &&
      selectedFailedItemIndex < input.filteredImportFailedItems.length - 1
        ? input.filteredImportFailedItems[selectedFailedItemIndex + 1]
        : null,
    selectedFailedItemMissingKeys:
      selectedFailedItem && selectedPreviewItem
        ? selectedFailedItem.keys.filter((key) => !selectedPreviewItem.keys.includes(key))
        : [],
    selectedFailedItemExtraPreviewKeys:
      selectedFailedItem && selectedPreviewItem
        ? selectedPreviewItem.keys.filter((key) => !selectedFailedItem.keys.includes(key))
        : [],
  };
}

export function buildFailureRetryState(input: {
  filteredImportFailedItems: ParsedImportTaskFailedItem[];
  selectedJobMatchesImportTask: boolean;
  selectedJobType: string | null;
  selectedFailureReasonCode: string | null;
  hasFailureSubsetFilters: boolean;
}) {
  const filteredFailureRetrySnapshotCount = input.filteredImportFailedItems.filter(
    (item) => item.retryEventSnapshot,
  ).length;
  const canRetryCurrentFailureScope =
    input.selectedJobMatchesImportTask &&
    input.selectedJobType === "knowledge_extraction" &&
    Boolean(input.selectedFailureReasonCode || input.hasFailureSubsetFilters) &&
    input.filteredImportFailedItems.length > 0 &&
    filteredFailureRetrySnapshotCount === input.filteredImportFailedItems.length;

  return {
    filteredFailureRetrySnapshotCount,
    canRetryCurrentFailureScope,
    canRetryCurrentFailureSubset:
      canRetryCurrentFailureScope && input.hasFailureSubsetFilters,
  };
}

export function buildFailureSummaryState(input: {
  failureReasonFilteredItems: ParsedImportTaskFailedItem[];
  filteredImportFailedItems: ParsedImportTaskFailedItem[];
  selectedImportPreviewItems: ImportPreviewItem[];
  selectedResourceTypeFilter: string | null;
  selectedActionFilter: string | null;
  selectedFailureReasonCode: string | null;
  selectedFailureReasonLabel: string | null;
  selectedJobMatchesImportTask: boolean;
  selectedJobType: string | null;
}) {
  const filteredFailureResourceSummary = summarizeValueCounts(
    input.failureReasonFilteredItems.map((item) => item.resourceType),
  );
  const filteredFailureActionSummary = summarizeValueCounts(
    input.failureReasonFilteredItems.map((item) => item.action),
  );
  const filteredFailureMissingFieldCount = input.filteredImportFailedItems.filter(
    (item) => item.errorMessage.includes("缺少") || item.reasonLabel.includes("缺少"),
  ).length;
  const previewLines = new Set(
    input.selectedImportPreviewItems
      .map((item) => item.lineNo)
      .filter((value): value is number => typeof value === "number"),
  );
  const filteredFailurePreviewCount = input.filteredImportFailedItems.filter(
    (item) => typeof item.lineNo === "number" && previewLines.has(item.lineNo),
  ).length;
  const hasFailureSubsetFilters = Boolean(
    input.selectedResourceTypeFilter || input.selectedActionFilter,
  );
  const retryState = buildFailureRetryState({
    filteredImportFailedItems: input.filteredImportFailedItems,
    selectedJobMatchesImportTask: input.selectedJobMatchesImportTask,
    selectedJobType: input.selectedJobType,
    selectedFailureReasonCode: input.selectedFailureReasonCode,
    hasFailureSubsetFilters,
  });
  const topFilteredFailureResourceType = filteredFailureResourceSummary[0]?.label ?? null;
  const topFilteredFailureAction = filteredFailureActionSummary[0]?.label ?? null;
  const currentFailureSubsetLabel = !hasFailureSubsetFilters
    ? input.selectedFailureReasonLabel ?? "全部失败条目"
    : [
        input.selectedFailureReasonLabel,
        input.selectedResourceTypeFilter
          ? `资源 ${input.selectedResourceTypeFilter}`
          : null,
        input.selectedActionFilter ? `动作 ${input.selectedActionFilter}` : null,
      ]
        .filter((value): value is string => Boolean(value))
        .join(" · ");

  return {
    filteredFailureResourceSummary,
    filteredFailureActionSummary,
    filteredFailureMissingFieldCount,
    filteredFailurePreviewCount,
    hasFailureSubsetFilters,
    topFilteredFailureResourceType,
    topFilteredFailureAction,
    currentFailureSubsetLabel,
    failureActionSuggestions: buildFailureActionSuggestions({
      itemCount: input.filteredImportFailedItems.length,
      missingFieldCount: filteredFailureMissingFieldCount,
      previewCount: filteredFailurePreviewCount,
      hasSubsetFilters: hasFailureSubsetFilters,
      reasonLabel: input.selectedFailureReasonLabel,
      topResourceType: topFilteredFailureResourceType,
      topAction: topFilteredFailureAction,
    }),
    ...retryState,
  };
}

export function buildFailedItemComparisonSummary(input: {
  baselineItems: ParsedImportTaskFailedItem[];
  currentItems: ParsedImportTaskFailedItem[];
}) {
  if (input.baselineItems.length === 0) {
    return null;
  }

  const currentCounts = new Map<string, number>();
  input.currentItems.forEach((item) => {
    const key = buildFailedItemComparisonKey(item);
    currentCounts.set(key, (currentCounts.get(key) ?? 0) + 1);
  });

  let stillFailedCount = 0;
  input.baselineItems.forEach((item) => {
    const key = buildFailedItemComparisonKey(item);
    const currentCount = currentCounts.get(key) ?? 0;
    if (currentCount > 0) {
      stillFailedCount += 1;
      currentCounts.set(key, currentCount - 1);
    }
  });

  const resolvedCount = Math.max(input.baselineItems.length - stillFailedCount, 0);
  const newFailedCount = Math.max(input.currentItems.length - stillFailedCount, 0);

  return {
    baselineCount: input.baselineItems.length,
    currentCount: input.currentItems.length,
    stillFailedCount,
    resolvedCount,
    newFailedCount,
    unmatchedCount: resolvedCount,
  };
}

export type UploadComparisonSummaryState = {
  baselineCount: number;
  currentCount: number;
  stillFailedCount: number;
  resolvedCount: number;
  newFailedCount: number;
  headline: string;
  detail: string;
};

export function buildUploadComparisonSummaryState(input: {
  baselineItems: ParsedImportTaskFailedItem[];
  currentItems: ParsedImportTaskFailedItem[];
}): UploadComparisonSummaryState | null {
  if (input.baselineItems.length === 0) {
    return null;
  }

  const summary = buildFailedItemComparisonSummary(input);
  if (!summary) {
    return null;
  }

  return {
    ...summary,
    headline: `对照结果：原失败范围中仍命中 ${summary.stillFailedCount} 条，已消化 ${summary.resolvedCount} 条，新批次额外出现 ${summary.newFailedCount} 条。`,
    detail: "这条对照会把旧失败是否被新批次消化、以及当前批次是否引入新的失败，拆开给你看。",
  };
}

export function buildTeamHandoffSummary(input: {
  scopeLabel: string;
  itemCount: number;
  missingFieldCount: number;
  previewCount: number;
  retrySnapshotCount: number;
  topResourceType: string | null;
  topAction: string | null;
  suggestions: string[];
  currentUrl: string;
}) {
  const lines = [
    `当前处理范围：${input.scopeLabel}`,
    `失败条目数：${input.itemCount}`,
    `缺字段相关：${input.missingFieldCount} 条`,
    `可回看原始预览：${input.previewCount} 条`,
    `可重建快照：${input.retrySnapshotCount} 条`,
    `主要资源类型：${input.topResourceType ?? "未识别"}`,
    `主要动作：${input.topAction ?? "未识别"}`,
  ];

  if (input.suggestions.length > 0) {
    lines.push("建议动作：");
    input.suggestions.slice(0, 3).forEach((item) => {
      lines.push(`- ${item}`);
    });
  }

  lines.push(`当前链接：${input.currentUrl}`);

  return lines.join("\n");
}

export function buildUpstreamHandoffSummary(input: {
  scopeLabel: string;
  itemCount: number;
  missingFieldCount: number;
  previewCount: number;
  retrySnapshotCount: number;
  topResourceType: string | null;
  topAction: string | null;
  suggestions: string[];
  currentUrl: string;
  suggestedExportFileName: string | null;
}) {
  const lines = [
    `需要协助排查的数据范围：${input.scopeLabel}`,
    `涉及失败条目：${input.itemCount} 条`,
    `其中缺字段相关：${input.missingFieldCount} 条`,
    `当前保留原始预览：${input.previewCount} 条`,
    `当前可重建快照：${input.retrySnapshotCount} 条`,
    `主要对象类型：${input.topResourceType ?? "未识别"}`,
    `主要动作类型：${input.topAction ?? "未识别"}`,
  ];

  if (input.missingFieldCount > 0) {
    lines.push("优先请核对是否缺少必填字段，或字段名与约定不一致。");
  }
  if (input.previewCount === 0) {
    lines.push("当前没有可回看的原始预览，请优先补充原始数据样例或导出源文件。");
  }
  if (input.suggestions.length > 0) {
    lines.push(`当前系统建议：${input.suggestions[0]}`);
  }
  if (input.suggestedExportFileName) {
    lines.push(`建议对应导出文件：${input.suggestedExportFileName}`);
  }

  lines.push(`当前链接：${input.currentUrl}`);

  return lines.join("\n");
}

export function buildFailureSubsetWorkOrderSummary(input: {
  scopeLabel: string;
  itemCount: number;
  retrySnapshotCount: number;
  topResourceType: string | null;
  topAction: string | null;
  suggestedAction: string | null;
  suggestedExportFileName: string | null;
  currentUrl: string;
}) {
  const lines = [
    "失败子集处理单",
    `处理范围：${input.scopeLabel}`,
    `失败条目：${input.itemCount} 条`,
    `可重建快照：${input.retrySnapshotCount} 条`,
    `主要资源类型：${input.topResourceType ?? "未识别"}`,
    `主要动作：${input.topAction ?? "未识别"}`,
  ];

  if (input.suggestedAction) {
    lines.push(`建议动作：${input.suggestedAction}`);
  }

  if (input.suggestedExportFileName) {
    lines.push(`建议导出文件：${input.suggestedExportFileName}`);
  }

  lines.push(`处理链接：${input.currentUrl}`);

  return lines.join("\n");
}

export function buildFailureSubsetBatchEntries(input: {
  projectId: string;
  statusFilter: "all" | "queued" | "processing" | "completed" | "failed";
  failureReasonCode: string | null;
  failureResourceType: string | null;
  failureAction: string | null;
  failedItems: Array<{
    lineNo: number | null;
    reasonLabel: string;
    errorMessage: string;
  }>;
}) {
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

  return input.failedItems
    .filter((item): item is typeof item & { lineNo: number } => typeof item.lineNo === "number")
    .map((item) => {
      const entryParams = new URLSearchParams(params);
      entryParams.set("failedLine", String(item.lineNo));
      return {
        id: `failed-line-${item.lineNo}`,
        label: `第 ${item.lineNo} 条 · ${item.reasonLabel}`,
        path: `/projects/${input.projectId}/jobs?${entryParams.toString()}`,
        sourceType: "job" as const,
      };
    });
}
