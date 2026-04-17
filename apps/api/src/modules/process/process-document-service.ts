import { z } from "zod";

import { AppError } from "../../shared/errors/app-error.js";
import { ProjectAuthorizationService } from "../project/project-authorization-service.js";
import type { ProjectDisciplineRepository } from "../project/project-discipline-repository.js";
import type { ProjectMemberRepository } from "../project/project-member-repository.js";
import type { ProjectRepository } from "../project/project-repository.js";
import type { ProjectStageRepository } from "../project/project-stage-repository.js";
import type { AuditLogService } from "../audit/audit-log-service.js";
import type {
  ProcessDocumentRecord,
  ProcessDocumentRepository,
} from "./process-document-repository.js";

export const createProcessDocumentSchema = z.object({
  stageCode: z.string().min(1),
  disciplineCode: z.string().min(1),
  documentType: z.enum(["change_order", "site_visa", "progress_payment"]),
  title: z.string().min(1),
  referenceNo: z.string().min(1),
  amount: z.number().nonnegative(),
  comment: z.string().max(500).optional(),
});

export const updateProcessDocumentStatusSchema = z.object({
  status: z.enum(["submitted", "approved", "rejected"]),
  comment: z.string().max(500).optional(),
});

type Dependencies = {
  projectRepository: ProjectRepository;
  projectStageRepository: ProjectStageRepository;
  projectDisciplineRepository: ProjectDisciplineRepository;
  projectMemberRepository: ProjectMemberRepository;
};

const REVIEWER_ROLES = new Set(["reviewer", "project_owner", "system_admin"]);

export class ProcessDocumentService {
  constructor(
    private readonly processDocumentRepository: ProcessDocumentRepository,
    private readonly dependencies: Dependencies,
    private readonly auditLogService?: AuditLogService,
  ) {}

  async listProcessDocuments(input: {
    projectId: string;
    stageCode?: string;
    disciplineCode?: string;
    documentType?: ProcessDocumentRecord["documentType"];
    userId: string;
  }): Promise<ProcessDocumentRecord[]> {
    await this.assertProjectExists(input.projectId);
    const authorizationService = await this.createAuthorizationService(
      input.projectId,
    );

    if (
      !authorizationService.canViewContext({
        projectId: input.projectId,
        stageCode: input.stageCode,
        disciplineCode: input.disciplineCode,
        userId: input.userId,
      })
    ) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have permission to access this resource",
      );
    }

    return (
      await this.processDocumentRepository.listByProjectId(input.projectId)
    ).filter((document) => {
      if (input.stageCode && document.stageCode !== input.stageCode) {
        return false;
      }
      if (
        input.disciplineCode &&
        document.disciplineCode !== input.disciplineCode
      ) {
        return false;
      }
      if (input.documentType && document.documentType !== input.documentType) {
        return false;
      }
      return authorizationService.canViewContext({
        projectId: input.projectId,
        stageCode: document.stageCode,
        disciplineCode: document.disciplineCode,
        userId: input.userId,
      });
    });
  }

  async createProcessDocument(input: {
    projectId: string;
    stageCode: string;
    disciplineCode: string;
    documentType: ProcessDocumentRecord["documentType"];
    title: string;
    referenceNo: string;
    amount: number;
    comment?: string;
    userId: string;
  }): Promise<ProcessDocumentRecord> {
    await this.assertProjectExists(input.projectId);
    const authorizationService = await this.createAuthorizationService(
      input.projectId,
    );

    if (
      !authorizationService.canEditContext({
        projectId: input.projectId,
        stageCode: input.stageCode,
        disciplineCode: input.disciplineCode,
        userId: input.userId,
      })
    ) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have permission to edit this resource",
      );
    }

    const created = await this.processDocumentRepository.create({
      projectId: input.projectId,
      stageCode: input.stageCode,
      disciplineCode: input.disciplineCode,
      documentType: input.documentType,
      status: "draft",
      title: input.title,
      referenceNo: input.referenceNo,
      amount: input.amount,
      submittedBy: input.userId,
      submittedAt: new Date().toISOString(),
      lastComment: input.comment ?? null,
    });

    await this.auditLogService?.writeAuditLog({
      projectId: input.projectId,
      stageCode: input.stageCode,
      resourceType: "process_document",
      resourceId: created.id,
      action: "create",
      operatorId: input.userId,
      afterPayload: {
        documentType: created.documentType,
        status: created.status,
        amount: created.amount,
      },
    });

    return created;
  }

  async updateProcessDocumentStatus(input: {
    projectId: string;
    documentId: string;
    status: "submitted" | "approved" | "rejected";
    comment?: string;
    userId: string;
  }): Promise<ProcessDocumentRecord> {
    const document = await this.getAuthorizedDocument(input.projectId, input.documentId);

    const authorizationService = await this.createAuthorizationService(
      input.projectId,
    );

    if (input.status === "submitted") {
      if (document.status !== "draft") {
        throw new AppError(
          422,
          "VALIDATION_ERROR",
          "Only draft process documents can be submitted",
        );
      }
      if (
        !authorizationService.canEditContext({
          projectId: input.projectId,
          stageCode: document.stageCode,
          disciplineCode: document.disciplineCode,
          userId: input.userId,
        })
      ) {
        throw new AppError(
          403,
          "FORBIDDEN",
          "You do not have permission to edit this resource",
        );
      }
    } else {
      if (document.status !== "submitted") {
        throw new AppError(
          422,
          "VALIDATION_ERROR",
          "Only submitted process documents can be reviewed",
        );
      }
      const members = await this.dependencies.projectMemberRepository.listByProjectId(
        input.projectId,
      );
      const member = members.find((candidate) => candidate.userId === input.userId);
      if (
        !member ||
        !REVIEWER_ROLES.has(member.roleCode) ||
        !authorizationService.canViewContext({
          projectId: input.projectId,
          stageCode: document.stageCode,
          disciplineCode: document.disciplineCode,
          userId: input.userId,
        })
      ) {
        throw new AppError(
          403,
          "FORBIDDEN",
          "You do not have permission to review this resource",
        );
      }
      if (document.submittedBy === input.userId) {
        throw new AppError(
          422,
          "VALIDATION_ERROR",
          "Reviewer cannot review a process document they submitted",
        );
      }
    }

    const beforeStatus = document.status;
    const updated = await this.processDocumentRepository.updateStatus({
      documentId: input.documentId,
      status: input.status,
      lastComment: input.comment,
    });

    await this.auditLogService?.writeAuditLog({
      projectId: input.projectId,
      stageCode: document.stageCode,
      resourceType: "process_document",
      resourceId: document.id,
      action: input.status,
      operatorId: input.userId,
      beforePayload: { status: beforeStatus },
      afterPayload: { status: updated.status, comment: updated.lastComment ?? null },
    });

    return updated;
  }

  private async getAuthorizedDocument(projectId: string, documentId: string) {
    await this.assertProjectExists(projectId);
    const document = await this.processDocumentRepository.findById(documentId);
    if (!document || document.projectId !== projectId) {
      throw new AppError(
        404,
        "PROCESS_DOCUMENT_NOT_FOUND",
        "Process document not found",
      );
    }
    return document;
  }

  private async createAuthorizationService(projectId: string) {
    return new ProjectAuthorizationService({
      stages: await this.dependencies.projectStageRepository.listByProjectId(
        projectId,
      ),
      disciplines: await this.dependencies.projectDisciplineRepository.listByProjectId(
        projectId,
      ),
      members: await this.dependencies.projectMemberRepository.listByProjectId(
        projectId,
      ),
    });
  }

  private async assertProjectExists(projectId: string): Promise<void> {
    const project = await this.dependencies.projectRepository.findById(projectId);
    if (!project) {
      throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
    }
  }
}
