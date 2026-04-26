import test from "node:test";
import assert from "node:assert/strict";

import { BackgroundJobProcessor } from "../src/modules/jobs/background-job-processor.js";
import {
  InMemoryBackgroundJobRepository,
  type BackgroundJobRecord,
} from "../src/modules/jobs/background-job-repository.js";
import { BackgroundJobService } from "../src/modules/jobs/background-job-service.js";
import {
  AuditLogService,
} from "../src/modules/audit/audit-log-service.js";
import {
  InMemoryAuditLogRepository,
} from "../src/modules/audit/audit-log-repository.js";
import { InMemoryProjectDisciplineRepository } from "../src/modules/project/project-discipline-repository.js";
import { InMemoryProjectMemberRepository } from "../src/modules/project/project-member-repository.js";
import { InMemoryProjectRepository } from "../src/modules/project/project-repository.js";
import { InMemoryProjectStageRepository } from "../src/modules/project/project-stage-repository.js";

function createBackgroundJobService(seed: BackgroundJobRecord[]) {
  const projectRepository = new InMemoryProjectRepository([]);
  const projectStageRepository = new InMemoryProjectStageRepository([]);
  const projectDisciplineRepository = new InMemoryProjectDisciplineRepository([]);
  const projectMemberRepository = new InMemoryProjectMemberRepository([]);
  const auditLogService = new AuditLogService(
    new InMemoryAuditLogRepository([]),
    projectRepository,
    projectStageRepository,
    projectDisciplineRepository,
    projectMemberRepository,
  );

  return new BackgroundJobService(
    new InMemoryBackgroundJobRepository(seed),
    projectRepository,
    projectStageRepository,
    projectDisciplineRepository,
    projectMemberRepository,
    auditLogService,
  );
}

test("BackgroundJobProcessor completes queued project recalculate jobs", async () => {
  const backgroundJobService = createBackgroundJobService([
    {
      id: "job-001",
      jobType: "project_recalculate",
      status: "queued",
      requestedBy: "engineer-001",
      projectId: "project-001",
      payload: {
        projectId: "project-001",
        stageCode: "estimate",
        disciplineCode: "building",
      },
      result: null,
      errorMessage: null,
      createdAt: "2026-04-18T12:00:00.000Z",
      completedAt: null,
    },
  ]);

  const processor = new BackgroundJobProcessor(backgroundJobService, {
    processProjectRecalculate: async ({ payload, requestedBy }) => ({
      projectId: payload.projectId,
      stageCode: payload.stageCode ?? null,
      disciplineCode: payload.disciplineCode ?? null,
      requestedBy,
      recalculatedCount: 2,
    }),
    processReportExport: async () => {
      throw new Error("unexpected report export execution");
    },
    processKnowledgeExtraction: async () => {
      throw new Error("unexpected knowledge extraction execution");
    },
  });

  const completed = await processor.processJob("job-001");

  assert.equal(completed.status, "completed");
  assert.equal(completed.errorMessage, null);
  assert.ok(completed.completedAt);
  assert.deepEqual(completed.result, {
    projectId: "project-001",
    stageCode: "estimate",
    disciplineCode: "building",
    requestedBy: "engineer-001",
    recalculatedCount: 2,
  });
});

test("BackgroundJobProcessor marks failed jobs when processing throws", async () => {
  const backgroundJobService = createBackgroundJobService([
    {
      id: "job-002",
      jobType: "report_export",
      status: "queued",
      requestedBy: "engineer-001",
      projectId: "project-001",
      payload: {
        projectId: "project-001",
        reportType: "summary",
      },
      result: null,
      errorMessage: null,
      createdAt: "2026-04-18T12:00:00.000Z",
      completedAt: null,
    },
  ]);

  const processor = new BackgroundJobProcessor(backgroundJobService, {
    processProjectRecalculate: async () => ({
      recalculatedCount: 0,
    }),
    processReportExport: async () => {
      throw new Error("export generation failed");
    },
    processKnowledgeExtraction: async () => ({
      knowledgeCount: 0,
    }),
  });

  const failed = await processor.processJob("job-002");

  assert.equal(failed.status, "failed");
  assert.equal(failed.errorMessage, "export generation failed");
  assert.equal(failed.result, null);
  assert.ok(failed.completedAt);
});

test("BackgroundJobProcessor completes queued knowledge extraction jobs", async () => {
  const backgroundJobService = createBackgroundJobService([
    {
      id: "job-003",
      jobType: "knowledge_extraction",
      status: "queued",
      requestedBy: "owner-001",
      projectId: "project-001",
      payload: {
        projectId: "project-001",
        source: "audit_log",
        events: [{ projectId: "project-001", resourceType: "review_submission" }],
      },
      result: null,
      errorMessage: null,
      createdAt: "2026-04-18T12:00:00.000Z",
      completedAt: null,
    },
  ]);

  const processor = new BackgroundJobProcessor(backgroundJobService, {
    processProjectRecalculate: async () => ({
      recalculatedCount: 0,
    }),
    processReportExport: async () => ({
      exported: true,
    }),
    processKnowledgeExtraction: async ({ jobId, payload, requestedBy }) => ({
      jobId,
      projectId: payload.projectId,
      source: payload.source,
      requestedBy,
      knowledgeCount: payload.events.length,
    }),
  });

  const completed = await processor.processJob("job-003");

  assert.equal(completed.status, "completed");
  assert.deepEqual(completed.result, {
    jobId: "job-003",
    projectId: "project-001",
    source: "audit_log",
    requestedBy: "owner-001",
    knowledgeCount: 1,
  });
});

test("BackgroundJobProcessor prefers retryEvents over original events for knowledge extraction jobs", async () => {
  const backgroundJobService = createBackgroundJobService([
    {
      id: "job-004",
      jobType: "knowledge_extraction",
      status: "queued",
      requestedBy: "owner-001",
      projectId: "project-001",
      payload: {
        projectId: "project-001",
        source: "audit_log",
        events: [
          { projectId: "project-001", resourceType: "review_submission" },
          { projectId: "project-001", resourceType: "bill_item" },
        ],
        retryEvents: [{ projectId: "project-001", resourceType: "bill_item" }],
      },
      result: null,
      errorMessage: null,
      createdAt: "2026-04-18T12:00:00.000Z",
      completedAt: null,
    },
  ]);

  const processor = new BackgroundJobProcessor(backgroundJobService, {
    processProjectRecalculate: async () => ({
      recalculatedCount: 0,
    }),
    processReportExport: async () => ({
      exported: true,
    }),
    processKnowledgeExtraction: async ({ payload }) => ({
      knowledgeCount: payload.events.length,
      firstResourceType: payload.events[0]?.resourceType ?? null,
    }),
  });

  const completed = await processor.processJob("job-004");

  assert.equal(completed.status, "completed");
  assert.deepEqual(completed.result, {
    knowledgeCount: 1,
    firstResourceType: "bill_item",
  });
});

test("BackgroundJobService rejects completing jobs that were not started", async () => {
  const backgroundJobService = createBackgroundJobService([
    {
      id: "job-005",
      jobType: "report_export",
      status: "queued",
      requestedBy: "owner-001",
      projectId: "project-001",
      payload: {
        projectId: "project-001",
        reportType: "summary",
      },
      result: null,
      errorMessage: null,
      createdAt: "2026-04-18T12:00:00.000Z",
      completedAt: null,
    },
  ]);

  await assert.rejects(
    () => backgroundJobService.completeJob({
      jobId: "job-005",
      result: { exported: true },
    }),
    {
      statusCode: 409,
      code: "BACKGROUND_JOB_NOT_PROCESSING",
    },
  );
});

test("BackgroundJobService rejects failing jobs that already reached a terminal state", async () => {
  const backgroundJobService = createBackgroundJobService([
    {
      id: "job-006",
      jobType: "project_recalculate",
      status: "completed",
      requestedBy: "owner-001",
      projectId: "project-001",
      payload: {
        projectId: "project-001",
      },
      result: {
        recalculatedCount: 1,
      },
      errorMessage: null,
      createdAt: "2026-04-18T12:00:00.000Z",
      completedAt: "2026-04-18T12:01:00.000Z",
    },
  ]);

  await assert.rejects(
    () => backgroundJobService.failJob({
      jobId: "job-006",
      errorMessage: "late worker failure",
    }),
    {
      statusCode: 409,
      code: "BACKGROUND_JOB_NOT_PROCESSING",
    },
  );
});
