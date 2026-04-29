export const reviewSubmissionStatuses = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
] as const;

export type ReviewSubmissionStatus = (typeof reviewSubmissionStatuses)[number];

export const reviewSubmissionTypes = [
  "stage_submit",
  "lock_request",
  "unlock_request",
] as const;

export type ReviewSubmissionType = (typeof reviewSubmissionTypes)[number];
