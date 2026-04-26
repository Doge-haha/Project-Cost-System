export type ReviewFilter = "all" | "pending" | "rejected" | "actionable";
export type ReviewSummaryFocus = "pending" | "rejected" | null;

export type CompletedReviewState = {
  reviewId: string;
  versionName: string;
  status: string;
  detail: string;
};

export type ReviewActionState = {
  mode: "approve" | "reject" | "cancel";
  reviewId: string;
};

type ReviewStatusHintInput = {
  status: "pending" | "approved" | "rejected" | "cancelled";
  canApprove: boolean;
  canReject: boolean;
  canCancel: boolean;
};

type ReviewActionCandidate = {
  id: string;
  canApprove: boolean;
  canReject: boolean;
  canCancel: boolean;
  rejectionReason?: string | null;
};

export function buildReviewStatusHint(
  review: ReviewStatusHintInput,
) {
  if (review.status === "pending" && (review.canApprove || review.canReject)) {
    return "待审核，可由当前角色执行通过或驳回。";
  }
  if (review.status === "pending" && review.canCancel) {
    return "待审核，当前提交人可先撤回再继续调整。";
  }
  if (review.status === "pending") {
    return "待审核，当前角色暂无处理权限，请等待对应审核人处理。";
  }
  if (review.status === "approved") {
    return "审核已通过，可回到工作台继续查看后续流转。";
  }
  if (review.status === "rejected") {
    return "审核已驳回，建议先根据驳回原因补充说明后再重新提交。";
  }
  return "审核已撤回，可回到清单版本继续调整后重新发起。";
}

export function buildReviewReturnQuery(
  resultStatus: string,
  versionName: string,
  reviewId: string,
) {
  const query = new URLSearchParams();
  query.set("refresh", "reviews");
  query.set("resultStatus", resultStatus);
  query.set("resultName", versionName);
  query.set("resultKind", "review");
  query.set("resultId", reviewId);
  return query.toString();
}

export function appendReviewBatchSummary(
  queryString: string,
  completedReviews: CompletedReviewState[],
) {
  if (completedReviews.length <= 1) {
    return queryString;
  }

  const query = new URLSearchParams(queryString);
  query.set("batchCount", String(completedReviews.length));
  query.set(
    "batchSummary",
    completedReviews
      .map(
        (review) =>
          `${review.versionName}${review.status === "approved" ? "已通过" : review.status === "rejected" ? "已驳回" : "已撤回"}`,
      )
      .join("、"),
  );
  query.set("batchIds", completedReviews.map((review) => review.reviewId).join(","));
  return query.toString();
}

export function normalizeReviewFilter(value: string | null): ReviewFilter {
  if (value === "pending" || value === "rejected" || value === "actionable") {
    return value;
  }
  return "all";
}

export function normalizeReviewSummaryFocus(value: string | null): ReviewSummaryFocus {
  if (value === "pending" || value === "rejected") {
    return value;
  }
  return null;
}

export function buildNextReviewActionState(
  reviews: ReviewActionCandidate[],
  excludeReviewId?: string,
): { reviewId: string; mode: ReviewActionState["mode"]; reason: string } | null {
  const nextReview = reviews.find(
    (review) =>
      review.id !== excludeReviewId &&
      (review.canApprove || review.canReject || review.canCancel),
  );

  if (!nextReview) {
    return null;
  }

  return {
    reviewId: nextReview.id,
    mode: nextReview.canApprove
      ? ("approve" as const)
      : nextReview.canReject
        ? ("reject" as const)
        : ("cancel" as const),
    reason: nextReview.rejectionReason ?? "",
  };
}
