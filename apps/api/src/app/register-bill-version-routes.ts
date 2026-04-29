import type { FastifyInstance } from "fastify";

import type { TransactionRunner } from "../shared/tx/transaction.js";
import {
  billVersionContextSchema,
  createBillVersionSchema,
  unlockBillVersionSchema,
  type BillVersionService,
} from "../modules/bill/bill-version-service.js";

export function registerBillVersionRoutes(
  app: FastifyInstance,
  input: {
    transactionRunner: TransactionRunner;
    billVersionService: BillVersionService;
  },
) {
  const { transactionRunner, billVersionService } = input;

  app.get("/v1/projects/:projectId/bill-versions", async (request) => {
    const { projectId } = request.params as { projectId: string };
    const query = billVersionContextSchema.parse(request.query);

    return transactionRunner.runInTransaction(async () => ({
      items: await billVersionService.listBillVersions({
        projectId,
        stageCode: query.stageCode,
        disciplineCode: query.disciplineCode,
        userId: request.currentUser!.id,
      }),
    }));
  });

  app.post("/v1/projects/:projectId/bill-versions", async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const payload = createBillVersionSchema.parse(request.body);

    const created = await transactionRunner.runInTransaction(async () =>
      billVersionService.createBillVersion({
        projectId,
        stageCode: payload.stageCode,
        disciplineCode: payload.disciplineCode,
        versionName: payload.versionName,
        userId: request.currentUser!.id,
      }),
    );

    reply.status(201);
    return created;
  });

  app.get(
    "/v1/projects/:projectId/bill-versions/:billVersionId",
    async (request) => {
      const { projectId, billVersionId } = request.params as {
        projectId: string;
        billVersionId: string;
      };

      return transactionRunner.runInTransaction(async () =>
        billVersionService.getBillVersion({
          projectId,
          billVersionId,
          userId: request.currentUser!.id,
        }),
      );
    },
  );

  app.post(
    "/v1/projects/:projectId/bill-versions/:billVersionId/copy-from",
    async (request, reply) => {
      const { projectId, billVersionId } = request.params as {
        projectId: string;
        billVersionId: string;
      };

      const created = await transactionRunner.runInTransaction(async () =>
        billVersionService.copyFromVersion({
          projectId,
          sourceBillVersionId: billVersionId,
          userId: request.currentUser!.id,
        }),
      );

      reply.status(201);
      return created;
    },
  );

  app.post(
    "/v1/projects/:projectId/bill-versions/:billVersionId/submit",
    async (request) => {
      const { projectId, billVersionId } = request.params as {
        projectId: string;
        billVersionId: string;
      };

      return transactionRunner.runInTransaction(async () =>
        billVersionService.submitBillVersion({
          projectId,
          billVersionId,
          userId: request.currentUser!.id,
        }),
      );
    },
  );

  app.get(
    "/v1/projects/:projectId/bill-versions/:billVersionId/validation-summary",
    async (request) => {
      const { projectId, billVersionId } = request.params as {
        projectId: string;
        billVersionId: string;
      };

      return transactionRunner.runInTransaction(async () =>
        billVersionService.getValidationSummary({
          projectId,
          billVersionId,
          userId: request.currentUser!.id,
        }),
      );
    },
  );

  app.get(
    "/v1/projects/:projectId/bill-versions/:billVersionId/source-chain",
    async (request) => {
      const { projectId, billVersionId } = request.params as {
        projectId: string;
        billVersionId: string;
      };

      return transactionRunner.runInTransaction(async () => ({
        items: await billVersionService.getSourceChain({
          projectId,
          billVersionId,
          userId: request.currentUser!.id,
        }),
      }));
    },
  );

  app.post(
    "/v1/projects/:projectId/bill-versions/:billVersionId/withdraw",
    async (request) => {
      const { projectId, billVersionId } = request.params as {
        projectId: string;
        billVersionId: string;
      };

      return transactionRunner.runInTransaction(async () =>
        billVersionService.withdrawBillVersion({
          projectId,
          billVersionId,
          userId: request.currentUser!.id,
        }),
      );
    },
  );

  app.post(
    "/v1/projects/:projectId/bill-versions/:billVersionId/lock",
    async (request) => {
      const { projectId, billVersionId } = request.params as {
        projectId: string;
        billVersionId: string;
      };

      return transactionRunner.runInTransaction(async () =>
        billVersionService.lockBillVersion({
          projectId,
          billVersionId,
          userId: request.currentUser!.id,
        }),
      );
    },
  );

  app.post(
    "/v1/projects/:projectId/bill-versions/:billVersionId/unlock",
    async (request) => {
      const { projectId, billVersionId } = request.params as {
        projectId: string;
        billVersionId: string;
      };
      const payload = unlockBillVersionSchema.parse(request.body);

      return transactionRunner.runInTransaction(async () =>
        billVersionService.unlockBillVersion({
          projectId,
          billVersionId,
          reason: payload.reason,
          userId: request.currentUser!.id,
        }),
      );
    },
  );
}
