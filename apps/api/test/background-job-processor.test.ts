import test from "node:test";
import assert from "node:assert/strict";

import { BackgroundJobProcessor } from "../src/modules/jobs/background-job-processor.js";
import {
  DbBackgroundJobRepository,
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
import { createPgMemDatabase } from "./helpers/pg-mem.js";

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
    processAiRecommendation: async () => {
      throw new Error("unexpected ai recommendation execution");
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
    processAiRecommendation: async () => ({
      createdCount: 0,
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
    processAiRecommendation: async () => ({
      createdCount: 0,
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
    processAiRecommendation: async () => ({
      createdCount: 0,
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

test("DbBackgroundJobRepository applies filters before limit", async () => {
  const runtime = await createPgMemDatabase();
  try {
    await runtime.pool.query(
      "insert into project (id, code, name, status) values ('project-001', 'PRJ-001', '项目一', 'draft'), ('project-002', 'PRJ-002', '项目二', 'draft')",
    );
    await runtime.pool.query(`
      insert into background_job
        (id, job_type, status, requested_by, project_id, payload, result, error_message, created_at, completed_at)
      values
        ('job-other-newer', 'ai_recommendation', 'completed', 'engineer-002', 'project-002', '{"projectId":"project-002"}', null, null, '2026-04-20T12:00:00.000Z', '2026-04-20T12:00:01.000Z'),
        ('job-target', 'ai_recommendation', 'failed', 'engineer-001', 'project-001', '{"projectId":"project-001"}', null, 'provider failed', '2026-04-20T11:00:00.000Z', '2026-04-20T11:00:01.000Z'),
        ('job-target-other-type', 'project_recalculate', 'completed', 'engineer-001', 'project-001', '{"projectId":"project-001"}', null, null, '2026-04-20T10:00:00.000Z', '2026-04-20T10:00:01.000Z')
    `);
    const repository = new DbBackgroundJobRepository(runtime.db);

    const records = await repository.list({
      projectId: "project-001",
      jobType: "ai_recommendation",
      limit: 1,
    });

    assert.deepEqual(
      records.map((record) => record.id),
      ["job-target"],
    );
  } finally {
    await runtime.close();
  }
});

test("DbBackgroundJobRepository creates, finds, updates, and filters jobs", async () => {
  const runtime = await createPgMemDatabase();
  try {
    await runtime.pool.query(
      "insert into project (id, code, name, status) values ('project-001', 'PRJ-001', '项目一', 'draft')",
    );
    const repository = new DbBackgroundJobRepository(runtime.db);

    const created = await repository.create({
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
      createdAt: "2026-04-20T08:00:00.000Z",
      completedAt: null,
    });
    const found = await repository.findById(created.id);
    const updated = await repository.update(created.id, {
      status: "completed",
      result: {
        exported: true,
        path: "/tmp/report.xlsx",
      },
      completedAt: "2026-04-20T08:00:03.000Z",
    });
    const completed = await repository.list({
      requestedBy: "owner-001",
      status: "completed",
      completedFrom: "2026-04-20T08:00:00.000Z",
      completedTo: "2026-04-20T08:00:05.000Z",
    });
    const cleared = await repository.update(created.id, {
      status: "failed",
      result: null,
      errorMessage: null,
      completedAt: null,
    });

    assert.equal(found?.id, created.id);
    assert.equal(found?.status, "queued");
    assert.equal(updated.status, "completed");
    assert.equal(updated.projectId, "project-001");
    assert.equal(updated.requestedBy, "owner-001");
    assert.equal(updated.createdAt, "2026-04-20T08:00:00.000Z");
    assert.deepEqual(updated.payload, {
      projectId: "project-001",
      reportType: "summary",
    });
    assert.deepEqual(updated.result, {
      exported: true,
      path: "/tmp/report.xlsx",
    });
    assert.deepEqual(
      completed.map((job) => job.id),
      [created.id],
    );
    assert.equal(cleared.status, "failed");
    assert.equal(cleared.result, null);
    assert.equal(cleared.errorMessage, null);
    assert.equal(cleared.completedAt, null);
    assert.equal(await repository.findById("missing-job"), null);
    await assert.rejects(() => repository.update("missing-job", { status: "failed" }), {
      message: "Background job not found",
    });
  } finally {
    await runtime.close();
  }
});
