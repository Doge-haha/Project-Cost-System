import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { TransactionRunner } from "../shared/tx/transaction.js";
import { AppError } from "../shared/errors/app-error.js";
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
  taxMode: z.enum(["tax_included", "tax_excluded"]).optional(),
});

const summaryDetailQuerySchema = z.object({
  projectId: z.string().min(1),
  billVersionId: z.string().min(1).optional(),
  stageCode: z.string().min(1).optional(),
  disciplineCode: z.string().min(1).optional(),
  unitCode: z.string().min(1).optional(),
  taxMode: z.enum(["tax_included", "tax_excluded"]).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const varianceBreakdownQuerySchema = summaryQuerySchema.extend({
  groupBy: z.enum(["discipline", "unit"]),
});

const versionCompareQuerySchema = z.object({
  projectId: z.string().min(1),
  baseBillVersionId: z.string().min(1),
  targetBillVersionId: z.string().min(1),
});

const REPORT_EXPORT_ROLES = new Set([
  "system_admin",
  "project_owner",
  "cost_engineer",
]);

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
        unitCode: query.unitCode,
        taxMode: query.taxMode,
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
        unitCode: query.unitCode,
        taxMode: query.taxMode,
        limit: query.limit,
        userId: request.currentUser!.id,
      }),
    );
  });

  app.get("/v1/reports/variance-breakdown", async (request) => {
    const query = varianceBreakdownQuerySchema.parse(request.query);

    return transactionRunner.runInTransaction(async () =>
      summaryService.getVarianceBreakdown({
        projectId: query.projectId,
        groupBy: query.groupBy,
        billVersionId: query.billVersionId,
        stageCode: query.stageCode,
        disciplineCode: query.disciplineCode,
        unitCode: query.unitCode,
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
    if (
      !request.currentUser!.roleCodes.some((roleCode) =>
        REPORT_EXPORT_ROLES.has(roleCode),
      )
    ) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have permission to export reports",
      );
    }

    const created = await transactionRunner.runInTransaction(async () => {
      const task = await reportExportTaskService.createReportExportTask({
        projectId: payload.projectId,
        reportType: payload.reportType,
        stageCode: payload.stageCode,
        disciplineCode: payload.disciplineCode,
        reportTemplateId: payload.reportTemplateId,
        outputFormat: payload.outputFormat,
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
