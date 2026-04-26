import type { FastifyInstance } from "fastify";

import type { TransactionRunner } from "../shared/tx/transaction.js";
import type { AiRuntimePreviewService } from "../modules/ai/ai-runtime-preview-service.js";
import type { AuditLogService } from "../modules/audit/audit-log-service.js";
import type { BackgroundJobService } from "../modules/jobs/background-job-service.js";
import type { ImportTaskService } from "../modules/import/import-task-service.js";
import type { KnowledgeService } from "../modules/knowledge/knowledge-service.js";
import type { ProcessDocumentService } from "../modules/process/process-document-service.js";
import type { ProjectService } from "../modules/project/project-service.js";
import { registerImportRoutes } from "./register-import-routes.js";
import { registerKnowledgeRoutes } from "./register-knowledge-routes.js";
import { registerProcessDocumentRoutes } from "./register-process-document-routes.js";
import { registerProjectCoreRoutes } from "./register-project-core-routes.js";

export function registerProjectRoutes(
  app: FastifyInstance,
  input: {
    transactionRunner: TransactionRunner;
    aiRuntimePreviewService: AiRuntimePreviewService;
    backgroundJobService: BackgroundJobService;
    projectService: ProjectService;
    auditLogService: AuditLogService;
    knowledgeService: KnowledgeService;
    processDocumentService: ProcessDocumentService;
    importTaskService: ImportTaskService;
  },
) {
  registerImportRoutes(app, {
    transactionRunner: input.transactionRunner,
    aiRuntimePreviewService: input.aiRuntimePreviewService,
    backgroundJobService: input.backgroundJobService,
    auditLogService: input.auditLogService,
    importTaskService: input.importTaskService,
  });

  registerProjectCoreRoutes(app, {
    transactionRunner: input.transactionRunner,
    projectService: input.projectService,
    auditLogService: input.auditLogService,
  });

  registerKnowledgeRoutes(app, {
    transactionRunner: input.transactionRunner,
    knowledgeService: input.knowledgeService,
  });

  registerProcessDocumentRoutes(app, {
    transactionRunner: input.transactionRunner,
    processDocumentService: input.processDocumentService,
  });
}
