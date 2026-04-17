import { z } from "zod";

import { AppError } from "../../shared/errors/app-error.js";
import { ProjectAuthorizationService } from "../project/project-authorization-service.js";
import type { ProjectDisciplineRepository } from "../project/project-discipline-repository.js";
import type { ProjectMemberRepository } from "../project/project-member-repository.js";
import type { ProjectRepository } from "../project/project-repository.js";
import type { ProjectStageRepository } from "../project/project-stage-repository.js";
import type { BillVersionRepository } from "../bill/bill-version-repository.js";
import type {
  ReviewSubmissionRecord,
  ReviewSubmissionRepository,
} from "./review-submission-repository.js";

export const submitReviewSchema = z.object({
  comment: z.string().max(500).optional(),
});

export const approveReviewSchema = z.object({
  comment: z.string().max(500).optional(),
});

export const rejectReviewSchema = z.object({
  reason: z.string().min(1).max(500),
  comment: z.string().max(500).optional(),
});

type Dependencies = {
  projectRepository: ProjectRepository;
  projectStageRepository: ProjectStageRepository;
  projectDisciplineRepository: ProjectDisciplineRepository;
  projectMemberRepository: ProjectMemberRepository;
  billVersionRepository: BillVersionRepository;
};

const REVIEWER_ROLES = new Set(["reviewer", "project_owner", "system_admin"]);

export class ReviewSubmissionService {
  constructor(
    private readonly reviewSubmissionRepository: ReviewSubmissionRepository,
    private readonly dependencies: Dependencies,
  ) {}

  async listReviewSubmissions(input: {
    projectId: string;
    stageCode?: string;
    disciplineCode?: string;
    userId: string;
  }): Promise<ReviewSubmissionRecord[]> {
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
      await this.reviewSubmissionRepository.listByProjectId(input.projectId)
    ).filter((submission) => {
      if (input.stageCode && submission.stageCode !== input.stageCode) {
        return false;
      }
      if (
        input.disciplineCode &&
        submission.disciplineCode !== input.disciplineCode
      ) {
        return false;
      }
      return authorizationService.canViewContext({
        projectId: input.projectId,
        stageCode: submission.stageCode,
        disciplineCode: submission.disciplineCode,
        userId: input.userId,
      });
    });
  }

  async submitReview(input: {
    projectId: string;
    billVersionId: string;
    comment?: string;
    userId: string;
  }): Promise<ReviewSubmissionRecord> {
    const version = await this.getAuthorizedBillVersion(input, "edit");
    if (version.versionStatus !== "submitted") {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "Only submitted bill versions can enter review",
      );
    }

    const existingPending =
      await this.reviewSubmissionRepository.findPendingByBillVersionId(version.id);
    if (existingPending) {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "A pending review already exists for this bill version",
      );
    }

    return this.reviewSubmissionRepository.create({
      projectId: input.projectId,
      billVersionId: version.id,
      stageCode: version.stageCode,
      disciplineCode: version.disciplineCode,
      status: "pending",
      submittedBy: input.userId,
      submittedAt: new Date().toISOString(),
      submissionComment: input.comment ?? null,
      reviewedBy: null,
      reviewedAt: null,
      reviewComment: null,
      rejectionReason: null,
    });
  }

  async approveReview(input: {
    projectId: string;
    reviewSubmissionId: string;
    comment?: string;
    userId: string;
  }): Promise<ReviewSubmissionRecord> {
    const submission = await this.getAuthorizedReviewSubmission(input);
    if (submission.status !== "pending") {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "Only pending reviews can be approved",
      );
    }

    await this.dependencies.billVersionRepository.updateStatus({
      versionId: submission.billVersionId,
      versionStatus: "locked",
    });

    return this.reviewSubmissionRepository.updateDecision({
      reviewSubmissionId: submission.id,
      status: "approved",
      reviewedBy: input.userId,
      reviewedAt: new Date().toISOString(),
      reviewComment: input.comment ?? null,
      rejectionReason: null,
    });
  }

  async rejectReview(input: {
    projectId: string;
    reviewSubmissionId: string;
    reason: string;
    comment?: string;
    userId: string;
  }): Promise<ReviewSubmissionRecord> {
    const submission = await this.getAuthorizedReviewSubmission(input);
    if (submission.status !== "pending") {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "Only pending reviews can be rejected",
      );
    }

    await this.dependencies.billVersionRepository.updateStatus({
      versionId: submission.billVersionId,
      versionStatus: "editable",
    });

    return this.reviewSubmissionRepository.updateDecision({
      reviewSubmissionId: submission.id,
      status: "rejected",
      reviewedBy: input.userId,
      reviewedAt: new Date().toISOString(),
      reviewComment: input.comment ?? null,
      rejectionReason: input.reason,
    });
  }

  private async getAuthorizedBillVersion(
    input: {
      projectId: string;
      billVersionId: string;
      userId: string;
    },
    action: "view" | "edit",
  ) {
    await this.assertProjectExists(input.projectId);
    const version = await this.dependencies.billVersionRepository.findById(
      input.billVersionId,
    );
    if (!version || version.projectId !== input.projectId) {
      throw new AppError(404, "BILL_VERSION_NOT_FOUND", "Bill version not found");
    }

    const authorizationService = await this.createAuthorizationService(
      input.projectId,
    );
    const authorized =
      action === "view"
        ? authorizationService.canViewContext({
            projectId: input.projectId,
            stageCode: version.stageCode,
            disciplineCode: version.disciplineCode,
            userId: input.userId,
          })
        : authorizationService.canEditContext({
            projectId: input.projectId,
            stageCode: version.stageCode,
            disciplineCode: version.disciplineCode,
            userId: input.userId,
          });

    if (!authorized) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have permission to access this resource",
      );
    }

    return version;
  }

  private async getAuthorizedReviewSubmission(input: {
    projectId: string;
    reviewSubmissionId: string;
    userId: string;
  }): Promise<ReviewSubmissionRecord> {
    await this.assertProjectExists(input.projectId);
    const submission = await this.reviewSubmissionRepository.findById(
      input.reviewSubmissionId,
    );
    if (!submission || submission.projectId !== input.projectId) {
      throw new AppError(
        404,
        "REVIEW_SUBMISSION_NOT_FOUND",
        "Review submission not found",
      );
    }

    const members = await this.dependencies.projectMemberRepository.listByProjectId(
      input.projectId,
    );
    const member = members.find(
      (candidate) => candidate.userId === input.userId,
    );
    const authorizationService = await this.createAuthorizationService(
      input.projectId,
    );

    if (
      !member ||
      !REVIEWER_ROLES.has(member.roleCode) ||
      !authorizationService.canViewContext({
        projectId: input.projectId,
        stageCode: submission.stageCode,
        disciplineCode: submission.disciplineCode,
        userId: input.userId,
      })
    ) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have permission to review this resource",
      );
    }

    return submission;
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
