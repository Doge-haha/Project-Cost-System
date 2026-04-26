import { describe, expect, test } from "vitest";

import {
  buildFailureSubsetExportPayload,
  parseImportTaskFailedItems,
} from "../src/features/projects/import-task-failure-snapshots";
import type { ImportTask } from "../src/lib/types";

function buildImportTask(metadata: Record<string, unknown>): ImportTask {
  return {
    id: "import-task-001",
    projectId: "project-001",
    sourceType: "audit_log",
    sourceLabel: "审计日志筛选导入",
    sourceFileName: "review-events.xlsx",
    sourceBatchNo: "audit-20260418-001",
    status: "failed",
    requestedBy: "user-001",
    totalItemCount: 2,
    importedItemCount: 0,
    memoryItemCount: 0,
    failedItemCount: 1,
    latestJobId: "job-001",
    latestErrorMessage: "计算失败",
    failureDetails: ["计算失败"],
    retryCount: 0,
    retryLimit: 3,
    canRetry: true,
    metadata,
    createdAt: "2026-04-18T13:00:00.000Z",
    completedAt: "2026-04-18T13:10:00.000Z",
  };
}

describe("parseImportTaskFailedItems", () => {
  test("keeps inline retry snapshots on failed items", () => {
    const failedItems = parseImportTaskFailedItems(
      buildImportTask({
        failedItems: [
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
        ],
      }),
    );

    expect(failedItems[0]?.retryEventSnapshot).toEqual({
      projectId: "project-001",
      resourceType: "bill_item",
      action: "create",
      name: "某清单项",
    });
  });

  test("merges formal failureSnapshots metadata into failed items by line number", () => {
    const failedItems = parseImportTaskFailedItems(
      buildImportTask({
        failedItems: [
          {
            lineNo: 4,
            reasonCode: "missing_field",
            reasonLabel: "缺少必填字段",
            errorMessage: "缺少工程量",
            projectId: "project-001",
            resourceType: "bill_item",
            action: "create",
            keys: ["projectId", "resourceType", "action", "name"],
          },
        ],
        failureSnapshots: [
          {
            lineNo: 4,
            retryEventSnapshot: {
              projectId: "project-001",
              resourceType: "bill_item",
              action: "create",
              name: "某清单项",
            },
          },
        ],
      }),
    );

    expect(failedItems[0]?.retryEventSnapshot).toEqual({
      projectId: "project-001",
      resourceType: "bill_item",
      action: "create",
      name: "某清单项",
    });
  });

  test("builds subset export payload with explicit failureSnapshots summary", () => {
    const failedItems = parseImportTaskFailedItems(
      buildImportTask({
        failedItems: [
          {
            lineNo: 4,
            reasonCode: "missing_field",
            reasonLabel: "缺少必填字段",
            errorMessage: "缺少工程量",
            projectId: "project-001",
            resourceType: "bill_item",
            action: "create",
            keys: ["projectId", "resourceType", "action", "name"],
          },
        ],
        failureSnapshots: [
          {
            lineNo: 4,
            retryEventSnapshot: {
              projectId: "project-001",
              resourceType: "bill_item",
              action: "create",
              name: "某清单项",
            },
          },
        ],
      }),
    );

    const payload = buildFailureSubsetExportPayload({
      taskId: "import-task-001",
      failureReason: "missing_field",
      failureResourceType: "bill_item",
      failureAction: "create",
      failedItems,
    });

    expect(payload.scope).toEqual({
      failureReason: "missing_field",
      failureResourceType: "bill_item",
      failureAction: "create",
    });
    expect(payload.failedItems).toHaveLength(1);
    expect(payload.failureSnapshots).toEqual([
      {
        lineNo: 4,
        reasonCode: "missing_field",
        resourceType: "bill_item",
        action: "create",
        retryEventSnapshot: {
          projectId: "project-001",
          resourceType: "bill_item",
          action: "create",
          name: "某清单项",
        },
      },
    ]);
  });
});
