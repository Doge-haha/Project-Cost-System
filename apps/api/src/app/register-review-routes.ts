import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { TransactionRunner } from "../shared/tx/transaction.js";
import {
  approveReviewSchema,
  cancelReviewSchema,
  rejectReviewSchema,
  submitReviewSchema,
  type ReviewSubmissionService,
} from "../modules/review/review-submission-service.js";
import { reviewSubmissionStatuses } from "../modules/review/review-submission-constants.js";

export function registerReviewRoutes(
  app: FastifyInstance,
  input: {
    transactionRunner: TransactionRunner;
    reviewSubmissionService: ReviewSubmissionService;
  },
) {
  const { transactionRunner, reviewSubmissionService } = input;

  app.post(
    "/v1/projects/:projectId/bill-versions/:billVersionId/reviews",
    async (request, reply) => {
      const { projectId, billVersionId } = request.params as {
        projectId: string;
        billVersionId: string;
      };
      const payload = submitReviewSchema.parse(request.body ?? {});

      const created = await transactionRunner.runInTransaction(async () =>
        reviewSubmissionService.submitReview({
          projectId,
          billVersionId,
          comment: payload.comment,
          userId: request.currentUser!.id,
        }),
      );

      reply.status(201);
      return created;
    },
  );

  app.get("/v1/projects/:projectId/reviews", async (request) => {
    const { projectId } = request.params as {
      projectId: string;
    };
    const query = z
      .object({
        billVersionId: z.string().min(1).optional(),
        stageCode: z.string().min(1).optional(),
        disciplineCode: z.string().min(1).optional(),
        status: z.enum(reviewSubmissionStatuses).optional(),
      })
      .parse(request.query);

    return transactionRunner.runInTransaction(async () =>
      reviewSubmissionService.listReviewSubmissions({
        projectId,
        billVersionId: query.billVersionId,
        stageCode: query.stageCode,
        disciplineCode: query.disciplineCode,
        status: query.status,
        userId: request.currentUser!.id,
      }),
    );
  });

  app.post(
    "/v1/projects/:projectId/reviews/:reviewSubmissionId/approve",
    async (request) => {
      const { projectId, reviewSubmissionId } = request.params as {
        projectId: string;
        reviewSubmissionId: string;
      };
      const payload = approveReviewSchema.parse(request.body ?? {});

      return transactionRunner.runInTransaction(async () =>
        reviewSubmissionService.approveReview({
          projectId,
          reviewSubmissionId,
          comment: payload.comment,
          userId: request.currentUser!.id,
        }),
      );
    },
  );

  app.post(
    "/v1/projects/:projectId/reviews/:reviewSubmissionId/reject",
    async (request) => {
      const { projectId, reviewSubmissionId } = request.params as {
        projectId: string;
        reviewSubmissionId: string;
      };
      const payload = rejectReviewSchema.parse(request.body ?? {});

      return transactionRunner.runInTransaction(async () =>
        reviewSubmissionService.rejectReview({
          projectId,
          reviewSubmissionId,
          reason: payload.reason,
          comment: payload.comment,
          userId: request.currentUser!.id,
        }),
      );
    },
  );

  app.post(
    "/v1/projects/:projectId/reviews/:reviewSubmissionId/cancel",
    async (request) => {
      const { projectId, reviewSubmissionId } = request.params as {
        projectId: string;
        reviewSubmissionId: string;
      };
      const payload = cancelReviewSchema.parse(request.body ?? {});

      return transactionRunner.runInTransaction(async () =>
        reviewSubmissionService.cancelReview({
          projectId,
          reviewSubmissionId,
          comment: payload.comment,
          userId: request.currentUser!.id,
        }),
      );
    },
  );
}
