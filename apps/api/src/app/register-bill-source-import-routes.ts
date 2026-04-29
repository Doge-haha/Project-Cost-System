import type { FastifyInstance } from "fastify";

import {
  sourceBillImportSchema,
  type BillSourceImportService,
} from "../modules/bill/bill-source-import-service.js";
import type { TransactionRunner } from "../shared/tx/transaction.js";

export function registerBillSourceImportRoutes(
  app: FastifyInstance,
  input: {
    transactionRunner: TransactionRunner;
    billSourceImportService: BillSourceImportService;
  },
) {
  const { transactionRunner, billSourceImportService } = input;

  app.post("/v1/projects/:projectId/bill-imports/source/preview", async (request) => {
    const { projectId } = request.params as { projectId: string };
    const payload = sourceBillImportSchema.parse(request.body);

    return billSourceImportService.previewSourceBill({
      projectId,
      userId: request.currentUser!.id,
      ...payload,
    });
  });

  app.post("/v1/projects/:projectId/bill-imports/source", async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const payload = sourceBillImportSchema.parse(request.body);

    const result = await transactionRunner.runInTransaction(async () =>
      billSourceImportService.importSourceBill({
        projectId,
        userId: request.currentUser!.id,
        ...payload,
      }),
    );

    reply.status(201);
    return result;
  });
}
