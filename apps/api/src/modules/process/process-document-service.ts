import { z } from "zod";

import { requireDependency } from "../../shared/dependency/require-dependency.js";
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

export const updateProcessDocumentSchema = z.object({
  title: z.string().min(1),
  referenceNo: z.string().min(1),
  amount: z.number().nonnegative(),
  comment: z.string().max(500).optional(),
});

type Dependencies = {
  projectRepository: ProjectRepository;
  projectStageRepository: ProjectStageRepository;
  projectDisciplineRepository: ProjectDisciplineRepository;
  projectMemberRepository: ProjectMemberRepository;
};

const REVIEWER_ROLES = new Set(["reviewer", "project_owner", "system_admin"]);
const PROCESS_DOCUMENT_STATUS_PRIORITY: Record<
  ProcessDocumentRecord["status"],
  number
> = {
  submitted: 0,
  draft: 1,
  rejected: 2,
  approved: 3,
};

export class ProcessDocumentService {
  private readonly auditLogService: AuditLogService;

  constructor(
    private readonly processDocumentRepository: ProcessDocumentRepository,
    private readonly dependencies: Dependencies,
    auditLogService?: AuditLogService,
  ) {
    this.auditLogService = requireDependency(
      auditLogService,
      "auditLogService",
    );
  }

  async listProcessDocuments(input: {
    projectId: string;
    stageCode?: string;
    disciplineCode?: string;
    documentType?: ProcessDocumentRecord["documentType"];
    status?: ProcessDocumentRecord["status"];
    userId: string;
  }): Promise<{
    items: Array<
      ProcessDocumentRecord & {
        stageName: string;
        disciplineName: string;
        isEditable: boolean;
        isReviewable: boolean;
      }
    >;
    summary: {
      totalCount: number;
      statusCounts: Record<ProcessDocumentRecord["status"], number>;
      documentTypeCounts: Record<ProcessDocumentRecord["documentType"], number>;
    };
  }> {
    await this.assertProjectExists(input.projectId);
    const [stages, disciplines, members] = await Promise.all([
      this.dependencies.projectStageRepository.listByProjectId(input.projectId),
      this.dependencies.projectDisciplineRepository.listByProjectId(input.projectId),
      this.dependencies.projectMemberRepository.listByProjectId(input.projectId),
    ]);
    const authorizationService = await this.createAuthorizationService(
      input.projectId,
    );
    const stageByCode = new Map(stages.map((stage) => [stage.stageCode, stage]));
    const disciplineByCode = new Map(
      disciplines.map((discipline) => [discipline.disciplineCode, discipline]),
    );
    const currentMember = members.find((member) => member.userId === input.userId) ?? null;
    const canReviewRole =
      currentMember != null && REVIEWER_ROLES.has(currentMember.roleCode);

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

    const items = (
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
      if (input.status && document.status !== input.status) {
        return false;
      }
      return authorizationService.canViewContext({
        projectId: input.projectId,
        stageCode: document.stageCode,
        disciplineCode: document.disciplineCode,
        userId: input.userId,
      });
    }).map((document) => ({
      ...document,
      stageName: stageByCode.get(document.stageCode)?.stageName ?? document.stageCode,
      disciplineName:
        disciplineByCode.get(document.disciplineCode)?.disciplineName ??
        document.disciplineCode,
      isEditable:
        document.status === "draft" &&
        authorizationService.canEditContext({
          projectId: input.projectId,
          stageCode: document.stageCode,
          disciplineCode: document.disciplineCode,
          userId: input.userId,
        }),
      isReviewable:
        document.status === "submitted" &&
        canReviewRole &&
        document.submittedBy !== input.userId &&
        authorizationService.canViewContext({
          projectId: input.projectId,
          stageCode: document.stageCode,
          disciplineCode: document.disciplineCode,
          userId: input.userId,
        }),
    })).sort((left, right) => {
      const statusDifference =
        PROCESS_DOCUMENT_STATUS_PRIORITY[left.status] -
        PROCESS_DOCUMENT_STATUS_PRIORITY[right.status];
      if (statusDifference !== 0) {
        return statusDifference;
      }

      const timeDifference = right.submittedAt.localeCompare(left.submittedAt);
      if (timeDifference !== 0) {
        return timeDifference;
      }

      return right.id.localeCompare(left.id);
    });

    return {
      items,
      summary: {
        totalCount: items.length,
        statusCounts: {
          draft: items.filter((item) => item.status === "draft").length,
          submitted: items.filter((item) => item.status === "submitted").length,
          approved: items.filter((item) => item.status === "approved").length,
          rejected: items.filter((item) => item.status === "rejected").length,
        },
        documentTypeCounts: {
          change_order: items.filter((item) => item.documentType === "change_order")
            .length,
          site_visa: items.filter((item) => item.documentType === "site_visa").length,
          progress_payment: items.filter(
            (item) => item.documentType === "progress_payment",
          ).length,
        },
      },
    };
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

    await this.auditLogService.writeAuditLog({
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
      const existingSubmittedDocuments =
        await this.processDocumentRepository.listByProjectId(input.projectId);
      const duplicateSubmittedDocument = existingSubmittedDocuments.find(
        (candidate) =>
          candidate.id !== document.id &&
          candidate.status === "submitted" &&
          candidate.stageCode === document.stageCode &&
          candidate.disciplineCode === document.disciplineCode &&
          candidate.documentType === document.documentType &&
          candidate.referenceNo === document.referenceNo,
      );
      if (duplicateSubmittedDocument) {
        throw new AppError(
          422,
          "VALIDATION_ERROR",
          "A submitted process document already exists for this reference",
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

    await this.auditLogService.writeAuditLog({
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

  async updateProcessDocument(input: {
    projectId: string;
    documentId: string;
    title: string;
    referenceNo: string;
    amount: number;
    comment?: string;
    userId: string;
  }): Promise<ProcessDocumentRecord> {
    const document = await this.getAuthorizedDocument(input.projectId, input.documentId);
    const beforeDocument = {
      title: document.title,
      referenceNo: document.referenceNo,
      amount: document.amount,
      comment: document.lastComment ?? null,
    };
    if (document.status !== "draft") {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "Only draft process documents can be updated",
      );
    }

    const authorizationService = await this.createAuthorizationService(
      input.projectId,
    );
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

    const updated = await this.processDocumentRepository.update(input.documentId, {
      title: input.title,
      referenceNo: input.referenceNo,
      amount: input.amount,
      lastComment: input.comment ?? null,
    });

    await this.auditLogService.writeAuditLog({
      projectId: input.projectId,
      stageCode: document.stageCode,
      resourceType: "process_document",
      resourceId: document.id,
      action: "update",
      operatorId: input.userId,
      beforePayload: beforeDocument,
      afterPayload: {
        title: updated.title,
        referenceNo: updated.referenceNo,
        amount: updated.amount,
        comment: updated.lastComment ?? null,
      },
    });

    return updated;
  }

  async deleteProcessDocument(input: {
    projectId: string;
    documentId: string;
    userId: string;
  }): Promise<void> {
    const document = await this.getAuthorizedDocument(input.projectId, input.documentId);
    if (document.status !== "draft") {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "Only draft process documents can be deleted",
      );
    }

    const authorizationService = await this.createAuthorizationService(
      input.projectId,
    );
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

    await this.processDocumentRepository.delete(document.id);

    await this.auditLogService.writeAuditLog({
      projectId: input.projectId,
      stageCode: document.stageCode,
      resourceType: "process_document",
      resourceId: document.id,
      action: "delete",
      operatorId: input.userId,
      beforePayload: {
        documentType: document.documentType,
        status: document.status,
        amount: document.amount,
      },
    });
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
