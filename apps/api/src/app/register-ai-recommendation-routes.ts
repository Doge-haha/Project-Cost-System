import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import type { AiRecommendationService } from "../modules/ai/ai-recommendation-service.js";
import type { BackgroundJobService } from "../modules/jobs/background-job-service.js";
import type { AiRecommendationType } from "../modules/ai/ai-recommendation-repository.js";
import {
  AI_RECOMMENDATION_ROLLBACK_BLOCKED_REASON_LABELS,
  AI_RECOMMENDATION_ROLLBACK_BLOCKED_REASONS,
} from "../modules/ai/ai-constants.js";
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
  "rolled_back",
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

const generateBillRecommendationsSchema = createRecommendationSchema
  .omit({ outputPayload: true })
  .extend({
    outputPayload: z.record(z.string(), z.unknown()).optional(),
    limit: z.number().int().positive().max(100).optional(),
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

const generateRecommendationJobSchema = generateVarianceWarningsSchema.extend({
  recommendationType: recommendationTypeSchema,
  resourceType: z.string().min(1).optional(),
  resourceId: z.string().min(1).optional(),
  provider: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
});

const transitionSchema = z.object({
  reason: z.string().min(1).optional(),
});

const recommendationContextQuerySchema = z.object({
  recommendationType: recommendationTypeSchema,
  resourceType: z.string().min(1).optional(),
  resourceId: z.string().min(1).optional(),
  billVersionId: z.string().min(1).optional(),
  stageCode: z.string().min(1).optional(),
  disciplineCode: z.string().min(1).optional(),
});

const expireStaleSchema = z.object({
  projectId: z.string().min(1),
  recommendationType: recommendationTypeSchema.optional(),
  resourceType: z.string().min(1).optional(),
  resourceId: z.string().min(1).optional(),
  stageCode: z.string().min(1).optional(),
  disciplineCode: z.string().min(1).optional(),
  reason: z.string().min(1),
});

const varianceWarningThresholdSchema = z.object({
  stageCode: z.string().min(1).nullable().optional(),
  disciplineCode: z.string().min(1).nullable().optional(),
  thresholdAmount: z.number().nonnegative(),
  thresholdRate: z.number().nonnegative(),
});

export function registerAiRecommendationRoutes(
  app: FastifyInstance,
  input: {
    transactionRunner: TransactionRunner;
    aiRecommendationService: AiRecommendationService;
    backgroundJobService: BackgroundJobService;
  },
) {
  const { transactionRunner, aiRecommendationService, backgroundJobService } = input;

  app.post("/v1/ai/bill-recommendations", async (request, reply) => {
    const payload = generateBillRecommendationsSchema.parse(request.body);
    if (payload.outputPayload) {
      return createRecommendation({
        request,
        reply,
        transactionRunner,
        aiRecommendationService,
        recommendationType: "bill_recommendation",
      });
    }

    const result = await transactionRunner.runInTransaction(() =>
      aiRecommendationService.generateProviderRecommendations({
        projectId: payload.projectId,
        stageCode: payload.stageCode,
        disciplineCode: payload.disciplineCode,
        recommendationType: "bill_recommendation",
        resourceType: payload.resourceType,
        resourceId: payload.resourceId,
        inputPayload: payload.inputPayload,
        limit: payload.limit,
        userId: request.currentUser!.id,
      }),
    );

    reply.code(201);
    return {
      items: result.recommendations,
      summary: aiRecommendationService.summarizeRecommendations(
        result.recommendations,
      ),
      provider: result.provider,
      telemetry: result.telemetry,
      createdCount: result.createdCount,
    };
  });

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

  app.post("/v1/ai/recommendation-jobs", async (request, reply) => {
    const payload = generateRecommendationJobSchema.parse(request.body);
    const job = await transactionRunner.runInTransaction(() =>
      backgroundJobService.enqueueJob({
        jobType: "ai_recommendation",
        requestedBy: request.currentUser!.id,
        roleCodes: request.currentUser!.roleCodes,
        projectId: payload.projectId,
        payload: {
          projectId: payload.projectId,
          recommendationType: payload.recommendationType,
          resourceType: payload.resourceType ?? null,
          resourceId: payload.resourceId ?? null,
          billVersionId: payload.billVersionId ?? null,
          stageCode: payload.stageCode ?? null,
          disciplineCode: payload.disciplineCode ?? null,
          thresholdAmount: payload.thresholdAmount ?? null,
          thresholdRate: payload.thresholdRate ?? null,
          limit: payload.limit ?? null,
          provider: payload.provider ?? null,
          model: payload.model ?? null,
          inputPayload: payload.inputPayload ?? null,
          outputPayload: payload.outputPayload ?? null,
        },
      }),
    );

    reply.code(202);
    return { job };
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

  app.get("/v1/projects/:projectId/ai/recommendation-context", async (request) => {
    const { projectId } = request.params as { projectId: string };
    const query = recommendationContextQuerySchema.parse(request.query);

    return transactionRunner.runInTransaction(() =>
      aiRecommendationService.buildRecommendationInputContext({
        projectId,
        recommendationType: query.recommendationType,
        resourceType: query.resourceType,
        resourceId: query.resourceId,
        billVersionId: query.billVersionId,
        stageCode: query.stageCode,
        disciplineCode: query.disciplineCode,
        userId: request.currentUser!.id,
      }),
    );
  });

  app.get("/v1/ai/provider-health", async (request) => {
    const query = z
      .object({
        provider: z.string().min(1).optional(),
        model: z.string().min(1).optional(),
      })
      .parse(request.query);

    return transactionRunner.runInTransaction(() =>
      aiRecommendationService.checkProviderHealth({
        provider: query.provider,
        model: query.model,
        userId: request.currentUser!.id,
      }),
    );
  });

  app.get("/v1/projects/:projectId/ai/provider-telemetry", async (request) => {
    const { projectId } = request.params as { projectId: string };
    const query = z
      .object({
        limit: z.coerce.number().int().positive().max(100).optional(),
      })
      .parse(request.query);

    return transactionRunner.runInTransaction(() =>
      backgroundJobService.summarizeAiProviderTelemetry({
        projectId,
        limit: query.limit,
        userId: request.currentUser!.id,
        roleCodes: request.currentUser!.roleCodes,
      }),
    );
  });

  app.get("/v1/ai/recommendations/rollback-blocked-reasons", async () => ({
    items: AI_RECOMMENDATION_ROLLBACK_BLOCKED_REASONS.map((reason) => ({
      reason,
      label: AI_RECOMMENDATION_ROLLBACK_BLOCKED_REASON_LABELS[reason],
    })),
  }));

  app.get("/v1/projects/:projectId/ai/variance-warning-thresholds", async (request) => {
    const { projectId } = request.params as { projectId: string };
    const query = z
      .object({
        stageCode: z.string().min(1).optional(),
        disciplineCode: z.string().min(1).optional(),
      })
      .parse(request.query);

    return transactionRunner.runInTransaction(async () => ({
      items: await aiRecommendationService.listVarianceWarningThresholds({
        projectId,
        stageCode: query.stageCode,
        disciplineCode: query.disciplineCode,
        userId: request.currentUser!.id,
      }),
    }));
  });

  app.put("/v1/projects/:projectId/ai/variance-warning-thresholds", async (request) => {
    const { projectId } = request.params as { projectId: string };
    const payload = varianceWarningThresholdSchema.parse(request.body);

    return transactionRunner.runInTransaction(() =>
      aiRecommendationService.configureVarianceWarningThreshold({
        projectId,
        stageCode: payload.stageCode ?? undefined,
        disciplineCode: payload.disciplineCode ?? undefined,
        thresholdAmount: payload.thresholdAmount,
        thresholdRate: payload.thresholdRate,
        userId: request.currentUser!.id,
      }),
    );
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

  app.post("/v1/ai/recommendations/:recommendationId/rollback", async (request) => {
    const { recommendationId } = request.params as { recommendationId: string };
    const payload = transitionSchema.parse(request.body ?? {});

    return transactionRunner.runInTransaction(() =>
      aiRecommendationService.rollbackAcceptedRecommendation({
        recommendationId,
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

  app.post("/v1/ai/recommendations/expire-stale", async (request) => {
    const payload = expireStaleSchema.parse(request.body);

    return transactionRunner.runInTransaction(async () => {
      const items = await aiRecommendationService.expireStaleRecommendations({
        projectId: payload.projectId,
        recommendationType: payload.recommendationType,
        resourceType: payload.resourceType,
        resourceId: payload.resourceId,
        stageCode: payload.stageCode,
        disciplineCode: payload.disciplineCode,
        reason: payload.reason,
        userId: request.currentUser!.id,
      });
      return {
        items,
        summary: aiRecommendationService.summarizeRecommendations(items),
      };
    });
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
