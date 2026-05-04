import test from "node:test";
import assert from "node:assert/strict";

import { executableJobTypes, runWorkerJob } from "../src/main.js";

test("worker exposes executable background job types", () => {
  assert.deepEqual(executableJobTypes, [
    "report_export",
    "project_recalculate",
    "knowledge_extraction",
    "ai_recommendation",
  ]);
});

test("runWorkerJob processes report_export summary jobs", async () => {
  const result = await runWorkerJob(
    {
      id: "job-001",
      jobType: "report_export",
      status: "queued",
      requestedBy: "user-001",
      projectId: "project-001",
      payload: {
        projectId: "project-001",
        reportType: "summary",
      },
      createdAt: "2026-04-17T00:00:00.000Z",
    },
    {
      fetchSummary: async () => ({ totalFinalAmount: 123.45 }),
      fetchVariance: async () => ({ items: [] }),
      recalculateProject: async () => ({ versions: [] }),
      aiRuntimeClient: { processEventBatch: async () => ({}) } as never,
    },
  );

  assert.equal(result.status, "completed");
  assert.deepEqual(result.result, { totalFinalAmount: 123.45 });
});

test("runWorkerJob processes report_export variance jobs", async () => {
  const result = await runWorkerJob(
    {
      id: "job-002",
      jobType: "report_export",
      status: "queued",
      requestedBy: "user-001",
      projectId: "project-001",
      payload: {
        projectId: "project-001",
        reportType: "variance",
        stageCode: "construction",
      },
      createdAt: "2026-04-17T00:00:00.000Z",
    },
    {
      fetchSummary: async () => ({ totalFinalAmount: 0 }),
      fetchVariance: async (input) => ({
        stageCode: input.stageCode ?? null,
        items: [{ itemId: "bill-item-001" }],
      }),
      recalculateProject: async () => ({ versions: [] }),
      aiRuntimeClient: { processEventBatch: async () => ({}) } as never,
    },
  );

  assert.equal(result.status, "completed");
  assert.deepEqual(result.result, {
    stageCode: "construction",
    items: [{ itemId: "bill-item-001" }],
  });
});

test("runWorkerJob processes report_export stage bill jobs", async () => {
  const result = await runWorkerJob(
    {
      id: "job-005",
      jobType: "report_export",
      status: "queued",
      requestedBy: "user-001",
      projectId: "project-001",
      payload: {
        projectId: "project-001",
        reportType: "stage_bill",
        stageCode: "estimate",
      },
      createdAt: "2026-04-17T00:00:00.000Z",
    },
    {
      fetchSummary: async (input) => ({
        projectId: input.projectId,
        stageCode: input.stageCode ?? null,
      }),
      fetchVariance: async (input) => ({
        limit: input.limit ?? null,
        items: [{ itemId: "bill-item-001" }],
      }),
      recalculateProject: async () => ({ versions: [] }),
      aiRuntimeClient: { processEventBatch: async () => ({}) } as never,
    },
  );

  assert.equal(result.status, "completed");
  assert.deepEqual(result.result, {
    template: "stage_bill",
    summary: {
      projectId: "project-001",
      stageCode: "estimate",
    },
    details: {
      limit: 100,
      items: [{ itemId: "bill-item-001" }],
    },
  });
});

test("runWorkerJob processes project_recalculate jobs", async () => {
  const result = await runWorkerJob(
    {
      id: "job-003",
      jobType: "project_recalculate",
      status: "queued",
      requestedBy: "user-001",
      projectId: "project-001",
      payload: {
        projectId: "project-001",
        disciplineCode: "building",
      },
      createdAt: "2026-04-17T00:00:00.000Z",
    },
    {
      fetchSummary: async () => ({ totalFinalAmount: 0 }),
      fetchVariance: async () => ({ items: [] }),
      recalculateProject: async (input) => ({
        projectId: input.projectId,
        disciplineCode: input.disciplineCode ?? null,
        recalculatedCount: 2,
      }),
      aiRuntimeClient: { processEventBatch: async () => ({}) } as never,
    },
  );

  assert.equal(result.status, "completed");
  assert.deepEqual(result.result, {
    projectId: "project-001",
    disciplineCode: "building",
    recalculatedCount: 2,
  });
});

test("runWorkerJob returns failed status for processor errors", async () => {
  const result = await runWorkerJob(
    {
      id: "job-004",
      jobType: "project_recalculate",
      status: "queued",
      requestedBy: "user-001",
      projectId: "project-001",
      payload: {
        projectId: "project-001",
      },
      createdAt: "2026-04-17T00:00:00.000Z",
    },
    {
      fetchSummary: async () => ({ totalFinalAmount: 0 }),
      fetchVariance: async () => ({ items: [] }),
      recalculateProject: async () => {
        throw new Error("recalculate failed");
      },
      aiRuntimeClient: { processEventBatch: async () => ({}) } as never,
    },
  );

  assert.equal(result.status, "failed");
  assert.equal(result.errorMessage, "recalculate failed");
});

test("runWorkerJob processes knowledge extraction jobs", async () => {
  const result = await runWorkerJob(
    {
      id: "job-005",
      jobType: "knowledge_extraction",
      status: "queued",
      requestedBy: "user-001",
      projectId: "project-001",
      payload: {
        projectId: "project-001",
        source: "audit_log",
        events: [{ projectId: "project-001", resourceType: "review_submission" }],
      },
      createdAt: "2026-04-17T00:00:00.000Z",
    },
    {
      fetchSummary: async () => ({ totalFinalAmount: 0 }),
      fetchVariance: async () => ({ items: [] }),
      recalculateProject: async () => ({ versions: [] }),
      aiRuntimeClient: {
        processEventBatch: async () => ({
          runtime: "saas-pricing-ai-runtime:knowledge-memory-agent-runtime",
          result: { summary: { knowledgeCount: 1 } },
        }),
      } as never,
    },
  );

  assert.equal(result.status, "completed");
  assert.deepEqual(result.result, {
    runtime: "saas-pricing-ai-runtime:knowledge-memory-agent-runtime",
    result: { summary: { knowledgeCount: 1 } },
  });
});

test("runWorkerJob preserves AI recommendation provider failure summary", async () => {
  const result = await runWorkerJob(
    {
      id: "job-006",
      jobType: "ai_recommendation",
      status: "queued",
      requestedBy: "user-001",
      projectId: "project-001",
      payload: {
        projectId: "project-001",
        recommendationType: "bill_recommendation",
        resourceType: "bill_version",
        resourceId: "bill-version-001",
      },
      createdAt: "2026-04-17T00:00:00.000Z",
    },
    {
      fetchSummary: async () => ({ totalFinalAmount: 0 }),
      fetchVariance: async () => ({ items: [] }),
      recalculateProject: async () => ({ versions: [] }),
      generateAiRecommendations: async () => {
        throw new Error("AI provider response is invalid");
      },
      aiRuntimeClient: { processEventBatch: async () => ({}) } as never,
    },
  );

  assert.equal(result.status, "failed");
  assert.equal(result.errorMessage, "AI provider response is invalid");
  assert.deepEqual(result.result?.providerFailureSummary, {
    message: "AI provider response is invalid",
    manualActionRequired: true,
  });
});
