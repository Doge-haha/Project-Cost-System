import test from "node:test";
import assert from "node:assert/strict";

import { executableJobTypes, runWorkerJob } from "../src/main.js";

test("worker exposes executable background job types", () => {
  assert.deepEqual(executableJobTypes, [
    "report_export",
    "project_recalculate",
    "knowledge_extraction",
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
        reportTemplateId: "tpl-standard-summary-v1",
        outputFormat: "pdf",
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
  assert.deepEqual(result.result, {
    totalFinalAmount: 123.45,
    reportTemplateId: "tpl-standard-summary-v1",
    outputFormat: "pdf",
  });
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
    reportTemplateId: null,
    outputFormat: "json",
  });
});

test("runWorkerJob processes report_export stage bill jobs", async () => {
  const result = await runWorkerJob(
    {
      id: "job-stage-bill-001",
      jobType: "report_export",
      status: "queued",
      requestedBy: "user-001",
      projectId: "project-001",
      payload: {
        projectId: "project-001",
        reportType: "stage_bill",
        stageCode: "estimate",
        disciplineCode: "building",
        reportTemplateId: "tpl-standard-stage-bill-v1",
        outputFormat: "excel",
      },
      createdAt: "2026-04-17T00:00:00.000Z",
    },
    {
      fetchSummary: async () => ({ totalFinalAmount: 0 }),
      fetchVariance: async (input) => ({
        limit: input.limit,
        items: [{ itemCode: "010101001", finalAmount: 100 }],
      }),
      recalculateProject: async () => ({ versions: [] }),
      aiRuntimeClient: { processEventBatch: async () => ({}) } as never,
    },
  );

  assert.equal(result.status, "completed");
  assert.deepEqual(result.result, {
    reportType: "stage_bill",
    projectId: "project-001",
    stageCode: "estimate",
    disciplineCode: "building",
    limit: 100,
    items: [{ itemCode: "010101001", finalAmount: 100 }],
    reportTemplateId: "tpl-standard-stage-bill-v1",
    outputFormat: "excel",
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
