import type {
  ProcessDocumentListResponse,
  ProjectWorkspace,
  ReviewSubmissionListResponse,
} from "../../lib/types";

type RefreshResultStatus = "approved" | "rejected" | "cancelled" | "submitted" | null;
type RefreshResultKind = "review" | "process-document" | null;

function clampCount(value: number) {
  return value < 0 ? 0 : value;
}

export function normalizeRefreshResultStatus(value: string | null): RefreshResultStatus {
  if (
    value === "approved" ||
    value === "rejected" ||
    value === "cancelled" ||
    value === "submitted"
  ) {
    return value;
  }
  return null;
}

export function normalizeRefreshResultKind(value: string | null): RefreshResultKind {
  if (value === "review" || value === "process-document") {
    return value;
  }
  return null;
}

export function buildAdjustedWorkspaceSummary(
  workspace: ProjectWorkspace,
  refreshItemKind: RefreshResultKind,
  refreshResult: RefreshResultStatus,
) {
  const nextTodoSummary = { ...workspace.todoSummary };
  const nextRiskSummary = { ...workspace.riskSummary };

  if (refreshItemKind === "review") {
    if (
      refreshResult === "approved" ||
      refreshResult === "rejected" ||
      refreshResult === "cancelled"
    ) {
      nextTodoSummary.pendingReviewCount = clampCount(nextTodoSummary.pendingReviewCount - 1);
      nextTodoSummary.totalCount = clampCount(nextTodoSummary.totalCount - 1);
    }

    if (refreshResult === "rejected") {
      nextRiskSummary.rejectedReviewCount += 1;
      nextRiskSummary.totalCount += 1;
    }
  }

  if (refreshItemKind === "process-document") {
    if (refreshResult === "submitted") {
      nextTodoSummary.draftProcessDocumentCount = clampCount(
        nextTodoSummary.draftProcessDocumentCount - 1,
      );
      nextTodoSummary.pendingProcessDocumentCount += 1;
    }

    if (refreshResult === "approved" || refreshResult === "rejected") {
      nextTodoSummary.pendingProcessDocumentCount = clampCount(
        nextTodoSummary.pendingProcessDocumentCount - 1,
      );
      nextTodoSummary.totalCount = clampCount(nextTodoSummary.totalCount - 1);
    }

    if (refreshResult === "rejected") {
      nextRiskSummary.rejectedProcessDocumentCount += 1;
      nextRiskSummary.totalCount += 1;
    }
  }

  return {
    todoSummary: {
      ...nextTodoSummary,
      items: buildTodoSummaryItems(nextTodoSummary),
    },
    riskSummary: {
      ...nextRiskSummary,
      items: buildRiskSummaryItems(nextRiskSummary),
    },
  };
}

function buildTodoSummaryItems(summary: ProjectWorkspace["todoSummary"]) {
  const items: string[] = [];
  if (summary.pendingReviewCount > 0) {
    items.push(`${summary.pendingReviewCount} 条审核待处理`);
  }
  if (summary.pendingProcessDocumentCount > 0) {
    items.push(`${summary.pendingProcessDocumentCount} 条过程单据待审核`);
  }
  if (summary.draftProcessDocumentCount > 0) {
    items.push(`${summary.draftProcessDocumentCount} 条过程单据仍在草稿`);
  }
  return items;
}

function buildRiskSummaryItems(summary: ProjectWorkspace["riskSummary"]) {
  const items: string[] = [];
  if (summary.rejectedReviewCount > 0) {
    items.push(`${summary.rejectedReviewCount} 条审核被驳回`);
  }
  if (summary.rejectedProcessDocumentCount > 0) {
    items.push(`${summary.rejectedProcessDocumentCount} 条过程单据被退回`);
  }
  if (summary.failedJobCount > 0) {
    items.push(`${summary.failedJobCount} 个任务执行失败`);
  }
  return items;
}

export function buildAdjustedReviewSummary(
  reviews: ReviewSubmissionListResponse,
  refreshItemKind: RefreshResultKind,
  refreshResult: RefreshResultStatus,
) {
  if (
    refreshItemKind !== "review" ||
    (refreshResult !== "approved" &&
      refreshResult !== "rejected" &&
      refreshResult !== "cancelled")
  ) {
    return reviews.summary;
  }

  return {
    ...reviews.summary,
    statusCounts: {
      ...reviews.summary.statusCounts,
      pending: clampCount(reviews.summary.statusCounts.pending - 1),
      approved:
        refreshResult === "approved"
          ? reviews.summary.statusCounts.approved + 1
          : reviews.summary.statusCounts.approved,
      rejected:
        refreshResult === "rejected"
          ? reviews.summary.statusCounts.rejected + 1
          : reviews.summary.statusCounts.rejected,
      cancelled:
        refreshResult === "cancelled"
          ? reviews.summary.statusCounts.cancelled + 1
          : reviews.summary.statusCounts.cancelled,
    },
    actionableCount: clampCount(reviews.summary.actionableCount - 1),
  };
}

export function buildAdjustedProcessDocumentSummary(
  processDocuments: ProcessDocumentListResponse,
  refreshItemKind: RefreshResultKind,
  refreshResult: RefreshResultStatus,
) {
  if (refreshItemKind !== "process-document" || !refreshResult) {
    return processDocuments.summary;
  }

  const nextSummary = {
    ...processDocuments.summary,
    statusCounts: {
      ...processDocuments.summary.statusCounts,
    },
  };

  if (refreshResult === "submitted") {
    nextSummary.statusCounts.draft = clampCount(nextSummary.statusCounts.draft - 1);
    nextSummary.statusCounts.submitted += 1;
    return nextSummary;
  }

  if (refreshResult === "approved" || refreshResult === "rejected") {
    nextSummary.statusCounts.submitted = clampCount(nextSummary.statusCounts.submitted - 1);
  }

  if (refreshResult === "approved") {
    nextSummary.statusCounts.approved += 1;
  }

  if (refreshResult === "rejected") {
    nextSummary.statusCounts.rejected += 1;
  }

  return nextSummary;
}
