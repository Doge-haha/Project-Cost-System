import test from "node:test";
import assert from "node:assert/strict";

import { AuditLogService } from "../src/modules/audit/audit-log-service.js";
import { InMemoryAuditLogRepository } from "../src/modules/audit/audit-log-repository.js";
import { BackgroundJobProcessor } from "../src/modules/jobs/background-job-processor.js";
import {
  InMemoryBackgroundJobRepository,
} from "../src/modules/jobs/background-job-repository.js";
import { BackgroundJobService } from "../src/modules/jobs/background-job-service.js";
import { InMemoryProjectDisciplineRepository } from "../src/modules/project/project-discipline-repository.js";
import { InMemoryProjectMemberRepository } from "../src/modules/project/project-member-repository.js";
import { InMemoryProjectRepository } from "../src/modules/project/project-repository.js";
import { InMemoryProjectStageRepository } from "../src/modules/project/project-stage-repository.js";
import {
  InMemoryReportExportTaskRepository,
} from "../src/modules/reports/report-export-task-repository.js";
import { ReportExportTaskService } from "../src/modules/reports/report-export-task-service.js";

test("report export job failure marks both background job and export task as failed and writes failure audit logs", async () => {
  const projectRepository = new InMemoryProjectRepository([
    {
      id: "project-001",
      code: "PRJ-001",
      name: "新点 SaaS 计价一期",
      status: "draft",
    },
  ]);
  const projectStageRepository = new InMemoryProjectStageRepository([
    {
      id: "stage-001",
      projectId: "project-001",
      stageCode: "estimate",
      stageName: "投资估算",
      status: "draft",
      sequenceNo: 1,
    },
  ]);
  const projectDisciplineRepository = new InMemoryProjectDisciplineRepository([
    {
      id: "discipline-001",
      projectId: "project-001",
      disciplineCode: "building",
      disciplineName: "建筑工程",
      defaultStandardSetCode: "js-2013-building",
      status: "enabled",
    },
  ]);
  const projectMemberRepository = new InMemoryProjectMemberRepository([
    {
      id: "member-001",
      projectId: "project-001",
      userId: "engineer-001",
      displayName: "Cost Engineer",
      roleCode: "cost_engineer",
      scopes: [
        { scopeType: "stage", scopeValue: "estimate" },
        { scopeType: "discipline", scopeValue: "building" },
      ],
    },
  ]);
  const auditLogService = new AuditLogService(
    new InMemoryAuditLogRepository([]),
    projectRepository,
    projectStageRepository,
    projectDisciplineRepository,
    projectMemberRepository,
  );
  const reportExportTaskRepository = new InMemoryReportExportTaskRepository([]);
  const reportExportTaskService = new ReportExportTaskService(
    reportExportTaskRepository,
    projectRepository,
    {
      getSummary: async () => {
        throw new Error("summary aggregation failed");
      },
      getSummaryDetails: async () => {
        throw new Error("variance aggregation failed");
      },
    } as never,
    auditLogService,
  );
  const backgroundJobService = new BackgroundJobService(
    new InMemoryBackgroundJobRepository([]),
    projectRepository,
    projectStageRepository,
    projectDisciplineRepository,
    projectMemberRepository,
    auditLogService,
  );

  const task = await reportExportTaskService.createReportExportTask({
    projectId: "project-001",
    reportType: "summary",
    stageCode: "estimate",
    disciplineCode: "building",
    userId: "engineer-001",
  });

  const job = await backgroundJobService.enqueueJob({
    jobType: "report_export",
    requestedBy: "engineer-001",
    projectId: "project-001",
    payload: {
      projectId: "project-001",
      reportType: "summary",
      stageCode: "estimate",
      disciplineCode: "building",
      reportExportTaskId: task.id,
    },
  });

  const processor = new BackgroundJobProcessor(backgroundJobService, {
    processProjectRecalculate: async () => ({
      recalculatedCount: 0,
    }),
    processReportExport: async ({ payload, requestedBy }) => {
      const completedTask = await reportExportTaskService.processReportExportTask({
        taskId: payload.reportExportTaskId!,
        userId: requestedBy,
      });
      return {
        taskId: completedTask.id,
        status: completedTask.status,
        reportType: completedTask.reportType,
      };
    },
  });

  const failedJob = await processor.processJob(job.id);
  const failedTask = await reportExportTaskRepository.findById(task.id);
  const failedTaskView = await reportExportTaskService.getReportExportTask({
    taskId: task.id,
    userId: "engineer-001",
  });
  const auditLogs = await auditLogService.listAuditLogs({
    projectId: "project-001",
    userId: "engineer-001",
  });

  assert.equal(failedJob.status, "failed");
  assert.equal(failedJob.errorMessage, "summary aggregation failed");
  assert.equal(failedTask?.status, "failed");
  assert.equal(failedTask?.errorMessage, "summary aggregation failed");
  assert.equal(failedTaskView.hasFailed, true);
  assert.equal(failedTaskView.isDownloadReady, false);
  assert.equal(failedTaskView.isTerminal, true);
  assert.equal(failedTaskView.failureMessage, "summary aggregation failed");

  const backgroundJobFailedLog = auditLogs.find(
    (entry) =>
      entry.resourceType === "background_job" &&
      entry.resourceId === job.id &&
      entry.action === "failed",
  );
  assert.ok(backgroundJobFailedLog);

  const reportTaskFailedLog = auditLogs.find(
    (entry) =>
      entry.resourceType === "report_export_task" &&
      entry.resourceId === task.id &&
      entry.action === "failed",
  );
  assert.ok(reportTaskFailedLog);

  const reportTaskSuccessLog = auditLogs.find(
    (entry) =>
      entry.resourceType === "report_export_task" &&
      entry.resourceId === task.id &&
      entry.action === "export",
  );
  assert.equal(reportTaskSuccessLog, undefined);
});
