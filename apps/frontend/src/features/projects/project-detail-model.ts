import type { AuditLogRecord } from "../../lib/types";
import { appendFailureCollaborationParams } from "./failure-reason-label";

export function formatResourceType(resourceType: string) {
  if (resourceType === "review_submission") {
    return "审核";
  }
  if (resourceType === "process_document") {
    return "过程单据";
  }
  if (resourceType === "background_job") {
    return "异步任务";
  }
  if (resourceType === "bill_version") {
    return "清单版本";
  }
  if (resourceType === "project_stage") {
    return "项目阶段";
  }
  if (resourceType === "project") {
    return "项目";
  }
  return resourceType;
}

export function formatAction(action: string) {
  if (action === "submit") {
    return "已提交";
  }
  if (action === "approve") {
    return "已通过";
  }
  if (action === "reject") {
    return "已驳回";
  }
  if (action === "cancel") {
    return "已撤回";
  }
  if (action === "retried") {
    return "已重试";
  }
  if (action === "queued") {
    return "已入队";
  }
  if (action === "completed") {
    return "已完成";
  }
  if (action === "failed") {
    return "已失败";
  }
  if (action === "update") {
    return "已更新";
  }
  if (action === "delete") {
    return "已删除";
  }
  if (action === "create") {
    return "已创建";
  }
  return action;
}

export function buildActivityPath(
  projectId: string,
  item: AuditLogRecord,
  failureReason?: string | null,
  failureResourceType?: string | null,
  failureAction?: string | null,
): string | null {
  if (item.resourceType === "review_submission") {
    return `/projects/${projectId}/reviews?reviewId=${item.resourceId}&action=${item.action}`;
  }
  if (item.resourceType === "process_document") {
    return `/projects/${projectId}/process-documents?documentId=${item.resourceId}&action=${item.action}`;
  }
  if (item.resourceType === "background_job") {
    const params = new URLSearchParams();
    params.set("jobId", item.resourceId);
    if (failureReason) {
      params.set("status", "failed");
      appendFailureCollaborationParams(params, {
        failureReason,
        failureResourceType,
        failureAction,
      });
    }
    return `/projects/${projectId}/jobs?${params.toString()}`;
  }
  if (item.resourceType === "bill_version") {
    return `/projects/${projectId}`;
  }
  return null;
}

export function formatResultStatus(value: string | null) {
  if (value === "approved") {
    return "已通过";
  }
  if (value === "rejected") {
    return "已驳回";
  }
  if (value === "cancelled") {
    return "已撤回";
  }
  if (value === "submitted") {
    return "已提交";
  }
  return null;
}

export function clearRefreshState(searchParams: URLSearchParams) {
  const next = new URLSearchParams(searchParams);
  next.delete("refresh");
  next.delete("resultStatus");
  next.delete("resultName");
  next.delete("resultKind");
  next.delete("resultId");
  next.delete("batchCount");
  next.delete("batchSummary");
  next.delete("batchIds");
  return next;
}

export function buildSummaryItemPath(projectId: string, item: string) {
  if (item.includes("审核待处理")) {
    return `/projects/${projectId}/reviews?filter=pending&summaryFocus=pending`;
  }
  if (item.includes("审核被驳回")) {
    return `/projects/${projectId}/reviews?filter=rejected&summaryFocus=rejected`;
  }
  if (item.includes("过程单据待审核")) {
    return `/projects/${projectId}/process-documents?filter=submitted&summaryFocus=submitted`;
  }
  if (item.includes("过程单据仍在草稿")) {
    return `/projects/${projectId}/process-documents?filter=draft&summaryFocus=draft`;
  }
  if (item.includes("过程单据被退回")) {
    return `/projects/${projectId}/process-documents?filter=rejected&summaryFocus=rejected`;
  }
  if (item.includes("任务执行失败")) {
    return `/projects/${projectId}/jobs?status=failed`;
  }
  return null;
}

export function matchesRefreshResourceType(
  refreshItemKind: string | null,
  resourceType: AuditLogRecord["resourceType"],
) {
  return (
    (refreshItemKind === "review" && resourceType === "review_submission") ||
    (refreshItemKind === "process-document" && resourceType === "process_document")
  );
}

export function buildProjectDetailRefreshNotice(input: {
  refreshSource: string | null;
  refreshItemName: string | null;
  refreshResult: string | null;
  refreshBatchCount: number;
  refreshBatchSummary: string | null;
}) {
  if (input.refreshSource === "reviews") {
    return input.refreshBatchCount > 1 && input.refreshBatchSummary
      ? `本轮已处理 ${input.refreshBatchCount} 条审核：${input.refreshBatchSummary}，工作台摘要和最近动态已刷新。`
      : input.refreshResult && input.refreshItemName
        ? `${input.refreshItemName} ${input.refreshResult}，工作台摘要和最近动态已刷新。`
        : "审核处理已完成，工作台摘要和最近动态已刷新。";
  }

  if (input.refreshSource === "process-documents") {
    return input.refreshBatchCount > 1 && input.refreshBatchSummary
      ? `本轮已处理 ${input.refreshBatchCount} 条过程单据：${input.refreshBatchSummary}，工作台摘要和最近动态已刷新。`
      : input.refreshResult && input.refreshItemName
        ? `${input.refreshItemName} ${input.refreshResult}，工作台摘要和最近动态已刷新。`
        : "过程单据处理已完成，工作台摘要和最近动态已刷新。";
  }

  if (input.refreshSource === "jobs") {
    return "任务状态已更新，工作台摘要和最近动态已刷新。";
  }

  return null;
}

export function buildProjectDetailRefreshBatchSummaryLabel(input: {
  refreshSource: string | null;
  refreshBatchCount: number;
  refreshBatchSummary: string | null;
}) {
  if (input.refreshBatchCount <= 1 || !input.refreshBatchSummary) {
    return null;
  }

  if (input.refreshSource === "reviews") {
    return `本轮已处理 ${input.refreshBatchCount} 条审核：${input.refreshBatchSummary}`;
  }

  if (input.refreshSource === "process-documents") {
    return `本轮已处理 ${input.refreshBatchCount} 条过程单据：${input.refreshBatchSummary}`;
  }

  return null;
}
