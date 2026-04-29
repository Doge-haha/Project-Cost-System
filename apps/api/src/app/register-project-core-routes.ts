import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { AuthenticatedUser } from "../shared/auth/jwt.js";
import { AppError } from "../shared/errors/app-error.js";
import { normalizePagination, type PaginationEnvelope } from "../shared/http/pagination.js";
import type { TransactionRunner } from "../shared/tx/transaction.js";
import type { AuditLogService } from "../modules/audit/audit-log-service.js";
import type { ProjectService } from "../modules/project/project-service.js";

const updateProjectPricingDefaultsSchema = z.object({
  defaultPriceVersionId: z.string().min(1).nullable().optional(),
  defaultFeeTemplateId: z.string().min(1).nullable().optional(),
});

const updateProjectDefaultPriceVersionSchema = z.object({
  defaultPriceVersionId: z.string().min(1).nullable(),
});

const updateProjectDefaultFeeTemplateSchema = z.object({
  defaultFeeTemplateId: z.string().min(1).nullable(),
});

const updateProjectStatusSchema = z.object({
  status: z.enum(["draft", "active", "archived"]),
});

const projectStageSetupSchema = z.object({
  stageCode: z.string().min(1),
  stageName: z.string().min(1),
  status: z.enum(["draft", "active", "submitted", "approved", "locked"]).default("draft"),
  sequenceNo: z.coerce.number().int().positive(),
});

const createProjectSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  defaultPriceVersionId: z.string().min(1).nullable().optional(),
  defaultFeeTemplateId: z.string().min(1).nullable().optional(),
  stages: z.array(projectStageSetupSchema).min(1).optional(),
});

const updateProjectStagesSchema = z.object({
  stages: z.array(projectStageSetupSchema).min(1),
});

const projectDisciplineSetupSchema = z.object({
  disciplineCode: z.string().min(1),
  disciplineName: z.string().min(1),
  defaultStandardSetCode: z.string().min(1).nullable().optional(),
  status: z.enum(["enabled", "disabled"]).default("enabled"),
  sortOrder: z.coerce.number().int().nonnegative(),
});

const updateProjectDisciplinesSchema = z.object({
  disciplines: z.array(projectDisciplineSetupSchema).min(1),
});

const projectMemberScopeSchema = z.object({
  scopeType: z.enum(["project", "stage", "discipline", "unit"]),
  scopeValue: z.string().min(1),
});

const projectMemberSetupSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().min(1),
  roleCode: z.string().min(1),
  scopes: z.array(projectMemberScopeSchema),
});

const updateProjectMembersSchema = z.object({
  members: z.array(projectMemberSetupSchema).min(1),
});

function assertCanCreateProject(currentUser: AuthenticatedUser): void {
  const allowedRoles = new Set(["system_admin", "project_owner"]);
  if (currentUser.roleCodes.some((roleCode) => allowedRoles.has(roleCode))) {
    return;
  }

  throw new AppError(403, "FORBIDDEN", "Current user cannot create projects");
}

export function registerProjectCoreRoutes(
  app: FastifyInstance,
  input: {
    transactionRunner: TransactionRunner;
    projectService: ProjectService;
    auditLogService: AuditLogService;
  },
) {
  const { transactionRunner, projectService, auditLogService } = input;

  app.get("/v1/projects", async (request) => {
    const pagination = normalizePagination(request.query);

    return transactionRunner.runInTransaction(async () => {
      const result = await projectService.listProjects({
        ...pagination,
        userId: request.currentUser!.id,
        roleCodes: request.currentUser!.roleCodes,
      });
      const normalizedPagination: PaginationEnvelope = result.pagination;

      return { items: result.items, pagination: normalizedPagination };
    });
  });

  app.post("/v1/projects", async (request, reply) => {
    assertCanCreateProject(request.currentUser!);
    const payload = createProjectSchema.parse(request.body);

    const created = await transactionRunner.runInTransaction(async () =>
      projectService.createProject({
        code: payload.code,
        name: payload.name,
        defaultPriceVersionId: payload.defaultPriceVersionId,
        defaultFeeTemplateId: payload.defaultFeeTemplateId,
        stages: payload.stages,
        userId: request.currentUser!.id,
        userDisplayName: request.currentUser!.displayName,
      }),
    );

    reply.status(201);
    return created;
  });

  app.get("/v1/projects/:projectId", async (request) => {
    const { projectId } = request.params as { projectId: string };

    return transactionRunner.runInTransaction(async () =>
      projectService.getProject({
        projectId,
        userId: request.currentUser!.id,
        roleCodes: request.currentUser!.roleCodes,
      }),
    );
  });

  app.get("/v1/projects/:projectId/workspace", async (request) => {
    const { projectId } = request.params as { projectId: string };
    const query = z
      .object({
        stageCode: z.string().min(1).optional(),
      })
      .parse(request.query);

    return transactionRunner.runInTransaction(async () =>
      projectService.getProjectWorkspace({
        projectId,
        stageCode: query.stageCode,
        userId: request.currentUser!.id,
        userDisplayName: request.currentUser!.displayName,
        roleCodes: request.currentUser!.roleCodes,
      }),
    );
  });

  app.put("/v1/projects/:projectId/status", async (request) => {
    const { projectId } = request.params as { projectId: string };
    const payload = updateProjectStatusSchema.parse(request.body);

    return transactionRunner.runInTransaction(async () =>
      projectService.updateProjectStatus({
        projectId,
        userId: request.currentUser!.id,
        roleCodes: request.currentUser!.roleCodes,
        status: payload.status,
      }),
    );
  });

  app.get("/v1/projects/:projectId/stages", async (request) => {
    const { projectId } = request.params as { projectId: string };

    return transactionRunner.runInTransaction(async () => ({
      items: await projectService.listProjectStages({
        projectId,
        userId: request.currentUser!.id,
        roleCodes: request.currentUser!.roleCodes,
      }),
    }));
  });

  app.put("/v1/projects/:projectId/stages", async (request) => {
    const { projectId } = request.params as { projectId: string };
    const payload = updateProjectStagesSchema.parse(request.body);

    return transactionRunner.runInTransaction(async () => ({
      items: await projectService.updateProjectStages({
        projectId,
        userId: request.currentUser!.id,
        roleCodes: request.currentUser!.roleCodes,
        stages: payload.stages,
      }),
    }));
  });

  app.get("/v1/projects/:projectId/disciplines", async (request) => {
    const { projectId } = request.params as { projectId: string };

    return transactionRunner.runInTransaction(async () => ({
      items: await projectService.listProjectDisciplines({
        projectId,
        userId: request.currentUser!.id,
        roleCodes: request.currentUser!.roleCodes,
      }),
    }));
  });

  app.put("/v1/projects/:projectId/disciplines", async (request) => {
    const { projectId } = request.params as { projectId: string };
    const payload = updateProjectDisciplinesSchema.parse(request.body);

    return transactionRunner.runInTransaction(async () => ({
      items: await projectService.updateProjectDisciplines({
        projectId,
        userId: request.currentUser!.id,
        roleCodes: request.currentUser!.roleCodes,
        disciplines: payload.disciplines,
      }),
    }));
  });

  app.get("/v1/projects/:projectId/members", async (request) => {
    const { projectId } = request.params as { projectId: string };

    return transactionRunner.runInTransaction(async () => ({
      items: await projectService.listProjectMembers({
        projectId,
        userId: request.currentUser!.id,
        roleCodes: request.currentUser!.roleCodes,
      }),
    }));
  });

  app.put("/v1/projects/:projectId/members", async (request) => {
    const { projectId } = request.params as { projectId: string };
    const payload = updateProjectMembersSchema.parse(request.body);

    return transactionRunner.runInTransaction(async () => ({
      items: await projectService.updateProjectMembers({
        projectId,
        userId: request.currentUser!.id,
        roleCodes: request.currentUser!.roleCodes,
        members: payload.members,
      }),
    }));
  });

  app.get("/v1/projects/:projectId/audit-logs", async (request) => {
    const { projectId } = request.params as { projectId: string };
    const query = z
      .object({
        resourceType: z.string().min(1).optional(),
        resourceId: z.string().min(1).optional(),
        resourceIdPrefix: z.string().min(1).optional(),
        action: z.string().min(1).optional(),
        operatorId: z.string().min(1).optional(),
        createdFrom: z.string().datetime().optional(),
        createdTo: z.string().datetime().optional(),
        limit: z.coerce.number().int().positive().max(100).optional(),
      })
      .parse(request.query);

    return transactionRunner.runInTransaction(async () => ({
      items: await auditLogService.listAuditLogs({
        projectId,
        resourceType: query.resourceType,
        resourceId: query.resourceId,
        resourceIdPrefix: query.resourceIdPrefix,
        action: query.action,
        operatorId: query.operatorId,
        createdFrom: query.createdFrom,
        createdTo: query.createdTo,
        limit: query.limit,
        userId: request.currentUser!.id,
      }),
    }));
  });

  app.put("/v1/projects/:projectId/default-pricing-config", async (request) => {
    const { projectId } = request.params as { projectId: string };
    const payload = updateProjectPricingDefaultsSchema.parse(request.body);

    return transactionRunner.runInTransaction(async () =>
      projectService.updateProjectPricingDefaults({
        projectId,
        userId: request.currentUser!.id,
        roleCodes: request.currentUser!.roleCodes,
        defaultPriceVersionId: payload.defaultPriceVersionId,
        defaultFeeTemplateId: payload.defaultFeeTemplateId,
      }),
    );
  });

  app.put("/v1/projects/:projectId/default-price-version", async (request) => {
    const { projectId } = request.params as { projectId: string };
    const payload = updateProjectDefaultPriceVersionSchema.parse(request.body);

    return transactionRunner.runInTransaction(async () =>
      projectService.updateProjectPricingDefaults({
        projectId,
        userId: request.currentUser!.id,
        roleCodes: request.currentUser!.roleCodes,
        defaultPriceVersionId: payload.defaultPriceVersionId,
      }),
    );
  });

  app.put("/v1/projects/:projectId/default-fee-template", async (request) => {
    const { projectId } = request.params as { projectId: string };
    const payload = updateProjectDefaultFeeTemplateSchema.parse(request.body);

    return transactionRunner.runInTransaction(async () =>
      projectService.updateProjectPricingDefaults({
        projectId,
        userId: request.currentUser!.id,
        roleCodes: request.currentUser!.roleCodes,
        defaultFeeTemplateId: payload.defaultFeeTemplateId,
      }),
    );
  });
}
