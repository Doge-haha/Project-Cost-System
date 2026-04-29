export const quotaLineSourceModes = [
  "manual",
  "ai",
  "history_reference",
  "reference_knowledge",
] as const;

export type QuotaLineSourceMode = (typeof quotaLineSourceModes)[number];

export const priceVersionStatuses = ["draft", "active", "inactive"] as const;

export type PriceVersionStatus = (typeof priceVersionStatuses)[number];

export const feeTemplateStatuses = ["draft", "active", "inactive"] as const;

export type FeeTemplateStatus = (typeof feeTemplateStatuses)[number];

export const pricingValueFieldPrefixes = ["system", "manual", "final"] as const;

export type PricingValueFieldPrefix = (typeof pricingValueFieldPrefixes)[number];

export const quotaValidationStatuses = ["normal", "warning", "error"] as const;

export type QuotaValidationStatus = (typeof quotaValidationStatuses)[number];
