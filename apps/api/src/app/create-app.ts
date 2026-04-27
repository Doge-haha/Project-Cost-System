import Fastify, { type FastifyInstance } from "fastify";

import type { CreateAppOptions } from "./create-app-options.js";
import { createAppDependencies } from "./create-app-dependencies.js";
import { setupAppBase } from "./setup-app-base.js";
import { registerProjectRoutes } from "./register-project-routes.js";
import { registerBusinessRoutes } from "./register-business-routes.js";

export function createApp(options: CreateAppOptions): FastifyInstance {
  const app = Fastify();
  const { services } = createAppDependencies(options);

  setupAppBase(app, {
    jwtSecret: options.jwtSecret,
  });

  registerProjectRoutes(app, {
    transactionRunner: services.transactionRunner,
    aiRuntimePreviewService: services.aiRuntimePreviewService,
    aiRecommendationService: services.aiRecommendationService,
    backgroundJobService: services.backgroundJobService,
    projectService: services.projectService,
    auditLogService: services.auditLogService,
    knowledgeService: services.knowledgeService,
    processDocumentService: services.processDocumentService,
    importTaskService: services.importTaskService,
  });

  registerBusinessRoutes(app, {
    transactionRunner: services.transactionRunner,
    billVersionService: services.billVersionService,
    billItemService: services.billItemService,
    billWorkItemService: services.billWorkItemService,
    quotaLineService: services.quotaLineService,
    priceVersionService: services.priceVersionService,
    priceItemService: services.priceItemService,
    calculateService: services.calculateService,
    reviewSubmissionService: services.reviewSubmissionService,
    summaryService: services.summaryService,
    reportExportTaskService: services.reportExportTaskService,
    backgroundJobService: services.backgroundJobService,
    backgroundJobProcessor: services.backgroundJobProcessor,
    feeTemplateService: services.feeTemplateService,
  });

  return app;
}
