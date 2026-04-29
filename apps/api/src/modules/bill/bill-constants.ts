export const billVersionTypes = [
  "initial",
  "reference_copy",
  "contract_baseline",
  "change",
  "settlement",
] as const;

export type BillVersionType = (typeof billVersionTypes)[number];

export const billVersionStatuses = [
  "editable",
  "submitted",
  "approved",
  "locked",
  "rejected",
] as const;

export type BillVersionStatus = (typeof billVersionStatuses)[number];

export const billLockStatuses = [
  "unlocked",
  "lock_requested",
  "locked",
  "unlock_requested",
] as const;

export type BillLockStatus = (typeof billLockStatuses)[number];

export const billValidationStatuses = ["normal", "warning", "error"] as const;

export type BillValidationStatus = (typeof billValidationStatuses)[number];
