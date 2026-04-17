import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";

import { verifyAccessToken, type AuthenticatedUser } from "../shared/auth/jwt.js";
import { AppError, isAppError } from "../shared/errors/app-error.js";
import {
  normalizePagination,
  type PaginationEnvelope,
} from "../shared/http/pagination.js";
import { InlineTransactionRunner } from "../shared/tx/transaction.js";
import {
  InMemoryProjectRepository,
  type ProjectRepository,
} from "../modules/project/project-repository.js";
import {
  InMemoryProjectStageRepository,
  type ProjectStageRepository,
} from "../modules/project/project-stage-repository.js";
import {
  InMemoryProjectDisciplineRepository,
  type ProjectDisciplineRepository,
} from "../modules/project/project-discipline-repository.js";
import {
  InMemoryProjectMemberRepository,
  type ProjectMemberRepository,
} from "../modules/project/project-member-repository.js";
import { ProjectService } from "../modules/project/project-service.js";
import {
  createBillVersionSchema,
  BillVersionService,
  billVersionContextSchema,
} from "../modules/bill/bill-version-service.js";
import {
  InMemoryBillVersionRepository,
  type BillVersionRepository,
} from "../modules/bill/bill-version-repository.js";
import {
  createBillItemSchema,
  BillItemService,
  updateBillItemManualPricingSchema,
  updateBillItemSchema,
} from "../modules/bill/bill-item-service.js";
import {
  InMemoryBillItemRepository,
  type BillItemRepository,
} from "../modules/bill/bill-item-repository.js";
import {
  createBillWorkItemSchema,
  BillWorkItemService,
} from "../modules/bill/bill-work-item-service.js";
import {
  InMemoryBillWorkItemRepository,
  type BillWorkItemRepository,
} from "../modules/bill/bill-work-item-repository.js";
import {
  createQuotaLineSchema,
  QuotaLineService,
  updateQuotaLineSchema,
} from "../modules/quota/quota-line-service.js";
import {
  InMemoryQuotaLineRepository,
  type QuotaLineRepository,
} from "../modules/quota/quota-line-repository.js";
import {
  InMemoryPriceVersionRepository,
  type PriceVersionRepository,
} from "../modules/pricing/price-version-repository.js";
import {
  listPriceVersionSchema,
  PriceVersionService,
} from "../modules/pricing/price-version-service.js";
import {
  InMemoryPriceItemRepository,
  type PriceItemRepository,
} from "../modules/pricing/price-item-repository.js";
import {
  listPriceItemSchema,
  PriceItemService,
} from "../modules/pricing/price-item-service.js";
import {
  calculateEngineSchema,
  CalculateService,
} from "../modules/engine/calculate-service.js";
import {
  InMemoryFeeTemplateRepository,
  type FeeTemplateRepository,
} from "../modules/fee/fee-template-repository.js";
import {
  InMemoryFeeRuleRepository,
  type FeeRuleRepository,
} from "../modules/fee/fee-rule-repository.js";
import {
  listFeeTemplateSchema,
  FeeTemplateService,
} from "../modules/fee/fee-template-service.js";
import { z } from "zod";
import { SummaryService } from "../modules/reports/summary-service.js";
import {
  InMemoryReportExportTaskRepository,
  type ReportExportTaskRepository,
} from "../modules/reports/report-export-task-repository.js";
import {
  createReportExportTaskSchema,
  ReportExportTaskService,
} from "../modules/reports/report-export-task-service.js";
import {
  approveReviewSchema,
  cancelReviewSchema,
  rejectReviewSchema,
  ReviewSubmissionService,
  submitReviewSchema,
} from "../modules/review/review-submission-service.js";
import {
  InMemoryReviewSubmissionRepository,
  type ReviewSubmissionRepository,
} from "../modules/review/review-submission-repository.js";
import {
  InMemoryAuditLogRepository,
  type AuditLogRepository,
} from "../modules/audit/audit-log-repository.js";
import { AuditLogService } from "../modules/audit/audit-log-service.js";
import {
  createProcessDocumentSchema,
  ProcessDocumentService,
  updateProcessDocumentStatusSchema,
} from "../modules/process/process-document-service.js";
import {
  InMemoryProcessDocumentRepository,
  type ProcessDocumentRepository,
} from "../modules/process/process-document-repository.js";

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: AuthenticatedUser;
  }
}

export type CreateAppOptions = {
  jwtSecret: string;
  projectRepository?: ProjectRepository;
  projectStageRepository?: ProjectStageRepository;
  projectDisciplineRepository?: ProjectDisciplineRepository;
  projectMemberRepository?: ProjectMemberRepository;
  billVersionRepository?: BillVersionRepository;
  billItemRepository?: BillItemRepository;
  billWorkItemRepository?: BillWorkItemRepository;
  quotaLineRepository?: QuotaLineRepository;
  priceVersionRepository?: PriceVersionRepository;
  priceItemRepository?: PriceItemRepository;
  feeTemplateRepository?: FeeTemplateRepository;
  feeRuleRepository?: FeeRuleRepository;
  reviewSubmissionRepository?: ReviewSubmissionRepository;
  auditLogRepository?: AuditLogRepository;
  processDocumentRepository?: ProcessDocumentRepository;
  reportExportTaskRepository?: ReportExportTaskRepository;
};

const updateProjectPricingDefaultsSchema = z.object({
  defaultPriceVersionId: z.string().min(1).nullable().optional(),
  defaultFeeTemplateId: z.string().min(1).nullable().optional(),
});
const recalculateBillVersionSchema = z.object({
  priceVersionId: z.string().min(1).optional(),
  feeTemplateId: z.string().min(1).optional(),
});
const recalculateProjectSchema = z.object({
  stageCode: z.string().min(1).optional(),
  disciplineCode: z.string().min(1).optional(),
  priceVersionId: z.string().min(1).optional(),
  feeTemplateId: z.string().min(1).optional(),
});
const summaryQuerySchema = z.object({
  projectId: z.string().min(1),
  stageCode: z.string().min(1).optional(),
  disciplineCode: z.string().min(1).optional(),
  unitCode: z.string().min(1).optional(),
});
const summaryDetailQuerySchema = z.object({
  projectId: z.string().min(1),
  stageCode: z.string().min(1).optional(),
  disciplineCode: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

function extractBearerToken(authorizationHeader?: string): string {
  if (!authorizationHeader) {
    throw new AppError(401, "UNAUTHENTICATED", "Missing bearer token");
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    throw new AppError(401, "UNAUTHENTICATED", "Missing bearer token");
  }

  return token;
}

export function createApp(options: CreateAppOptions): FastifyInstance {
  const app = Fastify();
  const transactionRunner = new InlineTransactionRunner();
  const repositories = {
    project: options.projectRepository ?? new InMemoryProjectRepository([]),
    projectStage:
      options.projectStageRepository ?? new InMemoryProjectStageRepository([]),
    projectDiscipline:
      options.projectDisciplineRepository ??
      new InMemoryProjectDisciplineRepository([]),
    projectMember:
      options.projectMemberRepository ?? new InMemoryProjectMemberRepository([]),
    billVersion:
      options.billVersionRepository ?? new InMemoryBillVersionRepository([]),
    billItem: options.billItemRepository ?? new InMemoryBillItemRepository([]),
    billWorkItem:
      options.billWorkItemRepository ?? new InMemoryBillWorkItemRepository([]),
    quotaLine:
      options.quotaLineRepository ?? new InMemoryQuotaLineRepository([]),
    priceVersion:
      options.priceVersionRepository ?? new InMemoryPriceVersionRepository([]),
    priceItem:
      options.priceItemRepository ?? new InMemoryPriceItemRepository([]),
    feeTemplate:
      options.feeTemplateRepository ?? new InMemoryFeeTemplateRepository([]),
    feeRule: options.feeRuleRepository ?? new InMemoryFeeRuleRepository([]),
    reviewSubmission:
      options.reviewSubmissionRepository ??
      new InMemoryReviewSubmissionRepository([]),
    auditLog:
      options.auditLogRepository ?? new InMemoryAuditLogRepository([]),
    processDocument:
      options.processDocumentRepository ??
      new InMemoryProcessDocumentRepository([]),
    reportExportTask:
      options.reportExportTaskRepository ??
      new InMemoryReportExportTaskRepository([]),
  };
  const auditLogService = new AuditLogService(
    repositories.auditLog,
    repositories.project,
  );
  const projectService = new ProjectService(
    repositories.project,
    repositories.projectStage,
    repositories.projectDiscipline,
    repositories.projectMember,
    repositories.priceVersion,
    repositories.feeTemplate,
    auditLogService,
  );
  const billVersionService = new BillVersionService(
    repositories.billVersion,
    {
      projectRepository: repositories.project,
      projectStageRepository: repositories.projectStage,
      projectDisciplineRepository: repositories.projectDiscipline,
      projectMemberRepository: repositories.projectMember,
      billItemRepository: repositories.billItem,
      billWorkItemRepository: repositories.billWorkItem,
    },
  );
  const billItemService = new BillItemService(
    repositories.billItem,
    {
      projectRepository: repositories.project,
      projectStageRepository: repositories.projectStage,
      projectDisciplineRepository: repositories.projectDiscipline,
      projectMemberRepository: repositories.projectMember,
      billVersionRepository: repositories.billVersion,
    },
  );
  const billWorkItemService = new BillWorkItemService(
    repositories.billWorkItem,
    {
      billItemService,
      billItemRepository: repositories.billItem,
    },
  );
  const quotaLineService = new QuotaLineService(
    repositories.quotaLine,
    {
      billItemService,
      billItemRepository: repositories.billItem,
      billVersionService,
    },
  );
  const priceVersionService = new PriceVersionService(
    repositories.priceVersion,
  );
  const priceItemService = new PriceItemService(
    repositories.priceItem,
    {
      priceVersionRepository: repositories.priceVersion,
    },
  );
  const calculateService = new CalculateService({
    projectRepository: repositories.project,
    projectStageRepository: repositories.projectStage,
    projectDisciplineRepository: repositories.projectDiscipline,
    projectMemberRepository: repositories.projectMember,
    billItemRepository: repositories.billItem,
    billVersionRepository: repositories.billVersion,
    quotaLineRepository: repositories.quotaLine,
    priceVersionRepository: repositories.priceVersion,
    priceItemRepository: repositories.priceItem,
    feeTemplateRepository: repositories.feeTemplate,
    feeRuleRepository: repositories.feeRule,
    billVersionService,
  });
  const feeTemplateService = new FeeTemplateService(
    repositories.feeTemplate,
    repositories.feeRule,
  );
  const summaryService = new SummaryService({
    projectRepository: repositories.project,
    projectStageRepository: repositories.projectStage,
    projectDisciplineRepository: repositories.projectDiscipline,
    projectMemberRepository: repositories.projectMember,
    billVersionRepository: repositories.billVersion,
    billItemRepository: repositories.billItem,
  });
  const reportExportTaskService = new ReportExportTaskService(
    repositories.reportExportTask,
    repositories.project,
    summaryService,
    auditLogService,
  );
  const reviewSubmissionService = new ReviewSubmissionService(
    repositories.reviewSubmission,
    {
      projectRepository: repositories.project,
      projectStageRepository: repositories.projectStage,
      projectDisciplineRepository: repositories.projectDiscipline,
      projectMemberRepository: repositories.projectMember,
      billVersionRepository: repositories.billVersion,
    },
    auditLogService,
  );
  const processDocumentService = new ProcessDocumentService(
    repositories.processDocument,
    {
      projectRepository: repositories.project,
      projectStageRepository: repositories.projectStage,
      projectDisciplineRepository: repositories.projectDiscipline,
      projectMemberRepository: repositories.projectMember,
    },
    auditLogService,
  );

  app.setErrorHandler((error, _request, reply) => {
    if (isAppError(error)) {
      reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      });
      return;
    }

    if (error instanceof ZodError) {
      reply.status(422).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
      });
      return;
    }

    app.log.error(error);
    reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
      },
    });
  });

  app.decorateRequest("currentUser", undefined);

  app.get("/health", async () => ({
    ok: true,
  }));

  app.addHook("preHandler", async (request) => {
    if (!request.url.startsWith("/v1/")) {
      return;
    }

    const token = extractBearerToken(request.headers.authorization);
    request.currentUser = await verifyAccessToken(token, options.jwtSecret);
  });

  app.get("/v1/me", async (request) => {
    if (!request.currentUser) {
      throw new AppError(401, "UNAUTHENTICATED", "Missing authenticated user");
    }

    return request.currentUser;
  });

  app.get("/v1/projects", async (request) => {
    const pagination = normalizePagination(request.query);

    return transactionRunner.runInTransaction(async () => {
      const result = await projectService.listProjects(pagination);
      const normalizedPagination: PaginationEnvelope = result.pagination;

      return { items: result.items, pagination: normalizedPagination };
    });
  });

  app.get("/v1/projects/:projectId", async (request) => {
    const { projectId } = request.params as { projectId: string };

    return transactionRunner.runInTransaction(async () =>
      projectService.getProject(projectId),
    );
  });

  app.get("/v1/projects/:projectId/stages", async (request) => {
    const { projectId } = request.params as { projectId: string };

    return transactionRunner.runInTransaction(async () => ({
      items: await projectService.listProjectStages(projectId),
    }));
  });

  app.get("/v1/projects/:projectId/disciplines", async (request) => {
    const { projectId } = request.params as { projectId: string };

    return transactionRunner.runInTransaction(async () => ({
      items: await projectService.listProjectDisciplines(projectId),
    }));
  });

  app.get("/v1/projects/:projectId/members", async (request) => {
    const { projectId } = request.params as { projectId: string };

    return transactionRunner.runInTransaction(async () => ({
      items: await projectService.listProjectMembers(projectId),
    }));
  });

  app.get("/v1/projects/:projectId/audit-logs", async (request) => {
    const { projectId } = request.params as { projectId: string };
    const query = z
      .object({
        resourceType: z.string().min(1).optional(),
        resourceId: z.string().min(1).optional(),
        action: z.string().min(1).optional(),
        limit: z.coerce.number().int().positive().max(100).optional(),
      })
      .parse(request.query);

    return transactionRunner.runInTransaction(async () => ({
      items: await auditLogService.listAuditLogs({
        projectId,
        resourceType: query.resourceType,
        resourceId: query.resourceId,
        action: query.action,
        limit: query.limit,
      }),
    }));
  });

  app.get("/v1/projects/:projectId/process-documents", async (request) => {
    const { projectId } = request.params as { projectId: string };
    const query = z
      .object({
        stageCode: z.string().min(1).optional(),
        disciplineCode: z.string().min(1).optional(),
        documentType: z
          .enum(["change_order", "site_visa", "progress_payment"])
          .optional(),
      })
      .parse(request.query);

    return transactionRunner.runInTransaction(async () => ({
      items: await processDocumentService.listProcessDocuments({
        projectId,
        stageCode: query.stageCode,
        disciplineCode: query.disciplineCode,
        documentType: query.documentType,
        userId: request.currentUser!.id,
      }),
    }));
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

  app.put("/v1/projects/:projectId/default-pricing-config", async (request) => {
    const { projectId } = request.params as { projectId: string };
    const payload = updateProjectPricingDefaultsSchema.parse(request.body);

    return transactionRunner.runInTransaction(async () =>
      projectService.updateProjectPricingDefaults({
        projectId,
        userId: request.currentUser!.id,
        defaultPriceVersionId: payload.defaultPriceVersionId,
        defaultFeeTemplateId: payload.defaultFeeTemplateId,
      }),
    );
  });

  app.get("/v1/projects/:projectId/bill-versions", async (request) => {
    const { projectId } = request.params as { projectId: string };
    const query = billVersionContextSchema.parse(request.query);

    return transactionRunner.runInTransaction(async () => ({
      items: await billVersionService.listBillVersions({
        projectId,
        stageCode: query.stageCode,
        disciplineCode: query.disciplineCode,
        userId: request.currentUser!.id,
      }),
    }));
  });

  app.post("/v1/projects/:projectId/bill-versions", async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const payload = createBillVersionSchema.parse(request.body);

    const created = await transactionRunner.runInTransaction(async () =>
      billVersionService.createBillVersion({
        projectId,
        stageCode: payload.stageCode,
        disciplineCode: payload.disciplineCode,
        versionName: payload.versionName,
        userId: request.currentUser!.id,
      }),
    );

    reply.status(201);
    return created;
  });

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
        stageCode: z.string().min(1).optional(),
        disciplineCode: z.string().min(1).optional(),
        status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
      })
      .parse(request.query);

    return transactionRunner.runInTransaction(async () => ({
      items: await reviewSubmissionService.listReviewSubmissions({
        projectId,
        stageCode: query.stageCode,
        disciplineCode: query.disciplineCode,
        status: query.status,
        userId: request.currentUser!.id,
      }),
    }));
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

  app.post(
    "/v1/projects/:projectId/recalculate",
    async (request) => {
      const { projectId } = request.params as {
        projectId: string;
      };
      const payload = recalculateProjectSchema.parse(request.body ?? {});

      return transactionRunner.runInTransaction(async () =>
        calculateService.recalculateProject({
          projectId,
          stageCode: payload.stageCode,
          disciplineCode: payload.disciplineCode,
          priceVersionId: payload.priceVersionId,
          feeTemplateId: payload.feeTemplateId,
          userId: request.currentUser!.id,
        }),
      );
    },
  );

  app.post(
    "/v1/projects/:projectId/bill-versions/:billVersionId/recalculate",
    async (request) => {
      const { projectId, billVersionId } = request.params as {
        projectId: string;
        billVersionId: string;
      };
      const payload = recalculateBillVersionSchema.parse(request.body ?? {});

      return transactionRunner.runInTransaction(async () =>
        calculateService.recalculateBillVersion({
          projectId,
          billVersionId,
          priceVersionId: payload.priceVersionId,
          feeTemplateId: payload.feeTemplateId,
          userId: request.currentUser!.id,
        }),
      );
    },
  );

  app.post(
    "/v1/projects/:projectId/bill-versions/:billVersionId/copy-from",
    async (request, reply) => {
      const { projectId, billVersionId } = request.params as {
        projectId: string;
        billVersionId: string;
      };

      const created = await transactionRunner.runInTransaction(async () =>
        billVersionService.copyFromVersion({
          projectId,
          sourceBillVersionId: billVersionId,
          userId: request.currentUser!.id,
        }),
      );

      reply.status(201);
      return created;
    },
  );

  app.get(
    "/v1/projects/:projectId/bill-versions/:billVersionId/source-chain",
    async (request) => {
      const { projectId, billVersionId } = request.params as {
        projectId: string;
        billVersionId: string;
      };

      return transactionRunner.runInTransaction(async () => ({
        items: await billVersionService.getSourceChain({
          projectId,
          billVersionId,
          userId: request.currentUser!.id,
        }),
      }));
    },
  );

  app.get(
    "/v1/projects/:projectId/bill-versions/:billVersionId/validation-summary",
    async (request) => {
      const { projectId, billVersionId } = request.params as {
        projectId: string;
        billVersionId: string;
      };

      return transactionRunner.runInTransaction(async () =>
        billVersionService.getValidationSummary({
          projectId,
          billVersionId,
          userId: request.currentUser!.id,
        }),
      );
    },
  );

  app.post(
    "/v1/projects/:projectId/bill-versions/:billVersionId/submit",
    async (request) => {
      const { projectId, billVersionId } = request.params as {
        projectId: string;
        billVersionId: string;
      };

      return transactionRunner.runInTransaction(async () =>
        billVersionService.submitBillVersion({
          projectId,
          billVersionId,
          userId: request.currentUser!.id,
        }),
      );
    },
  );

  app.post(
    "/v1/projects/:projectId/bill-versions/:billVersionId/withdraw",
    async (request) => {
      const { projectId, billVersionId } = request.params as {
        projectId: string;
        billVersionId: string;
      };

      return transactionRunner.runInTransaction(async () =>
        billVersionService.withdrawBillVersion({
          projectId,
          billVersionId,
          userId: request.currentUser!.id,
        }),
      );
    },
  );

  app.get(
    "/v1/projects/:projectId/bill-versions/:billVersionId/items",
    async (request) => {
      const { projectId, billVersionId } = request.params as {
        projectId: string;
        billVersionId: string;
      };

      return transactionRunner.runInTransaction(async () => ({
        items: await billItemService.listBillItems({
          projectId,
          billVersionId,
          userId: request.currentUser!.id,
        }),
      }));
    },
  );

  app.post(
    "/v1/projects/:projectId/bill-versions/:billVersionId/items",
    async (request, reply) => {
      const { projectId, billVersionId } = request.params as {
        projectId: string;
        billVersionId: string;
      };
      const payload = createBillItemSchema.parse(request.body);

      const created = await transactionRunner.runInTransaction(async () =>
        billItemService.createBillItem({
          projectId,
          billVersionId,
          parentId: payload.parentId,
          itemCode: payload.itemCode,
          itemName: payload.itemName,
          quantity: payload.quantity,
          unit: payload.unit,
          sortNo: payload.sortNo,
          userId: request.currentUser!.id,
        }),
      );

      reply.status(201);
      return created;
    },
  );

  app.put(
    "/v1/projects/:projectId/bill-versions/:billVersionId/items/:itemId",
    async (request) => {
      const { projectId, billVersionId, itemId } = request.params as {
        projectId: string;
        billVersionId: string;
        itemId: string;
      };
      const payload = updateBillItemSchema.parse(request.body);

      return transactionRunner.runInTransaction(async () =>
        billItemService.updateBillItem({
          projectId,
          billVersionId,
          itemId,
          parentId: payload.parentId,
          itemCode: payload.itemCode,
          itemName: payload.itemName,
          quantity: payload.quantity,
          unit: payload.unit,
          sortNo: payload.sortNo,
          userId: request.currentUser!.id,
        }),
      );
    },
  );

  app.put(
    "/v1/projects/:projectId/bill-versions/:billVersionId/items/:itemId/manual-pricing",
    async (request) => {
      const { projectId, billVersionId, itemId } = request.params as {
        projectId: string;
        billVersionId: string;
        itemId: string;
      };
      const payload = updateBillItemManualPricingSchema.parse(request.body);

      return transactionRunner.runInTransaction(async () =>
        billItemService.updateBillItemManualPricing({
          projectId,
          billVersionId,
          itemId,
          manualUnitPrice: payload.manualUnitPrice,
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

  app.put(
    "/v1/projects/:projectId/quota-lines/:quotaLineId",
    async (request) => {
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
    },
  );

  app.get("/v1/price-versions", async (request) => {
    const query = listPriceVersionSchema.parse(request.query);

    return transactionRunner.runInTransaction(async () => ({
      items: await priceVersionService.listPriceVersions(query),
    }));
  });

  app.get("/v1/price-versions/:priceVersionId/items", async (request) => {
    const { priceVersionId } = request.params as { priceVersionId: string };
    const query = listPriceItemSchema.parse(request.query);

    return transactionRunner.runInTransaction(async () => ({
      items: await priceItemService.listPriceItems({
        priceVersionId,
        quotaCode: query.quotaCode,
      }),
    }));
  });

  app.post("/v1/engine/calculate", async (request) => {
    const payload = calculateEngineSchema.parse(request.body);

    return transactionRunner.runInTransaction(async () =>
      calculateService.calculate({
        billItemId: payload.billItemId,
        priceVersionId: payload.priceVersionId,
        feeTemplateId: payload.feeTemplateId,
        userId: request.currentUser!.id,
      }),
    );
  });

  app.get("/v1/reports/summary", async (request) => {
    const query = summaryQuerySchema.parse(request.query);

    return transactionRunner.runInTransaction(async () =>
      summaryService.getSummary({
        projectId: query.projectId,
        stageCode: query.stageCode,
        disciplineCode: query.disciplineCode,
        userId: request.currentUser!.id,
      }),
    );
  });

  app.get("/v1/reports/summary/details", async (request) => {
    const query = summaryDetailQuerySchema.parse(request.query);

    return transactionRunner.runInTransaction(async () =>
      summaryService.getSummaryDetails({
        projectId: query.projectId,
        stageCode: query.stageCode,
        disciplineCode: query.disciplineCode,
        limit: query.limit,
        userId: request.currentUser!.id,
      }),
    );
  });

  app.post("/v1/reports/export", async (request, reply) => {
    const payload = createReportExportTaskSchema.parse(request.body);

    const created = await transactionRunner.runInTransaction(async () =>
      reportExportTaskService.createReportExportTask({
        projectId: payload.projectId,
        reportType: payload.reportType,
        stageCode: payload.stageCode,
        disciplineCode: payload.disciplineCode,
        userId: request.currentUser!.id,
      }),
    );

    reply.status(202);
    return created;
  });

  app.get("/v1/reports/export/:taskId", async (request) => {
    const { taskId } = request.params as { taskId: string };

    return transactionRunner.runInTransaction(async () =>
      reportExportTaskService.getReportExportTask({
        taskId,
        userId: request.currentUser!.id,
      }),
    );
  });

  app.get("/v1/reports/export/:taskId/download", async (request, reply) => {
    const { taskId } = request.params as { taskId: string };

    const download = await transactionRunner.runInTransaction(async () =>
      reportExportTaskService.downloadReportExportTask({
        taskId,
        userId: request.currentUser!.id,
      }),
    );

    reply.header("content-type", download.contentType);
    reply.header(
      "content-disposition",
      `attachment; filename="${download.fileName}"`,
    );
    return download.content;
  });

  app.get("/v1/fee-templates", async (request) => {
    const query = listFeeTemplateSchema.parse(request.query);

    return transactionRunner.runInTransaction(async () => ({
      items: await feeTemplateService.listFeeTemplates(query),
    }));
  });

  app.get("/v1/fee-templates/:feeTemplateId", async (request) => {
    const { feeTemplateId } = request.params as { feeTemplateId: string };

    return transactionRunner.runInTransaction(async () =>
      feeTemplateService.getFeeTemplate(feeTemplateId),
    );
  });

  return app;
}
