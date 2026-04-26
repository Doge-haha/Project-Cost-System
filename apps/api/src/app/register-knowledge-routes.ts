import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { TransactionRunner } from "../shared/tx/transaction.js";
import type { KnowledgeService } from "../modules/knowledge/knowledge-service.js";

export function registerKnowledgeRoutes(
  app: FastifyInstance,
  input: {
    transactionRunner: TransactionRunner;
    knowledgeService: KnowledgeService;
  },
) {
  const { transactionRunner, knowledgeService } = input;

  app.get("/v1/projects/:projectId/knowledge-entries", async (request) => {
    const { projectId } = request.params as { projectId: string };
    const query = z
      .object({
        sourceJobId: z.string().min(1).optional(),
        sourceType: z.string().min(1).optional(),
        sourceAction: z.string().min(1).optional(),
        stageCode: z.string().min(1).optional(),
        limit: z.coerce.number().int().positive().max(100).optional(),
      })
      .parse(request.query);

    return transactionRunner.runInTransaction(async () => {
      const items = await knowledgeService.listKnowledgeEntries({
        projectId,
        sourceJobId: query.sourceJobId,
        sourceType: query.sourceType,
        sourceAction: query.sourceAction,
        stageCode: query.stageCode,
        limit: query.limit,
        userId: request.currentUser!.id,
      });

      return {
        items,
        summary: knowledgeService.summarizeKnowledgeEntries(items),
      };
    });
  });

  app.get("/v1/projects/:projectId/memory-entries", async (request) => {
    const { projectId } = request.params as { projectId: string };
    const query = z
      .object({
        sourceJobId: z.string().min(1).optional(),
        subjectType: z.string().min(1).optional(),
        subjectId: z.string().min(1).optional(),
        stageCode: z.string().min(1).optional(),
        limit: z.coerce.number().int().positive().max(100).optional(),
      })
      .parse(request.query);

    return transactionRunner.runInTransaction(async () => {
      const items = await knowledgeService.listMemoryEntries({
        projectId,
        sourceJobId: query.sourceJobId,
        subjectType: query.subjectType,
        subjectId: query.subjectId,
        stageCode: query.stageCode,
        limit: query.limit,
        userId: request.currentUser!.id,
      });

      return {
        items,
        summary: knowledgeService.summarizeMemoryEntries(items),
      };
    });
  });

  app.get("/v1/projects/:projectId/knowledge-search", async (request) => {
    const { projectId } = request.params as { projectId: string };
    const query = z
      .object({
        q: z.string().min(1),
        sourceType: z.string().min(1).optional(),
        stageCode: z.string().min(1).optional(),
        limit: z.coerce.number().int().positive().max(100).optional(),
      })
      .parse(request.query);

    return transactionRunner.runInTransaction(async () => {
      const items = await knowledgeService.searchKnowledgeEntries({
        projectId,
        query: query.q,
        sourceType: query.sourceType,
        stageCode: query.stageCode,
        limit: query.limit,
        userId: request.currentUser!.id,
      });

      return {
        items,
        summary: knowledgeService.summarizeKnowledgeEntries(items),
      };
    });
  });
}
