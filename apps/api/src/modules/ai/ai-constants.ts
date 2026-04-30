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

export type AiRecommendationType = (typeof AI_RECOMMENDATION_TYPES)[number];
export type AiRecommendationStatus = (typeof AI_RECOMMENDATION_STATUSES)[number];
export type AiTaskFailureErrorCode = (typeof AI_TASK_FAILURE_ERROR_CODES)[number];
