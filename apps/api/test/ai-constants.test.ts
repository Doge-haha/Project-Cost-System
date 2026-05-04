import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_RECOMMENDATION_STATUSES,
  AI_RECOMMENDATION_TYPES,
  AI_TASK_FAILURE_ERROR_CODES,
} from "../src/modules/ai/ai-constants.js";
import {
  KNOWLEDGE_AUDIT_ACTIONS,
  KNOWLEDGE_ENTRY_TYPES,
  MEMORY_ENTRY_SCOPES,
} from "../src/modules/knowledge/knowledge-service.js";

test("Iteration 5 AI and knowledge constants stay stable", () => {
  assert.deepEqual(AI_RECOMMENDATION_TYPES, [
    "bill_recommendation",
    "quota_recommendation",
    "variance_warning",
  ]);
  assert.deepEqual(AI_RECOMMENDATION_STATUSES, [
    "generated",
    "accepted",
    "ignored",
    "expired",
    "rolled_back",
  ]);
  assert.deepEqual(AI_TASK_FAILURE_ERROR_CODES, [
    "AI_RUNTIME_EXECUTION_FAILED",
    "AI_RUNTIME_INVALID_RESPONSE",
    "AI_RECOMMENDATION_NOT_FOUND",
    "AI_RECOMMENDATION_ALREADY_HANDLED",
    "AI_RECOMMENDATION_ACCEPT_PAYLOAD_INCOMPLETE",
  ]);
  assert.deepEqual(KNOWLEDGE_ENTRY_TYPES, [
    "project_retrospective",
    "review_submission",
    "ai_recommendation",
  ]);
  assert.deepEqual(MEMORY_ENTRY_SCOPES, [
    "project",
    "organization",
    "ai_runtime",
    "user",
  ]);
  assert.deepEqual(KNOWLEDGE_AUDIT_ACTIONS, {
    createKnowledgeEntry: "knowledge_entry.create",
    createMemoryEntry: "memory_entry.create",
    createKnowledgeRelation: "knowledge_relation.create",
  });
});
