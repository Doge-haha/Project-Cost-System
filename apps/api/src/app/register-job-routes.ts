import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { executableBackgroundJobTypes } from "@saas-pricing/job-contracts";

import { AppError } from "../shared/errors/app-error.js";
import type { TransactionRunner } from "../shared/tx/transaction.js";
import type { BackgroundJobProcessor } from "../modules/jobs/background-job-processor.js";
import type { BackgroundJobService } from "../modules/jobs/background-job-service.js";

const completeBackgroundJobSchema = z.object({
  result: z.record(z.string(), z.unknown()),
});

const failBackgroundJobSchema = z.object({
  errorMessage: z.string().trim().min(1),
});

const retryBackgroundJobSchema = z.object({
  failureReason: z.string().trim().min(1).optional(),
  failureResourceType: z.string().trim().min(1).optional(),
  failureAction: z.string().trim().min(1).optional(),
});

function assertSystemAdmin(
  currentUser: { roleCodes: string[] } | undefined,
  action: "process" | "complete" | "fail" | "claim",
): void {
  if (currentUser?.roleCodes.includes("system_admin")) {
    return;
  }

  throw new AppError(
    403,
    "FORBIDDEN",
    `Only system administrators can ${action} background jobs`,
  );
}

export function registerJobRoutes(
  app: FastifyInstance,
  input: {
    transactionRunner: TransactionRunner;
    backgroundJobService: BackgroundJobService;
    backgroundJobProcessor: BackgroundJobProcessor;
  },
) {
  const { transactionRunner, backgroundJobService, backgroundJobProcessor } = input;

  app.get("/v1/jobs/:jobId", async (request) => {
    const { jobId } = request.params as { jobId: string };

    return transactionRunner.runInTransaction(async () =>
      backgroundJobService.getBackgroundJob({
        jobId,
        userId: request.currentUser!.id,
      }),
    );
  });

  app.post("/v1/jobs/:jobId/process", async (request) => {
    assertSystemAdmin(request.currentUser, "process");
    const { jobId } = request.params as { jobId: string };

    return transactionRunner.runInTransaction(async () =>
      backgroundJobProcessor.processJob(jobId),
    );
  });

  app.post("/v1/jobs/:jobId/complete", async (request) => {
    assertSystemAdmin(request.currentUser, "complete");
    const { jobId } = request.params as { jobId: string };
    const payload = completeBackgroundJobSchema.parse(request.body);

    return transactionRunner.runInTransaction(async () =>
      backgroundJobService.completeJob({
        jobId,
        result: payload.result,
      }),
    );
  });

  app.post("/v1/jobs/:jobId/fail", async (request) => {
    assertSystemAdmin(request.currentUser, "fail");
    const { jobId } = request.params as { jobId: string };
    const payload = failBackgroundJobSchema.parse(request.body);

    return transactionRunner.runInTransaction(async () =>
      backgroundJobService.failJob({
        jobId,
        errorMessage: payload.errorMessage,
      }),
    );
  });

  app.post("/v1/jobs/:jobId/retry", async (request) => {
    const { jobId } = request.params as { jobId: string };
    const payload = retryBackgroundJobSchema.parse(request.body ?? {});

    return transactionRunner.runInTransaction(async () =>
      backgroundJobService.retryJob({
        jobId,
        userId: request.currentUser!.id,
        roleCodes: request.currentUser!.roleCodes,
        failureReason: payload.failureReason,
        failureResourceType: payload.failureResourceType,
        failureAction: payload.failureAction,
      }),
    );
  });

  app.post("/v1/jobs/pull-next", async (request) => {
    assertSystemAdmin(request.currentUser, "claim");

    return transactionRunner.runInTransaction(async () => ({
      job: await backgroundJobService.claimNextQueuedJob(),
    }));
  });

  app.get("/v1/jobs", async (request) => {
    const query = z
      .object({
        projectId: z.string().min(1).optional(),
        requestedBy: z.string().min(1).optional(),
        jobType: z.enum(executableBackgroundJobTypes).optional(),
        status: z.enum(["queued", "processing", "completed", "failed"]).optional(),
        createdFrom: z.string().datetime().optional(),
        createdTo: z.string().datetime().optional(),
        completedFrom: z.string().datetime().optional(),
        completedTo: z.string().datetime().optional(),
        limit: z.coerce.number().int().positive().max(100).optional(),
      })
      .parse(request.query);

    return transactionRunner.runInTransaction(async () => {
      const items = await backgroundJobService.listBackgroundJobs({
        projectId: query.projectId,
        requestedBy: query.requestedBy,
        jobType: query.jobType,
        status: query.status,
        createdFrom: query.createdFrom,
        createdTo: query.createdTo,
        completedFrom: query.completedFrom,
        completedTo: query.completedTo,
        limit: query.limit,
        userId: request.currentUser!.id,
      });

      return {
        items,
        summary: {
          totalCount: items.length,
          statusCounts: {
            queued: items.filter((item) => item.status === "queued").length,
            processing: items.filter((item) => item.status === "processing").length,
            completed: items.filter((item) => item.status === "completed").length,
            failed: items.filter((item) => item.status === "failed").length,
          },
          jobTypeCounts: {
            report_export: items.filter((item) => item.jobType === "report_export")
              .length,
            project_recalculate: items.filter(
              (item) => item.jobType === "project_recalculate",
            ).length,
            knowledge_extraction: items.filter(
              (item) => item.jobType === "knowledge_extraction",
            ).length,
          },
        },
      };
    });
  });
}
