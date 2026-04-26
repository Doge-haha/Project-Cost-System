import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { TransactionRunner } from "../shared/tx/transaction.js";
import type { CalculateService } from "../modules/engine/calculate-service.js";
import type { BackgroundJobService } from "../modules/jobs/background-job-service.js";

const recalculateBillVersionSchema = z.object({
  priceVersionId: z.string().min(1).optional(),
  feeTemplateId: z.string().min(1).optional(),
});

const recalculateProjectSchema = z.object({
  stageCode: z.string().min(1).optional(),
  disciplineCode: z.string().min(1).optional(),
  priceVersionId: z.string().min(1).optional(),
  feeTemplateId: z.string().min(1).optional(),
});

export function registerRecalculateRoutes(
  app: FastifyInstance,
  input: {
    transactionRunner: TransactionRunner;
    backgroundJobService: BackgroundJobService;
    calculateService: CalculateService;
  },
) {
  const { transactionRunner, backgroundJobService, calculateService } = input;

  app.post("/v1/projects/:projectId/recalculate", async (request, reply) => {
    const { projectId } = request.params as {
      projectId: string;
    };
    const payload = recalculateProjectSchema.parse(request.body ?? {});

    await transactionRunner.runInTransaction(async () =>
      calculateService.validateProjectRecalculationScope({
        projectId,
        stageCode: payload.stageCode,
        disciplineCode: payload.disciplineCode,
        priceVersionId: payload.priceVersionId,
        feeTemplateId: payload.feeTemplateId,
        userId: request.currentUser!.id,
        roleCodes: request.currentUser!.roleCodes,
      }),
    );

    const job = await transactionRunner.runInTransaction(async () =>
      backgroundJobService.enqueueJob({
        jobType: "project_recalculate",
        requestedBy: request.currentUser!.id,
        roleCodes: request.currentUser!.roleCodes,
        projectId,
        payload: {
          projectId,
          stageCode: payload.stageCode,
          disciplineCode: payload.disciplineCode,
          priceVersionId: payload.priceVersionId,
          feeTemplateId: payload.feeTemplateId,
          roleCodes: request.currentUser!.roleCodes,
        },
      }),
    );

    reply.status(202);
    return job;
  });

  app.post(
    "/v1/projects/:projectId/bill-versions/:billVersionId/recalculate",
    async (request) => {
      const { projectId, billVersionId } = request.params as {
        projectId: string;
        billVersionId: string;
      };
      const payload = recalculateBillVersionSchema.parse(request.body ?? {});

      return transactionRunner.runInTransaction(async () =>
        calculateService.recalculateBillVersion({
          projectId,
          billVersionId,
          priceVersionId: payload.priceVersionId,
          feeTemplateId: payload.feeTemplateId,
          userId: request.currentUser!.id,
        }),
      );
    },
  );
}
