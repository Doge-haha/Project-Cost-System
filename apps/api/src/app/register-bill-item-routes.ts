import type { FastifyInstance } from "fastify";

import type { TransactionRunner } from "../shared/tx/transaction.js";
import {
  createBillItemSchema,
  updateBillItemManualPricingSchema,
  updateBillItemSchema,
  type BillItemService,
} from "../modules/bill/bill-item-service.js";

export function registerBillItemRoutes(
  app: FastifyInstance,
  input: {
    transactionRunner: TransactionRunner;
    billItemService: BillItemService;
  },
) {
  const { transactionRunner, billItemService } = input;

  app.get(
    "/v1/projects/:projectId/bill-versions/:billVersionId/items",
    async (request) => {
      const { projectId, billVersionId } = request.params as {
        projectId: string;
        billVersionId: string;
      };

      return transactionRunner.runInTransaction(async () => ({
        items: await billItemService.listBillItems({
          projectId,
          billVersionId,
          userId: request.currentUser!.id,
        }),
      }));
    },
  );

  app.post(
    "/v1/projects/:projectId/bill-versions/:billVersionId/items",
    async (request, reply) => {
      const { projectId, billVersionId } = request.params as {
        projectId: string;
        billVersionId: string;
      };
      const payload = createBillItemSchema.parse(request.body);

      const created = await transactionRunner.runInTransaction(async () =>
        billItemService.createBillItem({
          projectId,
          billVersionId,
          parentId: payload.parentId,
          itemCode: payload.itemCode,
          itemName: payload.itemName,
          quantity: payload.quantity,
          unit: payload.unit,
          sortNo: payload.sortNo,
          userId: request.currentUser!.id,
        }),
      );

      reply.status(201);
      return created;
    },
  );

  app.put(
    "/v1/projects/:projectId/bill-versions/:billVersionId/items/:itemId",
    async (request) => {
      const { projectId, billVersionId, itemId } = request.params as {
        projectId: string;
        billVersionId: string;
        itemId: string;
      };
      const payload = updateBillItemSchema.parse(request.body);

      return transactionRunner.runInTransaction(async () =>
        billItemService.updateBillItem({
          projectId,
          billVersionId,
          itemId,
          parentId: payload.parentId,
          itemCode: payload.itemCode,
          itemName: payload.itemName,
          quantity: payload.quantity,
          unit: payload.unit,
          sortNo: payload.sortNo,
          userId: request.currentUser!.id,
        }),
      );
    },
  );

  app.put(
    "/v1/projects/:projectId/bill-versions/:billVersionId/items/:itemId/manual-pricing",
    async (request) => {
      const { projectId, billVersionId, itemId } = request.params as {
        projectId: string;
        billVersionId: string;
        itemId: string;
      };
      const payload = updateBillItemManualPricingSchema.parse(request.body);

      return transactionRunner.runInTransaction(async () =>
        billItemService.updateBillItemManualPricing({
          projectId,
          billVersionId,
          itemId,
          manualUnitPrice: payload.manualUnitPrice,
          reason: payload.reason,
          userId: request.currentUser!.id,
        }),
      );
    },
  );

  app.delete(
    "/v1/projects/:projectId/bill-versions/:billVersionId/items/:itemId",
    async (request, reply) => {
      const { projectId, billVersionId, itemId } = request.params as {
        projectId: string;
        billVersionId: string;
        itemId: string;
      };

      await transactionRunner.runInTransaction(async () =>
        billItemService.deleteBillItem({
          projectId,
          billVersionId,
          itemId,
          userId: request.currentUser!.id,
        }),
      );

      reply.status(204);
      return null;
    },
  );
}
