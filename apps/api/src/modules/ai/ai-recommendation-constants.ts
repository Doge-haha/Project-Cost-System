export const aiRecommendationTypes = [
  "bill_recommendation",
  "quota_recommendation",
  "variance_warning",
] as const;

export type AiRecommendationType = (typeof aiRecommendationTypes)[number];

export const aiRecommendationStatuses = [
  "generated",
  "accepted",
  "ignored",
  "expired",
] as const;

export type AiRecommendationStatus = (typeof aiRecommendationStatuses)[number];

export const aiTaskFailureCodes = [
  "AI_PROVIDER_TIMEOUT",
  "AI_PROVIDER_RATE_LIMITED",
  "AI_PROVIDER_UNAVAILABLE",
  "AI_PROVIDER_BAD_RESPONSE",
  "AI_CONTEXT_INCOMPLETE",
  "AI_RESULT_VALIDATION_FAILED",
  "AI_TASK_CANCELLED",
  "AI_TASK_UNKNOWN_FAILURE",
] as const;

export type AiTaskFailureCode = (typeof aiTaskFailureCodes)[number];
