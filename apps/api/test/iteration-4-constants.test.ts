import test from "node:test";
import assert from "node:assert/strict";

import { backgroundJobStatuses } from "@saas-pricing/job-contracts";

import {
  aiRecommendationStatuses,
  aiRecommendationTypes,
  aiTaskFailureCodes,
} from "../src/modules/ai/ai-recommendation-constants.js";
import {
  iteration4AuditActions,
  auditLogActions,
} from "../src/modules/audit/audit-log-constants.js";
import {
  billLockStatuses,
  billValidationStatuses,
  billVersionStatuses,
  billVersionTypes,
} from "../src/modules/bill/bill-constants.js";
import {
  knowledgeRelationTypes,
  knowledgeSourceTypes,
  memorySubjectTypes,
} from "../src/modules/knowledge/knowledge-constants.js";
import {
  importTaskErrorCodes,
  importTaskStatuses,
} from "../src/modules/import/import-task-constants.js";
import {
  feeTemplateStatuses,
  priceVersionStatuses,
  pricingValueFieldPrefixes,
  quotaLineSourceModes,
  quotaValidationStatuses,
} from "../src/modules/pricing/pricing-constants.js";
import {
  defaultSourceSystemCode,
  sourceSystemCodes,
} from "../src/modules/master-data/master-data-constants.js";
import {
  businessIdentityCodes,
  platformRoleCodes,
  projectPermissionActions,
  projectResourceTypes,
  projectStageStatuses,
  projectStatuses,
  standardProjectStageTemplates,
} from "../src/modules/project/project-constants.js";
import {
  reviewSubmissionStatuses,
  reviewSubmissionTypes,
} from "../src/modules/review/review-submission-constants.js";

test("iteration 1 project permission constants keep the documented enum values stable", () => {
  assert.deepEqual(projectStatuses, [
    "draft",
    "in_progress",
    "under_review",
    "archived",
  ]);
  assert.deepEqual(projectStageStatuses, [
    "not_started",
    "in_progress",
    "pending_review",
    "approved",
    "completed",
    "skipped",
  ]);
  assert.deepEqual(platformRoleCodes, [
    "system_admin",
    "project_owner",
    "cost_engineer",
    "reviewer",
  ]);
  assert.deepEqual(businessIdentityCodes, [
    "tender_cost_engineer",
    "bid_cost_engineer",
    "audit_reviewer",
  ]);
  assert.deepEqual(projectResourceTypes, [
    "project",
    "stage",
    "project_discipline",
    "standard_set",
  ]);
  assert.deepEqual(projectPermissionActions, [
    "view",
    "edit",
    "submit",
    "review",
    "import",
  ]);
  assert.deepEqual(
    standardProjectStageTemplates.map((stage) => stage.stageCode),
    [
      "estimate",
      "target_cost",
      "bid_bill",
      "control_price",
      "bid_quote",
      "contract_bill",
      "construction",
      "settlement",
      "retrospective",
    ],
  );
  assert.deepEqual(sourceSystemCodes, ["xindian_jiangsu"]);
  assert.equal(defaultSourceSystemCode, "xindian_jiangsu");
  assert.deepEqual(importTaskStatuses, [
    "queued",
    "processing",
    "completed",
    "failed",
  ]);
  assert.deepEqual(importTaskErrorCodes, [
    "IMPORT_TASK_NOT_FOUND",
    "IMPORT_TASK_RETRY_LIMIT_REACHED",
    "IMPORT_TASK_RETRY_INPUT_INCOMPLETE",
    "IMPORT_TASK_RETRY_INPUT_UNAVAILABLE",
  ]);
});

test("iteration 2 bill constants keep the documented enum values stable", () => {
  assert.deepEqual(billVersionTypes, [
    "initial",
    "reference_copy",
    "contract_baseline",
    "change",
    "settlement",
  ]);
  assert.deepEqual(billVersionStatuses, [
    "editable",
    "submitted",
    "approved",
    "locked",
    "rejected",
  ]);
  assert.deepEqual(billLockStatuses, [
    "unlocked",
    "lock_requested",
    "locked",
    "unlock_requested",
  ]);
  assert.deepEqual(billValidationStatuses, ["normal", "warning", "error"]);
});

test("iteration 3 pricing constants keep the documented enum values stable", () => {
  assert.deepEqual(quotaLineSourceModes, [
    "manual",
    "ai",
    "history_reference",
    "reference_knowledge",
  ]);
  assert.deepEqual(priceVersionStatuses, ["draft", "active", "inactive"]);
  assert.deepEqual(feeTemplateStatuses, ["draft", "active", "inactive"]);
  assert.deepEqual(pricingValueFieldPrefixes, ["system", "manual", "final"]);
  assert.deepEqual(quotaValidationStatuses, ["normal", "warning", "error"]);
});

test("iteration 4 workflow constants keep the documented enum values stable", () => {
  assert.deepEqual(reviewSubmissionStatuses, [
    "pending",
    "approved",
    "rejected",
    "cancelled",
  ]);
  assert.deepEqual(reviewSubmissionTypes, [
    "stage_submit",
    "lock_request",
    "unlock_request",
  ]);
  assert.deepEqual(backgroundJobStatuses, [
    "queued",
    "processing",
    "completed",
    "failed",
  ]);
  assert.deepEqual(iteration4AuditActions, [
    "create",
    "update",
    "submit",
    "approve",
    "reject",
    "lock",
    "unlock",
    "export",
  ]);

  assert.ok(
    iteration4AuditActions.every((action) => auditLogActions.includes(action)),
  );
});

test("iteration 5 AI knowledge constants keep the documented enum values stable", () => {
  assert.deepEqual(aiRecommendationTypes, [
    "bill_recommendation",
    "quota_recommendation",
    "variance_warning",
  ]);
  assert.deepEqual(aiRecommendationStatuses, [
    "generated",
    "accepted",
    "ignored",
    "expired",
  ]);
  assert.deepEqual(aiTaskFailureCodes, [
    "AI_PROVIDER_TIMEOUT",
    "AI_PROVIDER_RATE_LIMITED",
    "AI_PROVIDER_UNAVAILABLE",
    "AI_PROVIDER_BAD_RESPONSE",
    "AI_CONTEXT_INCOMPLETE",
    "AI_RESULT_VALIDATION_FAILED",
    "AI_TASK_CANCELLED",
    "AI_TASK_UNKNOWN_FAILURE",
  ]);
  assert.deepEqual(knowledgeSourceTypes, [
    "audit_log",
    "ai_recommendation",
    "file_upload",
    "project_retrospective",
    "review_submission",
  ]);
  assert.deepEqual(memorySubjectTypes, [
    "ai_runtime",
    "organization",
    "project",
    "user",
  ]);
  assert.deepEqual(knowledgeRelationTypes, [
    "derived_memory",
    "supports_recommendation",
    "explains_variance",
    "supersedes",
  ]);
});
