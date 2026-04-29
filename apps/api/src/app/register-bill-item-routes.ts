import type { FastifyInstance } from "fastify";

import type { TransactionRunner } from "../shared/tx/transaction.js";
import {
  batchCreateRootBillItemsSchema,
  createBillItemSchema,
  listProjectBillItemsSchema,
  moveBillItemSchema,
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

  app.get("/v1/projects/:projectId/bill-items", async (request) => {
    const { projectId } = request.params as { projectId: string };
    const query = listProjectBillItemsSchema.parse(request.query);

    return transactionRunner.runInTransaction(async () => ({
      items: await billItemService.listProjectBillItems({
        projectId,
        billVersionId: query.billVersionId,
        stageCode: query.stageCode,
        disciplineCode: query.disciplineCode,
        keyword: query.keyword,
        userId: request.currentUser!.id,
      }),
    }));
  });

  app.post("/v1/projects/:projectId/bill-items", async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const payload = createBillItemSchema
      .extend({
        billVersionId: createBillItemSchema.shape.itemCode,
      })
      .parse(request.body);

    const created = await transactionRunner.runInTransaction(async () =>
      billItemService.createBillItem({
        projectId,
        billVersionId: payload.billVersionId,
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
  });

  app.put("/v1/projects/:projectId/bill-items/:itemId", async (request) => {
    const { projectId, itemId } = request.params as {
      projectId: string;
      itemId: string;
    };
    const payload = updateBillItemSchema
      .extend({
        billVersionId: updateBillItemSchema.shape.itemCode,
      })
      .parse(request.body);

    return transactionRunner.runInTransaction(async () =>
      billItemService.updateBillItem({
        projectId,
        billVersionId: payload.billVersionId,
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
  });

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

  app.get(
    "/v1/projects/:projectId/bill-versions/:billVersionId/items/tree",
    async (request) => {
      const { projectId, billVersionId } = request.params as {
        projectId: string;
        billVersionId: string;
      };

      return transactionRunner.runInTransaction(async () => ({
        items: await billItemService.listBillItemTree({
          projectId,
          billVersionId,
          userId: request.currentUser!.id,
        }),
      }));
    },
  );

  app.post(
    "/v1/projects/:projectId/bill-versions/:billVersionId/items/batch",
    async (request, reply) => {
      const { projectId, billVersionId } = request.params as {
        projectId: string;
        billVersionId: string;
      };
      const payload = batchCreateRootBillItemsSchema.parse(request.body);

      const created = await transactionRunner.runInTransaction(async () =>
        billItemService.batchCreateRootBillItems({
          projectId,
          billVersionId,
          items: payload.items,
          userId: request.currentUser!.id,
        }),
      );

      reply.status(201);
      return { items: created };
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
    "/v1/projects/:projectId/bill-versions/:billVersionId/items/:itemId/move",
    async (request) => {
      const { projectId, billVersionId, itemId } = request.params as {
        projectId: string;
        billVersionId: string;
        itemId: string;
      };
      const payload = moveBillItemSchema.parse(request.body);

      return transactionRunner.runInTransaction(async () =>
        billItemService.moveBillItem({
          projectId,
          billVersionId,
          itemId,
          parentId: payload.parentId,
          sortNo: payload.sortNo,
          userId: request.currentUser!.id,
        }),
      );
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
