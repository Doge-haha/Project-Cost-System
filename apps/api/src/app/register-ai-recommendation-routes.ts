import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import type { AiRecommendationService } from "../modules/ai/ai-recommendation-service.js";
import type { AiRecommendationType } from "../modules/ai/ai-recommendation-repository.js";
import type { TransactionRunner } from "../shared/tx/transaction.js";

const recommendationTypeSchema = z.enum([
  "bill_recommendation",
  "quota_recommendation",
  "variance_warning",
]);
const recommendationStatusSchema = z.enum([
  "generated",
  "accepted",
  "ignored",
  "expired",
]);

const createRecommendationSchema = z.object({
  projectId: z.string().min(1),
  stageCode: z.string().min(1).optional(),
  disciplineCode: z.string().min(1).optional(),
  resourceType: z.string().min(1),
  resourceId: z.string().min(1),
  inputPayload: z.record(z.string(), z.unknown()).optional(),
  outputPayload: z.record(z.string(), z.unknown()),
});

const generateVarianceWarningsSchema = z.object({
  projectId: z.string().min(1),
  stageCode: z.string().min(1).optional(),
  disciplineCode: z.string().min(1).optional(),
  billVersionId: z.string().min(1).optional(),
  thresholdAmount: z.number().nonnegative().optional(),
  thresholdRate: z.number().nonnegative().optional(),
  limit: z.number().int().positive().max(100).optional(),
  inputPayload: z.record(z.string(), z.unknown()).optional(),
  outputPayload: z.record(z.string(), z.unknown()).optional(),
});

const transitionSchema = z.object({
  reason: z.string().min(1).optional(),
});

export function registerAiRecommendationRoutes(
  app: FastifyInstance,
  input: {
    transactionRunner: TransactionRunner;
    aiRecommendationService: AiRecommendationService;
  },
) {
  const { transactionRunner, aiRecommendationService } = input;

  app.post("/v1/ai/bill-recommendations", async (request, reply) =>
    createRecommendation({
      request,
      reply,
      transactionRunner,
      aiRecommendationService,
      recommendationType: "bill_recommendation",
    }),
  );

  app.post("/v1/ai/quota-recommendations", async (request, reply) =>
    createRecommendation({
      request,
      reply,
      transactionRunner,
      aiRecommendationService,
      recommendationType: "quota_recommendation",
    }),
  );

  app.post("/v1/ai/variance-warnings", async (request, reply) => {
    const payload = generateVarianceWarningsSchema.parse(request.body);
    if (payload.outputPayload) {
      return createRecommendation({
        request,
        reply,
        transactionRunner,
        aiRecommendationService,
        recommendationType: "variance_warning",
      });
    }

    const items = await transactionRunner.runInTransaction(() =>
      aiRecommendationService.generateVarianceWarnings({
        projectId: payload.projectId,
        stageCode: payload.stageCode,
        disciplineCode: payload.disciplineCode,
        billVersionId: payload.billVersionId,
        thresholdAmount: payload.thresholdAmount,
        thresholdRate: payload.thresholdRate,
        limit: payload.limit,
        userId: request.currentUser!.id,
      }),
    );

    reply.code(201);
    return {
      items,
      summary: aiRecommendationService.summarizeRecommendations(items),
    };
  });

  app.get("/v1/projects/:projectId/ai/recommendations", async (request) => {
    const { projectId } = request.params as { projectId: string };
    const query = z
      .object({
        recommendationType: recommendationTypeSchema.optional(),
        resourceType: z.string().min(1).optional(),
        resourceId: z.string().min(1).optional(),
        status: recommendationStatusSchema.optional(),
        stageCode: z.string().min(1).optional(),
        disciplineCode: z.string().min(1).optional(),
        limit: z.coerce.number().int().positive().max(100).optional(),
      })
      .parse(request.query);

    return transactionRunner.runInTransaction(async () => {
      const items = await aiRecommendationService.listRecommendations({
        projectId,
        recommendationType: query.recommendationType,
        resourceType: query.resourceType,
        resourceId: query.resourceId,
        status: query.status,
        stageCode: query.stageCode,
        disciplineCode: query.disciplineCode,
        limit: query.limit,
        userId: request.currentUser!.id,
      });

      return {
        items,
        summary: aiRecommendationService.summarizeRecommendations(items),
      };
    });
  });

  app.get("/v1/projects/:projectId/ai/bill-recommendations", async (request) =>
    listByType(request, transactionRunner, aiRecommendationService, "bill_recommendation"),
  );

  app.get("/v1/projects/:projectId/ai/quota-recommendations", async (request) =>
    listByType(
      request,
      transactionRunner,
      aiRecommendationService,
      "quota_recommendation",
    ),
  );

  app.get("/v1/projects/:projectId/ai/variance-warnings", async (request) =>
    listByType(request, transactionRunner, aiRecommendationService, "variance_warning"),
  );

  app.post("/v1/ai/recommendations/:recommendationId/accept", async (request) => {
    const { recommendationId } = request.params as { recommendationId: string };
    const payload = transitionSchema.parse(request.body ?? {});

    return transactionRunner.runInTransaction(() =>
      aiRecommendationService.transitionRecommendation({
        recommendationId,
        status: "accepted",
        reason: payload.reason,
        userId: request.currentUser!.id,
      }),
    );
  });

  app.post("/v1/ai/recommendations/:recommendationId/ignore", async (request) => {
    const { recommendationId } = request.params as { recommendationId: string };
    const payload = transitionSchema.parse(request.body ?? {});

    return transactionRunner.runInTransaction(() =>
      aiRecommendationService.transitionRecommendation({
        recommendationId,
        status: "ignored",
        reason: payload.reason,
        userId: request.currentUser!.id,
      }),
    );
  });

  app.post("/v1/ai/recommendations/:recommendationId/expire", async (request) => {
    const { recommendationId } = request.params as { recommendationId: string };
    const payload = transitionSchema.parse(request.body ?? {});

    return transactionRunner.runInTransaction(() =>
      aiRecommendationService.transitionRecommendation({
        recommendationId,
        status: "expired",
        reason: payload.reason,
        userId: request.currentUser!.id,
      }),
    );
  });
}

async function createRecommendation(input: {
  request: FastifyRequest;
  reply: FastifyReply;
  transactionRunner: TransactionRunner;
  aiRecommendationService: AiRecommendationService;
  recommendationType: AiRecommendationType;
}) {
  const payload = createRecommendationSchema.parse(input.request.body);
  const created = await input.transactionRunner.runInTransaction(() =>
    input.aiRecommendationService.createRecommendation({
      ...payload,
      recommendationType: input.recommendationType,
      userId: input.request.currentUser!.id,
    }),
  );

  input.reply.code(201);
  return created;
}

async function listByType(
  request: FastifyRequest,
  transactionRunner: TransactionRunner,
  aiRecommendationService: AiRecommendationService,
  recommendationType: AiRecommendationType,
) {
  const { projectId } = request.params as { projectId: string };
  const query = z
    .object({
      resourceType: z.string().min(1).optional(),
      resourceId: z.string().min(1).optional(),
      status: recommendationStatusSchema.optional(),
      stageCode: z.string().min(1).optional(),
      disciplineCode: z.string().min(1).optional(),
      limit: z.coerce.number().int().positive().max(100).optional(),
    })
    .parse(request.query);

  return transactionRunner.runInTransaction(async () => {
    const items = await aiRecommendationService.listRecommendations({
      projectId,
      recommendationType,
      resourceType: query.resourceType,
      resourceId: query.resourceId,
      status: query.status,
      stageCode: query.stageCode,
      disciplineCode: query.disciplineCode,
      limit: query.limit,
      userId: request.currentUser!.id,
    });

    return {
      items,
      summary: aiRecommendationService.summarizeRecommendations(items),
    };
  });
}
