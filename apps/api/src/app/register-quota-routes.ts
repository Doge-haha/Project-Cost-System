import type { FastifyInstance } from "fastify";

import type { TransactionRunner } from "../shared/tx/transaction.js";
import {
  batchCreateQuotaLinesSchema,
  createQuotaLineSchema,
  listQuotaSourceCandidatesSchema,
  updateQuotaLineSchema,
  type QuotaLineService,
} from "../modules/quota/quota-line-service.js";

export function registerQuotaRoutes(
  app: FastifyInstance,
  input: {
    transactionRunner: TransactionRunner;
    quotaLineService: QuotaLineService;
  },
) {
  const { transactionRunner, quotaLineService } = input;

  app.get("/v1/projects/:projectId/quota-lines", async (request) => {
    const { projectId } = request.params as { projectId: string };

    return transactionRunner.runInTransaction(async () => ({
      items: await quotaLineService.listProjectQuotaLines({
        projectId,
        userId: request.currentUser!.id,
      }),
    }));
  });

  app.post("/v1/projects/:projectId/quota-lines/batch-create", async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const payload = batchCreateQuotaLinesSchema.parse(request.body);

    const created = await transactionRunner.runInTransaction(async () => {
      const items = [];

      for (const item of payload.items) {
        items.push(
          await quotaLineService.createQuotaLine({
            projectId,
            billVersionId: item.billVersionId,
            billItemId: item.billItemId,
            sourceStandardSetCode: item.sourceStandardSetCode,
            sourceQuotaId: item.sourceQuotaId,
            sourceSequence: item.sourceSequence,
            chapterCode: item.chapterCode,
            quotaCode: item.quotaCode,
            quotaName: item.quotaName,
            unit: item.unit,
            quantity: item.quantity,
            laborFee: item.laborFee,
            materialFee: item.materialFee,
            machineFee: item.machineFee,
            contentFactor: item.contentFactor,
            sourceMode: item.sourceMode,
            userId: request.currentUser!.id,
          }),
        );
      }

      return items;
    });

    reply.status(201);
    return { items: created };
  });

  app.post("/v1/projects/:projectId/quota-lines/validate", async (request) => {
    const { projectId } = request.params as { projectId: string };

    return transactionRunner.runInTransaction(async () =>
      quotaLineService.validateProjectQuotaLines({
        projectId,
        userId: request.currentUser!.id,
      }),
    );
  });

  app.get("/v1/projects/:projectId/quota-lines/candidates", async (request) => {
    const { projectId } = request.params as { projectId: string };
    const query = listQuotaSourceCandidatesSchema.parse(request.query);

    return transactionRunner.runInTransaction(async () => ({
      items: await quotaLineService.listQuotaSourceCandidates({
        projectId,
        userId: request.currentUser!.id,
        standardSetCode: query.standardSetCode,
        disciplineCode: query.disciplineCode,
        keyword: query.keyword,
        chapterCode: query.chapterCode,
      }),
    }));
  });

  app.get("/v1/projects/:projectId/quota-lines/source-chain", async (request) => {
    const { projectId } = request.params as { projectId: string };

    return transactionRunner.runInTransaction(async () => ({
      items: await quotaLineService.listProjectQuotaLineSourceChains({
        projectId,
        userId: request.currentUser!.id,
      }),
    }));
  });

  app.get(
    "/v1/projects/:projectId/bill-versions/:billVersionId/items/:itemId/quota-lines",
    async (request) => {
      const { projectId, billVersionId, itemId } = request.params as {
        projectId: string;
        billVersionId: string;
        itemId: string;
      };

      return transactionRunner.runInTransaction(async () => ({
        items: await quotaLineService.listQuotaLines({
          projectId,
          billVersionId,
          billItemId: itemId,
          userId: request.currentUser!.id,
        }),
      }));
    },
  );

  app.post(
    "/v1/projects/:projectId/bill-versions/:billVersionId/items/:itemId/quota-lines",
    async (request, reply) => {
      const { projectId, billVersionId, itemId } = request.params as {
        projectId: string;
        billVersionId: string;
        itemId: string;
      };
      const payload = createQuotaLineSchema.parse(request.body);

      const created = await transactionRunner.runInTransaction(async () =>
        quotaLineService.createQuotaLine({
          projectId,
          billVersionId,
          billItemId: itemId,
          sourceStandardSetCode: payload.sourceStandardSetCode,
          sourceQuotaId: payload.sourceQuotaId,
          sourceSequence: payload.sourceSequence,
          chapterCode: payload.chapterCode,
          quotaCode: payload.quotaCode,
          quotaName: payload.quotaName,
          unit: payload.unit,
          quantity: payload.quantity,
          laborFee: payload.laborFee,
          materialFee: payload.materialFee,
          machineFee: payload.machineFee,
          contentFactor: payload.contentFactor,
          sourceMode: payload.sourceMode,
          userId: request.currentUser!.id,
        }),
      );

      reply.status(201);
      return created;
    },
  );

  app.put("/v1/projects/:projectId/quota-lines/:quotaLineId", async (request) => {
    const { projectId, quotaLineId } = request.params as {
      projectId: string;
      quotaLineId: string;
    };
    const payload = updateQuotaLineSchema.parse(request.body);

    return transactionRunner.runInTransaction(async () =>
      quotaLineService.updateQuotaLine({
        projectId,
        quotaLineId,
        sourceStandardSetCode: payload.sourceStandardSetCode,
        sourceQuotaId: payload.sourceQuotaId,
        sourceSequence: payload.sourceSequence,
        chapterCode: payload.chapterCode,
        quotaCode: payload.quotaCode,
        quotaName: payload.quotaName,
        unit: payload.unit,
        quantity: payload.quantity,
        laborFee: payload.laborFee,
        materialFee: payload.materialFee,
        machineFee: payload.machineFee,
        contentFactor: payload.contentFactor,
        sourceMode: payload.sourceMode,
        userId: request.currentUser!.id,
      }),
    );
  });

  app.delete(
    "/v1/projects/:projectId/quota-lines/:quotaLineId",
    async (request, reply) => {
      const { projectId, quotaLineId } = request.params as {
        projectId: string;
        quotaLineId: string;
      };

      await transactionRunner.runInTransaction(async () =>
        quotaLineService.deleteQuotaLine({
          projectId,
          quotaLineId,
          userId: request.currentUser!.id,
        }),
      );

      reply.status(204);
      return null;
    },
  );
}
