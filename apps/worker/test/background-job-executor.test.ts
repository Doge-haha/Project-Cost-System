import test from "node:test";
import assert from "node:assert/strict";

import { BackgroundJobExecutor } from "../src/main.js";

test("BackgroundJobExecutor completes report export jobs with result payload", async () => {
  const executor = new BackgroundJobExecutor({
    now: () => "2026-04-17T08:00:00.000Z",
    fetchSummary: async () => ({ totalFinalAmount: 321 }),
    fetchVariance: async () => ({ items: [] }),
    recalculateProject: async () => ({ recalculatedCount: 0 }),
    aiRuntimeClient: { processEventBatch: async () => ({}) } as never,
  });

  const executed = await executor.execute({
    id: "job-001",
    jobType: "report_export",
    status: "queued",
    requestedBy: "user-001",
    projectId: "project-001",
    payload: {
      projectId: "project-001",
      reportType: "summary",
      reportTemplateId: "tpl-standard-summary-v1",
      outputFormat: "excel",
    },
    createdAt: "2026-04-17T07:59:00.000Z",
  });

  assert.equal(executed.status, "completed");
  assert.equal(executed.completedAt, "2026-04-17T08:00:00.000Z");
  assert.deepEqual(executed.result, {
    totalFinalAmount: 321,
    reportTemplateId: "tpl-standard-summary-v1",
    outputFormat: "excel",
  });
});

test("BackgroundJobExecutor records failed execution details", async () => {
  const executor = new BackgroundJobExecutor({
    fetchSummary: async () => ({ totalFinalAmount: 0 }),
    fetchVariance: async () => ({ items: [] }),
    recalculateProject: async () => {
      throw new Error("queue processor exploded");
    },
    aiRuntimeClient: { processEventBatch: async () => ({}) } as never,
  });

  const executed = await executor.execute({
    id: "job-002",
    jobType: "project_recalculate",
    status: "queued",
    requestedBy: "user-001",
    projectId: "project-001",
    payload: {
      projectId: "project-001",
    },
    createdAt: "2026-04-17T07:59:00.000Z",
  });

  assert.equal(executed.status, "failed");
  assert.equal(executed.errorMessage, "queue processor exploded");
  assert.ok(executed.completedAt.length > 0);
});

test("BackgroundJobExecutor completes knowledge extraction jobs with structured result", async () => {
  const executor = new BackgroundJobExecutor({
    now: () => "2026-04-17T08:00:00.000Z",
    fetchSummary: async () => ({ totalFinalAmount: 0 }),
    fetchVariance: async () => ({ items: [] }),
    recalculateProject: async () => ({ recalculatedCount: 0 }),
    aiRuntimeClient: {
      processEventBatch: async () => ({
        runtime: "saas-pricing-ai-runtime:knowledge-memory-agent-runtime",
        result: { summary: { knowledgeCount: 1 } },
      }),
    } as never,
  });

  const executed = await executor.execute({
    id: "job-003",
    jobType: "knowledge_extraction",
    status: "queued",
    requestedBy: "user-001",
    projectId: "project-001",
    payload: {
      projectId: "project-001",
      source: "audit_log",
      events: [{ projectId: "project-001", resourceType: "review_submission" }],
    },
    createdAt: "2026-04-17T07:59:00.000Z",
  });

  assert.equal(executed.status, "completed");
  assert.deepEqual(executed.result, {
    runtime: "saas-pricing-ai-runtime:knowledge-memory-agent-runtime",
    result: { summary: { knowledgeCount: 1 } },
  });
});
