export const AI_RECOMMENDATION_TYPES = [
  "bill_recommendation",
  "quota_recommendation",
  "variance_warning",
] as const;

export const AI_RECOMMENDATION_STATUSES = [
  "generated",
  "accepted",
  "ignored",
  "expired",
  "rolled_back",
] as const;

export const AI_TASK_FAILURE_ERROR_CODES = [
  "AI_RUNTIME_EXECUTION_FAILED",
  "AI_RUNTIME_INVALID_RESPONSE",
  "AI_RECOMMENDATION_NOT_FOUND",
  "AI_RECOMMENDATION_ALREADY_HANDLED",
  "AI_RECOMMENDATION_ACCEPT_PAYLOAD_INCOMPLETE",
] as const;

export const AI_RECOMMENDATION_ROLLBACK_BLOCKED_REASONS = [
  "resource_missing",
  "resource_modified",
  "resource_has_children",
  "resource_has_quota_lines",
] as const;

export const AI_RECOMMENDATION_ROLLBACK_BLOCKED_REASON_LABELS: Record<
  AiRecommendationRollbackBlockedReason,
  string
> = {
  resource_missing: "业务资源已缺失",
  resource_modified: "业务资源已被修改",
  resource_has_children: "清单下存在子清单",
  resource_has_quota_lines: "清单下存在定额行",
};

export type AiRecommendationType = (typeof AI_RECOMMENDATION_TYPES)[number];
export type AiRecommendationStatus = (typeof AI_RECOMMENDATION_STATUSES)[number];
export type AiTaskFailureErrorCode = (typeof AI_TASK_FAILURE_ERROR_CODES)[number];
export type AiRecommendationRollbackBlockedReason =
  (typeof AI_RECOMMENDATION_ROLLBACK_BLOCKED_REASONS)[number];
