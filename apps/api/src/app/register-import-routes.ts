import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { AuthenticatedUser } from "../shared/auth/jwt.js";
import { AppError } from "../shared/errors/app-error.js";
import type { TransactionRunner } from "../shared/tx/transaction.js";
import type { AiRuntimePreviewService } from "../modules/ai/ai-runtime-preview-service.js";
import type { AuditLogService } from "../modules/audit/audit-log-service.js";
import type { BackgroundJobService } from "../modules/jobs/background-job-service.js";
import {
  createImportTaskSchema,
  type ImportTaskService,
} from "../modules/import/import-task-service.js";
import {
  buildFailureDetails,
  buildGeneratedBatchNo,
  buildImportFileMetadata,
  parseImportFileContent,
  uploadImportTaskSchema,
} from "./import-file-parser.js";

const aiRuntimePreviewSchema = z.object({
  source: z.string().min(1),
  events: z.array(z.record(z.string(), z.unknown())).max(100),
});

const enqueueKnowledgeExtractionSchema = aiRuntimePreviewSchema.extend({
  projectId: z.string().min(1),
  sourceFileName: z.string().min(1).optional(),
  sourceBatchNo: z.string().min(1).optional(),
});

const enqueueKnowledgeExtractionFromAuditSchema = z.object({
  source: z.string().min(1).default("audit_log"),
  resourceType: z.string().min(1).optional(),
  resourceId: z.string().min(1).optional(),
  resourceIdPrefix: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
  operatorId: z.string().min(1).optional(),
  createdFrom: z.string().datetime().optional(),
  createdTo: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

function assertCanPreviewAiRuntime(currentUser: AuthenticatedUser): void {
  const allowedRoles = new Set(["system_admin", "project_owner"]);
  if (currentUser.roleCodes.some((roleCode) => allowedRoles.has(roleCode))) {
    return;
  }

  throw new AppError(
    403,
    "FORBIDDEN",
    "Current user cannot preview AI runtime extraction",
  );
}

export function registerImportRoutes(
  app: FastifyInstance,
  input: {
    transactionRunner: TransactionRunner;
    aiRuntimePreviewService: AiRuntimePreviewService;
    backgroundJobService: BackgroundJobService;
    auditLogService: AuditLogService;
    importTaskService: ImportTaskService;
  },
) {
  const {
    transactionRunner,
    aiRuntimePreviewService,
    backgroundJobService,
    auditLogService,
    importTaskService,
  } = input;

  async function createKnowledgeExtractionJobWithImportTask(input: {
    projectId: string;
    source: string;
    sourceLabel: string;
    sourceFileName?: string | null;
    sourceBatchNo?: string | null;
    events: Array<Record<string, unknown>>;
    totalItemCount?: number;
    failedItemCount?: number;
    failureDetails?: string[];
    latestErrorMessage?: string | null;
    metadata?: Record<string, unknown>;
    requestedBy: string;
  }) {
    return transactionRunner.runInTransaction(async () => {
      const task = await importTaskService.createImportTask({
        projectId: input.projectId,
        sourceType: input.source,
        sourceLabel: input.sourceLabel,
        sourceFileName: input.sourceFileName ?? null,
        sourceBatchNo: input.sourceBatchNo ?? null,
        totalItemCount: input.totalItemCount ?? input.events.length,
        failedItemCount: input.failedItemCount ?? 0,
        failureDetails: input.failureDetails ?? [],
        latestErrorMessage: input.latestErrorMessage ?? null,
        metadata: input.metadata,
        requestedBy: input.requestedBy,
      });

      const job = await backgroundJobService.enqueueJob({
        jobType: "knowledge_extraction",
        requestedBy: input.requestedBy,
        projectId: input.projectId,
        payload: {
          projectId: input.projectId,
          source: input.source,
          sourceLabel: input.sourceLabel,
          importTaskId: task.id,
          events: input.events,
        },
      });

      return { task, job };
    });
  }

  app.post("/v1/ai-runtime/extract-preview", async (request) => {
    assertCanPreviewAiRuntime(request.currentUser!);
    const payload = aiRuntimePreviewSchema.parse(request.body);

    return aiRuntimePreviewService.processEventBatch({
      source: payload.source,
      events: payload.events,
    });
  });

  app.post("/v1/ai-runtime/extract-jobs", async (request, reply) => {
    assertCanPreviewAiRuntime(request.currentUser!);
    const payload = enqueueKnowledgeExtractionSchema.parse(request.body);

    const created = await createKnowledgeExtractionJobWithImportTask({
      projectId: payload.projectId,
      source: payload.source,
      sourceLabel: payload.source,
      sourceFileName: payload.sourceFileName,
      sourceBatchNo: payload.sourceBatchNo,
      events: payload.events,
      metadata: {
        createdFrom: "extract_jobs",
      },
      requestedBy: request.currentUser!.id,
    });

    reply.status(202);
    return created;
  });

  app.post(
    "/v1/projects/:projectId/ai-runtime/extract-from-audit",
    async (request, reply) => {
      assertCanPreviewAiRuntime(request.currentUser!);
      const { projectId } = request.params as { projectId: string };
      const payload = enqueueKnowledgeExtractionFromAuditSchema.parse(request.body);

      const logs = await transactionRunner.runInTransaction(async () =>
        auditLogService.listAuditLogs({
          projectId,
          resourceType: payload.resourceType,
          resourceId: payload.resourceId,
          resourceIdPrefix: payload.resourceIdPrefix,
          action: payload.action,
          operatorId: payload.operatorId,
          createdFrom: payload.createdFrom,
          createdTo: payload.createdTo,
          limit: payload.limit,
          userId: request.currentUser!.id,
        }),
      );

      const events = logs.map((log) => ({
        id: log.id,
        projectId: log.projectId,
        stageCode: log.stageCode ?? null,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        action: log.action,
        operatorId: log.operatorId,
        beforePayload: log.beforePayload ?? null,
        afterPayload: log.afterPayload ?? null,
        createdAt: log.createdAt,
      }));
      const created = await createKnowledgeExtractionJobWithImportTask({
        projectId,
        source: payload.source,
        sourceLabel: "审计日志筛选导入",
        sourceBatchNo: `audit-${Date.now()}`,
        events,
        metadata: {
          createdFrom: "audit_log",
          filters: payload,
        },
        requestedBy: request.currentUser!.id,
      });

      reply.status(202);
      return {
        ...created,
        source: payload.source,
        eventCount: logs.length,
      };
    },
  );

  app.get("/v1/projects/:projectId/import-tasks", async (request) => {
    const { projectId } = request.params as { projectId: string };

    return transactionRunner.runInTransaction(async () =>
      importTaskService.listImportTasks({
        projectId,
        userId: request.currentUser!.id,
      }),
    );
  });

  app.get("/v1/projects/:projectId/import-tasks/:taskId/error-report", async (request, reply) => {
    const { projectId, taskId } = request.params as {
      projectId: string;
      taskId: string;
    };
    const query = z
      .object({
        failureReason: z.string().min(1).optional(),
        format: z.enum(["json", "csv"]).optional(),
      })
      .parse(request.query);

    const download = await transactionRunner.runInTransaction(async () =>
      importTaskService.downloadImportTaskErrorReport({
        projectId,
        taskId,
        userId: request.currentUser!.id,
        failureReason: query.failureReason,
        format: query.format,
      }),
    );

    reply.header("content-type", download.contentType);
    reply.header("content-disposition", `attachment; filename="${download.fileName}"`);
    return download.content;
  });

  app.post("/v1/projects/:projectId/import-tasks", async (request, reply) => {
    assertCanPreviewAiRuntime(request.currentUser!);
    const { projectId } = request.params as { projectId: string };
    const payload = createImportTaskSchema.parse(request.body);

    const created = await createKnowledgeExtractionJobWithImportTask({
      projectId,
      source: payload.source,
      sourceLabel: payload.sourceLabel ?? payload.source,
      sourceFileName: payload.sourceFileName,
      sourceBatchNo: payload.sourceBatchNo,
      events: payload.events,
      metadata: {
        createdFrom: "project_import_task",
      },
      requestedBy: request.currentUser!.id,
    });

    reply.status(202);
    return created;
  });

  app.post("/v1/projects/:projectId/import-tasks/upload", async (request, reply) => {
    assertCanPreviewAiRuntime(request.currentUser!);
    const { projectId } = request.params as { projectId: string };
    const payload = uploadImportTaskSchema.parse(request.body);
    const parsed = parseImportFileContent(payload.fileName, payload.fileContent);

    const created = await createKnowledgeExtractionJobWithImportTask({
      projectId,
      source: payload.sourceType,
      sourceLabel: payload.sourceLabel ?? `文件导入：${payload.fileName}`,
      sourceFileName: payload.fileName,
      sourceBatchNo: buildGeneratedBatchNo("upload"),
      events: parsed.events,
      totalItemCount: parsed.totalItemCount,
      failedItemCount: parsed.failedItems.length,
      failureDetails: buildFailureDetails(parsed.failedItems),
      latestErrorMessage: parsed.failedItems[0]?.errorMessage ?? null,
      metadata: {
        createdFrom: "project_file_upload",
        ...buildImportFileMetadata(parsed),
      },
      requestedBy: request.currentUser!.id,
    });

    reply.status(202);
    return {
      ...created,
      uploadedFileName: payload.fileName,
      eventCount: parsed.totalItemCount,
      acceptedEventCount: parsed.events.length,
      detectedFormat: parsed.detectedFormat,
    };
  });
}
