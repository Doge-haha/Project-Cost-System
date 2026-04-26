import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { TransactionRunner } from "../shared/tx/transaction.js";
import type { BackgroundJobService } from "../modules/jobs/background-job-service.js";
import {
  createReportExportTaskSchema,
  type ReportExportTaskService,
} from "../modules/reports/report-export-task-service.js";
import type { SummaryService } from "../modules/reports/summary-service.js";

const summaryQuerySchema = z.object({
  projectId: z.string().min(1),
  billVersionId: z.string().min(1).optional(),
  stageCode: z.string().min(1).optional(),
  disciplineCode: z.string().min(1).optional(),
  unitCode: z.string().min(1).optional(),
});

const summaryDetailQuerySchema = z.object({
  projectId: z.string().min(1),
  billVersionId: z.string().min(1).optional(),
  stageCode: z.string().min(1).optional(),
  disciplineCode: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const versionCompareQuerySchema = z.object({
  projectId: z.string().min(1),
  baseBillVersionId: z.string().min(1),
  targetBillVersionId: z.string().min(1),
});

export function registerReportRoutes(
  app: FastifyInstance,
  input: {
    transactionRunner: TransactionRunner;
    summaryService: SummaryService;
    reportExportTaskService: ReportExportTaskService;
    backgroundJobService: BackgroundJobService;
  },
) {
  const {
    transactionRunner,
    summaryService,
    reportExportTaskService,
    backgroundJobService,
  } = input;

  app.get("/v1/reports/summary", async (request) => {
    const query = summaryQuerySchema.parse(request.query);

    return transactionRunner.runInTransaction(async () =>
      summaryService.getSummary({
        projectId: query.projectId,
        billVersionId: query.billVersionId,
        stageCode: query.stageCode,
        disciplineCode: query.disciplineCode,
        userId: request.currentUser!.id,
      }),
    );
  });

  app.get("/v1/reports/summary/details", async (request) => {
    const query = summaryDetailQuerySchema.parse(request.query);

    return transactionRunner.runInTransaction(async () =>
      summaryService.getSummaryDetails({
        projectId: query.projectId,
        billVersionId: query.billVersionId,
        stageCode: query.stageCode,
        disciplineCode: query.disciplineCode,
        limit: query.limit,
        userId: request.currentUser!.id,
      }),
    );
  });

  app.get("/v1/reports/version-compare", async (request) => {
    const query = versionCompareQuerySchema.parse(request.query);

    return transactionRunner.runInTransaction(async () =>
      summaryService.compareVersions({
        projectId: query.projectId,
        baseBillVersionId: query.baseBillVersionId,
        targetBillVersionId: query.targetBillVersionId,
        userId: request.currentUser!.id,
      }),
    );
  });

  app.post("/v1/reports/export", async (request, reply) => {
    const payload = createReportExportTaskSchema.parse(request.body);

    const created = await transactionRunner.runInTransaction(async () => {
      const task = await reportExportTaskService.createReportExportTask({
        projectId: payload.projectId,
        reportType: payload.reportType,
        stageCode: payload.stageCode,
        disciplineCode: payload.disciplineCode,
        userId: request.currentUser!.id,
      });

      const job = await backgroundJobService.enqueueJob({
        jobType: "report_export",
        requestedBy: request.currentUser!.id,
        projectId: payload.projectId,
        payload: {
          ...payload,
          reportExportTaskId: task.id,
        },
      });

      return {
        job,
        result: task,
      };
    });

    reply.status(202);
    return created;
  });

  app.get("/v1/reports/export/:taskId", async (request) => {
    const { taskId } = request.params as { taskId: string };

    return transactionRunner.runInTransaction(async () =>
      reportExportTaskService.getReportExportTask({
        taskId,
        userId: request.currentUser!.id,
      }),
    );
  });

  app.get("/v1/reports/export/:taskId/download", async (request, reply) => {
    const { taskId } = request.params as { taskId: string };

    const download = await transactionRunner.runInTransaction(async () =>
      reportExportTaskService.downloadReportExportTask({
        taskId,
        userId: request.currentUser!.id,
      }),
    );

    reply.header("content-type", download.contentType);
    reply.header("content-disposition", `attachment; filename="${download.fileName}"`);
    return download.content;
  });
}
