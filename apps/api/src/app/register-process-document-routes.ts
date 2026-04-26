import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { TransactionRunner } from "../shared/tx/transaction.js";
import {
  createProcessDocumentSchema,
  type ProcessDocumentService,
  updateProcessDocumentSchema,
  updateProcessDocumentStatusSchema,
} from "../modules/process/process-document-service.js";

export function registerProcessDocumentRoutes(
  app: FastifyInstance,
  input: {
    transactionRunner: TransactionRunner;
    processDocumentService: ProcessDocumentService;
  },
) {
  const { transactionRunner, processDocumentService } = input;

  app.get("/v1/projects/:projectId/process-documents", async (request) => {
    const { projectId } = request.params as { projectId: string };
    const query = z
      .object({
        stageCode: z.string().min(1).optional(),
        disciplineCode: z.string().min(1).optional(),
        documentType: z
          .enum(["change_order", "site_visa", "progress_payment"])
          .optional(),
        status: z.enum(["draft", "submitted", "approved", "rejected"]).optional(),
      })
      .parse(request.query);

    return transactionRunner.runInTransaction(async () =>
      processDocumentService.listProcessDocuments({
        projectId,
        stageCode: query.stageCode,
        disciplineCode: query.disciplineCode,
        documentType: query.documentType,
        status: query.status,
        userId: request.currentUser!.id,
      }),
    );
  });

  app.post("/v1/projects/:projectId/process-documents", async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const payload = createProcessDocumentSchema.parse(request.body);

    const created = await transactionRunner.runInTransaction(async () =>
      processDocumentService.createProcessDocument({
        projectId,
        stageCode: payload.stageCode,
        disciplineCode: payload.disciplineCode,
        documentType: payload.documentType,
        title: payload.title,
        referenceNo: payload.referenceNo,
        amount: payload.amount,
        comment: payload.comment,
        userId: request.currentUser!.id,
      }),
    );

    reply.status(201);
    return created;
  });

  app.put("/v1/projects/:projectId/process-documents/:documentId", async (request) => {
    const { projectId, documentId } = request.params as {
      projectId: string;
      documentId: string;
    };
    const payload = updateProcessDocumentSchema.parse(request.body);

    return transactionRunner.runInTransaction(async () =>
      processDocumentService.updateProcessDocument({
        projectId,
        documentId,
        title: payload.title,
        referenceNo: payload.referenceNo,
        amount: payload.amount,
        comment: payload.comment,
        userId: request.currentUser!.id,
      }),
    );
  });

  app.delete(
    "/v1/projects/:projectId/process-documents/:documentId",
    async (request, reply) => {
      const { projectId, documentId } = request.params as {
        projectId: string;
        documentId: string;
      };

      await transactionRunner.runInTransaction(async () =>
        processDocumentService.deleteProcessDocument({
          projectId,
          documentId,
          userId: request.currentUser!.id,
        }),
      );

      reply.status(204);
      return null;
    },
  );

  app.put(
    "/v1/projects/:projectId/process-documents/:documentId/status",
    async (request) => {
      const { projectId, documentId } = request.params as {
        projectId: string;
        documentId: string;
      };
      const payload = updateProcessDocumentStatusSchema.parse(request.body);

      return transactionRunner.runInTransaction(async () =>
        processDocumentService.updateProcessDocumentStatus({
          projectId,
          documentId,
          status: payload.status,
          comment: payload.comment,
          userId: request.currentUser!.id,
        }),
      );
    },
  );
}
