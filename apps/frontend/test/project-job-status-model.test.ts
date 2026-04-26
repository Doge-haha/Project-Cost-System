import { describe, expect, test } from "vitest";

import type { ParsedImportTaskFailedItem } from "../src/features/projects/import-task-failure-snapshots";
import {
  buildFailedItemComparisonSummary,
  buildFailureSubsetBatchEntries,
  buildFailureSubsetWorkOrderSummary,
  buildFailureSummaryState,
  buildFailureRetryState,
  buildSelectedFailedItemDetailState,
  buildTeamHandoffSummary,
  buildUploadComparisonSummaryState,
  buildUpstreamHandoffSummary,
  type ImportPreviewItem,
} from "../src/features/projects/project-job-status-model";

const failedItems: ParsedImportTaskFailedItem[] = [
  {
    lineNo: 2,
    reasonCode: "missing_field",
    reasonLabel: "缺少必填字段",
    errorMessage: "缺少 action",
    projectId: "project-001",
    resourceType: "review_submission",
    action: null,
    keys: ["projectId", "resourceType"],
    retryEventSnapshot: null,
  },
  {
    lineNo: 4,
    reasonCode: "missing_field",
    reasonLabel: "缺少必填字段",
    errorMessage: "缺少工程量",
    projectId: "project-001",
    resourceType: "bill_item",
    action: "create",
    keys: ["projectId", "resourceType", "action", "name"],
    retryEventSnapshot: {
      projectId: "project-001",
      resourceType: "bill_item",
      action: "create",
      name: "某清单项",
    },
  },
];

const previewItems: ImportPreviewItem[] = [
  {
    lineNo: 2,
    projectId: "project-001",
    resourceType: "review_submission",
    action: null,
    keys: ["projectId", "resourceType"],
  },
  {
    lineNo: 4,
    projectId: "project-001",
    resourceType: "bill_item",
    action: "create",
    keys: ["projectId", "resourceType", "action"],
  },
];

describe("buildSelectedFailedItemDetailState", () => {
  test("derives selected failed item navigation and key deltas", () => {
    const state = buildSelectedFailedItemDetailState({
      filteredImportFailedItems: failedItems,
      selectedFailedLine: 4,
      selectedImportPreviewItems: previewItems,
    });

    expect(state.selectedFailedItem?.lineNo).toBe(4);
    expect(state.selectedFailedItemIndex).toBe(1);
    expect(state.previousFailedItem?.lineNo).toBe(2);
    expect(state.nextFailedItem).toBeNull();
    expect(state.selectedFailedItemMissingKeys).toEqual(["name"]);
    expect(state.selectedFailedItemExtraPreviewKeys).toEqual([]);
  });

  test("returns empty detail state when there is no selected failed line", () => {
    const state = buildSelectedFailedItemDetailState({
      filteredImportFailedItems: failedItems,
      selectedFailedLine: null,
      selectedImportPreviewItems: previewItems,
    });

    expect(state.selectedFailedItem).toBeNull();
    expect(state.selectedFailedItemIndex).toBe(-1);
    expect(state.previousFailedItem).toBeNull();
    expect(state.nextFailedItem).toBeNull();
    expect(state.selectedFailedItemMissingKeys).toEqual([]);
    expect(state.selectedFailedItemExtraPreviewKeys).toEqual([]);
  });
});

describe("buildFailureRetryState", () => {
  test("allows scoped retry only when every filtered failed item has retry snapshots", () => {
    const retryableState = buildFailureRetryState({
      filteredImportFailedItems: [failedItems[1]!],
      selectedJobMatchesImportTask: true,
      selectedJobType: "knowledge_extraction",
      selectedFailureReasonCode: "missing_field",
      hasFailureSubsetFilters: true,
    });

    expect(retryableState.filteredFailureRetrySnapshotCount).toBe(1);
    expect(retryableState.canRetryCurrentFailureScope).toBe(true);
    expect(retryableState.canRetryCurrentFailureSubset).toBe(true);

    const nonRetryableState = buildFailureRetryState({
      filteredImportFailedItems: failedItems,
      selectedJobMatchesImportTask: true,
      selectedJobType: "knowledge_extraction",
      selectedFailureReasonCode: "missing_field",
      hasFailureSubsetFilters: false,
    });

    expect(nonRetryableState.filteredFailureRetrySnapshotCount).toBe(1);
    expect(nonRetryableState.canRetryCurrentFailureScope).toBe(false);
    expect(nonRetryableState.canRetryCurrentFailureSubset).toBe(false);
  });
});

describe("buildFailureSummaryState", () => {
  test("aggregates failure summaries, retry readiness, and collaboration labels", () => {
    const state = buildFailureSummaryState({
      failureReasonFilteredItems: failedItems,
      filteredImportFailedItems: [failedItems[1]!],
      selectedImportPreviewItems: previewItems,
      selectedResourceTypeFilter: "bill_item",
      selectedActionFilter: "create",
      selectedFailureReasonCode: "missing_field",
      selectedFailureReasonLabel: "缺少必填字段",
      selectedJobMatchesImportTask: true,
      selectedJobType: "knowledge_extraction",
    });

    expect(state.filteredFailureResourceSummary).toEqual([
      { label: "bill_item", count: 1 },
      { label: "review_submission", count: 1 },
    ]);
    expect(state.filteredFailureActionSummary).toEqual([
      { label: "create", count: 1 },
      { label: "未提供", count: 1 },
    ]);
    expect(state.filteredFailureMissingFieldCount).toBe(1);
    expect(state.filteredFailurePreviewCount).toBe(1);
    expect(state.filteredFailureRetrySnapshotCount).toBe(1);
    expect(state.canRetryCurrentFailureScope).toBe(true);
    expect(state.canRetryCurrentFailureSubset).toBe(true);
    expect(state.currentFailureSubsetLabel).toBe("缺少必填字段 · 资源 bill_item · 动作 create");
    expect(state.failureActionSuggestions.length).toBeGreaterThan(0);
    expect(state.topFilteredFailureResourceType).toBe("bill_item");
    expect(state.topFilteredFailureAction).toBe("create");
  });
});

describe("comparison and handoff helpers", () => {
  test("computes lightweight comparison summary for newly uploaded failures", () => {
    const summary = buildFailedItemComparisonSummary({
      baselineItems: failedItems,
      currentItems: [failedItems[1]!],
    });

    expect(summary).toEqual({
      baselineCount: 2,
      currentCount: 1,
      stillFailedCount: 1,
      resolvedCount: 1,
      newFailedCount: 0,
      unmatchedCount: 1,
    });
  });

  test("tracks newly introduced failures in the uploaded batch comparison summary", () => {
    const summary = buildFailedItemComparisonSummary({
      baselineItems: failedItems,
      currentItems: [
        failedItems[1]!,
        {
          lineNo: 7,
          reasonCode: "invalid_value",
          reasonLabel: "字段值非法",
          errorMessage: "projectId 不能为空",
          projectId: "project-001",
          resourceType: "bill_item",
          action: "create",
          keys: ["projectId", "resourceType", "action"],
          retryEventSnapshot: null,
        },
      ],
    });

    expect(summary).toEqual({
      baselineCount: 2,
      currentCount: 2,
      stillFailedCount: 1,
      resolvedCount: 1,
      newFailedCount: 1,
      unmatchedCount: 1,
    });
  });

  test("builds upload comparison copy from the comparison summary counts", () => {
    const summary = buildUploadComparisonSummaryState({
      baselineItems: failedItems,
      currentItems: [
        failedItems[1]!,
        {
          lineNo: 7,
          reasonCode: "invalid_value",
          reasonLabel: "字段值非法",
          errorMessage: "projectId 不能为空",
          projectId: "project-001",
          resourceType: "bill_item",
          action: "create",
          keys: ["projectId", "resourceType", "action"],
          retryEventSnapshot: null,
        },
      ],
    });

    expect(summary).toEqual({
      baselineCount: 2,
      currentCount: 2,
      stillFailedCount: 1,
      resolvedCount: 1,
      newFailedCount: 1,
      unmatchedCount: 1,
      headline:
        "对照结果：原失败范围中仍命中 1 条，已消化 1 条，新批次额外出现 1 条。",
      detail:
        "这条对照会把旧失败是否被新批次消化、以及当前批次是否引入新的失败，拆开给你看。",
    });
  });

  test("builds team and upstream handoff summaries with stable fields", () => {
    const teamSummary = buildTeamHandoffSummary({
      scopeLabel: "缺少必填字段 · 资源 bill_item · 动作 create",
      itemCount: 1,
      missingFieldCount: 1,
      previewCount: 1,
      retrySnapshotCount: 1,
      topResourceType: "bill_item",
      topAction: "create",
      suggestions: ["优先回源补字段后再重新导入。"],
      currentUrl: "http://localhost/projects/project-001/jobs?status=failed",
    });
    const upstreamSummary = buildUpstreamHandoffSummary({
      scopeLabel: "缺少必填字段 · 资源 bill_item · 动作 create",
      itemCount: 1,
      missingFieldCount: 1,
      previewCount: 1,
      retrySnapshotCount: 1,
      topResourceType: "bill_item",
      topAction: "create",
      suggestions: ["优先回源补字段后再重新导入。"],
      currentUrl: "http://localhost/projects/project-001/jobs?status=failed",
      suggestedExportFileName: "import-task-001-error-report.json",
    });

    expect(teamSummary).toContain("当前处理范围：缺少必填字段 · 资源 bill_item · 动作 create");
    expect(teamSummary).toContain("可重建快照：1 条");
    expect(upstreamSummary).toContain("需要协助排查的数据范围：缺少必填字段 · 资源 bill_item · 动作 create");
    expect(upstreamSummary).toContain("建议对应导出文件：import-task-001-error-report.json");
  });

  test("builds work-order summary and failed-line deep links", () => {
    const workOrder = buildFailureSubsetWorkOrderSummary({
      scopeLabel: "缺少必填字段 · 资源 bill_item · 动作 create",
      itemCount: 1,
      retrySnapshotCount: 1,
      topResourceType: "bill_item",
      topAction: "create",
      suggestedAction: "优先回源补字段后再重新导入。",
      suggestedExportFileName: "import-task-001-error-report.json",
      currentUrl: "http://localhost/projects/project-001/jobs?status=failed",
    });
    const batchEntries = buildFailureSubsetBatchEntries({
      projectId: "project-001",
      statusFilter: "failed",
      failureReasonCode: "missing_field",
      failureResourceType: "bill_item",
      failureAction: "create",
      failedItems,
    });

    expect(workOrder).toContain("失败子集处理单");
    expect(workOrder).toContain("建议导出文件：import-task-001-error-report.json");
    expect(batchEntries).toEqual([
      {
        id: "failed-line-2",
        label: "第 2 条 · 缺少必填字段",
        path: "/projects/project-001/jobs?status=failed&failureReason=missing_field&failureResourceType=bill_item&failureAction=create&failedLine=2",
        sourceType: "job",
      },
      {
        id: "failed-line-4",
        label: "第 4 条 · 缺少必填字段",
        path: "/projects/project-001/jobs?status=failed&failureReason=missing_field&failureResourceType=bill_item&failureAction=create&failedLine=4",
        sourceType: "job",
      },
    ]);
  });
});
