import type { FastifyInstance } from "fastify";

import type { TransactionRunner } from "../shared/tx/transaction.js";
import {
  createBillWorkItemSchema,
  updateBillWorkItemSchema,
  type BillWorkItemService,
} from "../modules/bill/bill-work-item-service.js";

export function registerBillWorkItemRoutes(
  app: FastifyInstance,
  input: {
    transactionRunner: TransactionRunner;
    billWorkItemService: BillWorkItemService;
  },
) {
  const { transactionRunner, billWorkItemService } = input;

  app.get(
    "/v1/projects/:projectId/bill-items/:itemId/work-items",
    async (request) => {
      const { projectId, itemId } = request.params as {
        projectId: string;
        itemId: string;
      };

      return transactionRunner.runInTransaction(async () => ({
        items: await billWorkItemService.listProjectWorkItems({
          projectId,
          billItemId: itemId,
          userId: request.currentUser!.id,
        }),
      }));
    },
  );

  app.post(
    "/v1/projects/:projectId/bill-items/:itemId/work-items",
    async (request, reply) => {
      const { projectId, itemId } = request.params as {
        projectId: string;
        itemId: string;
      };
      const payload = createBillWorkItemSchema.parse(request.body);

      const created = await transactionRunner.runInTransaction(async () =>
        billWorkItemService.createProjectWorkItem({
          projectId,
          billItemId: itemId,
          workContent: payload.workContent,
          sortNo: payload.sortNo,
          userId: request.currentUser!.id,
        }),
      );

      reply.status(201);
      return created;
    },
  );

  app.put(
    "/v1/projects/:projectId/bill-items/:itemId/work-items/:workItemId",
    async (request) => {
      const { projectId, itemId, workItemId } = request.params as {
        projectId: string;
        itemId: string;
        workItemId: string;
      };
      const payload = updateBillWorkItemSchema.parse(request.body);

      return transactionRunner.runInTransaction(async () =>
        billWorkItemService.updateProjectWorkItem({
          projectId,
          billItemId: itemId,
          workItemId,
          workContent: payload.workContent,
          sortNo: payload.sortNo,
          userId: request.currentUser!.id,
        }),
      );
    },
  );

  app.get(
    "/v1/projects/:projectId/bill-versions/:billVersionId/items/:itemId/work-items",
    async (request) => {
      const { projectId, billVersionId, itemId } = request.params as {
        projectId: string;
        billVersionId: string;
        itemId: string;
      };

      return transactionRunner.runInTransaction(async () => ({
        items: await billWorkItemService.listWorkItems({
          projectId,
          billVersionId,
          billItemId: itemId,
          userId: request.currentUser!.id,
        }),
      }));
    },
  );

  app.post(
    "/v1/projects/:projectId/bill-versions/:billVersionId/items/:itemId/work-items",
    async (request, reply) => {
      const { projectId, billVersionId, itemId } = request.params as {
        projectId: string;
        billVersionId: string;
        itemId: string;
      };
      const payload = createBillWorkItemSchema.parse(request.body);

      const created = await transactionRunner.runInTransaction(async () =>
        billWorkItemService.createWorkItem({
          projectId,
          billVersionId,
          billItemId: itemId,
          workContent: payload.workContent,
          sortNo: payload.sortNo,
          userId: request.currentUser!.id,
        }),
      );

      reply.status(201);
      return created;
    },
  );

  app.put(
    "/v1/projects/:projectId/bill-versions/:billVersionId/items/:itemId/work-items/:workItemId",
    async (request) => {
      const { projectId, billVersionId, itemId, workItemId } = request.params as {
        projectId: string;
        billVersionId: string;
        itemId: string;
        workItemId: string;
      };
      const payload = updateBillWorkItemSchema.parse(request.body);

      return transactionRunner.runInTransaction(async () =>
        billWorkItemService.updateWorkItem({
          projectId,
          billVersionId,
          billItemId: itemId,
          workItemId,
          workContent: payload.workContent,
          sortNo: payload.sortNo,
          userId: request.currentUser!.id,
        }),
      );
    },
  );

  app.delete(
    "/v1/projects/:projectId/bill-versions/:billVersionId/items/:itemId/work-items/:workItemId",
    async (request, reply) => {
      const { projectId, billVersionId, itemId, workItemId } = request.params as {
        projectId: string;
        billVersionId: string;
        itemId: string;
        workItemId: string;
      };

      await transactionRunner.runInTransaction(async () =>
        billWorkItemService.deleteWorkItem({
          projectId,
          billVersionId,
          billItemId: itemId,
          workItemId,
          userId: request.currentUser!.id,
        }),
      );

      reply.status(204);
      return null;
    },
  );
}
