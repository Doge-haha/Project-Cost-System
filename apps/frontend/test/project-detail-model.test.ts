import { describe, expect, test } from "vitest";

import type { AuditLogRecord } from "../src/lib/types";
import {
  buildActivityPath,
  buildProjectDetailRefreshBatchSummaryLabel,
  buildProjectDetailRefreshNotice,
  buildSummaryItemPath,
  clearRefreshState,
  formatAction,
  formatResourceType,
  formatResultStatus,
  matchesRefreshResourceType,
} from "../src/features/projects/project-detail-model";

describe("project-detail-model", () => {
  test("formats activity resource and action labels", () => {
    expect(formatResourceType("review_submission")).toBe("审核");
    expect(formatResourceType("background_job")).toBe("异步任务");
    expect(formatAction("approve")).toBe("已通过");
    expect(formatAction("retried")).toBe("已重试");
    expect(formatResultStatus("submitted")).toBe("已提交");
    expect(formatResultStatus(null)).toBeNull();
  });

  test("builds activity paths with collaboration filters for background jobs", () => {
    const path = buildActivityPath(
      "project-001",
      {
        id: "audit-log-001",
        projectId: "project-001",
        resourceType: "background_job",
        resourceId: "job-001",
        action: "retried",
        operatorId: "user-001",
        createdAt: "2026-04-24T10:00:00.000Z",
      } as AuditLogRecord,
      "missing_field",
      "bill_item",
      "create",
    );

    expect(path).toBe(
      "/projects/project-001/jobs?jobId=job-001&status=failed&failureReason=missing_field&failureResourceType=bill_item&failureAction=create",
    );
  });

  test("builds summary item paths and clears refresh state params", () => {
    expect(buildSummaryItemPath("project-001", "1 条审核待处理")).toBe(
      "/projects/project-001/reviews?filter=pending&summaryFocus=pending",
    );
    expect(buildSummaryItemPath("project-001", "1 条过程单据被退回")).toBe(
      "/projects/project-001/process-documents?filter=rejected&summaryFocus=rejected",
    );

    const params = new URLSearchParams(
      "refresh=jobs&resultStatus=approved&resultName=foo&resultKind=review&resultId=1&batchCount=2&batchSummary=done&batchIds=a,b&keep=1",
    );
    expect(clearRefreshState(params).toString()).toBe("keep=1");
  });

  test("matches refresh resource types for review and process-document entries", () => {
    expect(matchesRefreshResourceType("review", "review_submission")).toBe(true);
    expect(matchesRefreshResourceType("process-document", "process_document")).toBe(true);
    expect(matchesRefreshResourceType("review", "background_job")).toBe(false);
  });

  test("builds project detail refresh notice and batch summary labels", () => {
    expect(
      buildProjectDetailRefreshNotice({
        refreshSource: "reviews",
        refreshItemName: "估算版 V1",
        refreshResult: "已通过",
        refreshBatchCount: 1,
        refreshBatchSummary: null,
      }),
    ).toBe("估算版 V1 已通过，工作台摘要和最近动态已刷新。");
    expect(
      buildProjectDetailRefreshNotice({
        refreshSource: "process-documents",
        refreshItemName: null,
        refreshResult: null,
        refreshBatchCount: 0,
        refreshBatchSummary: null,
      }),
    ).toBe("过程单据处理已完成，工作台摘要和最近动态已刷新。");
    expect(
      buildProjectDetailRefreshBatchSummaryLabel({
        refreshSource: "reviews",
        refreshBatchCount: 2,
        refreshBatchSummary: "预算版 V2已通过、估算版 V1已通过",
      }),
    ).toBe("本轮已处理 2 条审核：预算版 V2已通过、估算版 V1已通过");
  });
});
