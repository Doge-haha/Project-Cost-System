import { describe, expect, test } from "vitest";

import type { ImportTask } from "../src/lib/types";
import {
  formatDetectedFormat,
  parseFailureSummary,
  parseImportPreviewItems,
  parseImportSummary,
  parseRetryHistory,
} from "../src/features/projects/import-task-view-model";

function buildImportTask(metadata: Record<string, unknown>): ImportTask {
  return {
    id: "import-task-001",
    projectId: "project-001",
    sourceType: "file_upload",
    sourceLabel: "文件导入",
    sourceFileName: "events.json",
    sourceBatchNo: "upload-20260424-001",
    status: "failed",
    requestedBy: "user-001",
    totalItemCount: 3,
    importedItemCount: 0,
    memoryItemCount: 0,
    failedItemCount: 2,
    latestJobId: "job-001",
    latestErrorMessage: "失败",
    failureDetails: ["失败"],
    retryCount: 1,
    retryLimit: 3,
    canRetry: true,
    metadata,
    createdAt: "2026-04-24T10:00:00.000Z",
    completedAt: "2026-04-24T10:05:00.000Z",
  };
}

describe("import-task-view-model", () => {
  test("formats detected format labels", () => {
    expect(formatDetectedFormat(buildImportTask({ detectedFormat: "json_array" }))).toBe(
      "JSON 数组",
    );
    expect(formatDetectedFormat(buildImportTask({ detectedFormat: "json_lines" }))).toBe(
      "JSON Lines",
    );
    expect(formatDetectedFormat(buildImportTask({ detectedFormat: "other" }))).toBe(
      "系统未记录",
    );
  });

  test("parses import summary with safe fallbacks", () => {
    expect(
      parseImportSummary(
        buildImportTask({
          parseSummary: {
            totalEventCount: 2,
            fieldKeys: ["projectId", "resourceType"],
            resourceTypes: ["bill_item"],
            actions: ["create"],
            missingProjectIdCount: 1,
            missingActionCount: 0,
          },
        }),
      ),
    ).toEqual({
      totalEventCount: 2,
      fieldKeys: ["projectId", "resourceType"],
      resourceTypes: ["bill_item"],
      actions: ["create"],
      missingProjectIdCount: 1,
      missingActionCount: 0,
    });
  });

  test("parses preview items, retry history, and failure summary", () => {
    const task = buildImportTask({
      previewItems: [
        {
          lineNo: 4,
          projectId: "project-001",
          resourceType: "bill_item",
          action: "create",
          keys: ["projectId", "resourceType", "action"],
        },
      ],
      retryHistory: [
        {
          attempt: 1,
          operatorId: "user-001",
          triggeredAt: "2026-04-24T10:10:00.000Z",
          previousStatus: "failed",
        },
      ],
      failureSummary: [
        {
          reasonCode: "missing_field",
          reasonLabel: "缺少必填字段",
          count: 2,
        },
        {
          reasonCode: "invalid_value",
          reasonLabel: "字段值非法",
          count: 0,
        },
      ],
    });

    expect(parseImportPreviewItems(task)).toEqual([
      {
        lineNo: 4,
        projectId: "project-001",
        resourceType: "bill_item",
        action: "create",
        keys: ["projectId", "resourceType", "action"],
      },
    ]);
    expect(parseRetryHistory(task)).toEqual([
      {
        attempt: 1,
        operatorId: "user-001",
        triggeredAt: "2026-04-24T10:10:00.000Z",
        previousStatus: "failed",
      },
    ]);
    expect(parseFailureSummary(task)).toEqual([
      {
        reasonCode: "missing_field",
        reasonLabel: "缺少必填字段",
        count: 2,
      },
    ]);
  });
});
