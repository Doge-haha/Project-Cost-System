import { AppError } from "../../shared/errors/app-error.js";
import type { PaginationEnvelope } from "../../shared/http/pagination.js";
import type { ProjectRepository, ProjectRecord } from "./project-repository.js";
import type {
  ProjectStageRecord,
  ProjectStageRepository,
} from "./project-stage-repository.js";
import type {
  ProjectDisciplineRecord,
  ProjectDisciplineRepository,
} from "./project-discipline-repository.js";
import type {
  ProjectMemberRecord,
  ProjectMemberRepository,
} from "./project-member-repository.js";
import { ProjectAuthorizationService } from "./project-authorization-service.js";
import type { PriceVersionRepository } from "../pricing/price-version-repository.js";
import type { FeeTemplateRepository } from "../fee/fee-template-repository.js";

export class ProjectService {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly projectStageRepository: ProjectStageRepository,
    private readonly projectDisciplineRepository: ProjectDisciplineRepository,
    private readonly projectMemberRepository: ProjectMemberRepository,
    private readonly priceVersionRepository?: PriceVersionRepository,
    private readonly feeTemplateRepository?: FeeTemplateRepository,
  ) {}

  async listProjects(input: {
    page: number;
    pageSize: number;
  }): Promise<{
    items: ProjectRecord[];
    pagination: PaginationEnvelope;
  }> {
    const result = await this.projectRepository.listPage(input);

    return {
      items: result.items,
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        total: result.total,
      },
    };
  }

  async getProject(projectId: string): Promise<ProjectRecord> {
    const project = await this.projectRepository.findById(projectId);

    if (!project) {
      throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
    }

    return project;
  }

  async listProjectStages(projectId: string): Promise<ProjectStageRecord[]> {
    await this.getProject(projectId);
    return this.projectStageRepository.listByProjectId(projectId);
  }

  async listProjectDisciplines(
    projectId: string,
  ): Promise<ProjectDisciplineRecord[]> {
    await this.getProject(projectId);
    return this.projectDisciplineRepository.listByProjectId(projectId);
  }

  async listProjectMembers(projectId: string): Promise<ProjectMemberRecord[]> {
    await this.getProject(projectId);
    return this.projectMemberRepository.listByProjectId(projectId);
  }

  async updateProjectPricingDefaults(input: {
    projectId: string;
    userId: string;
    defaultPriceVersionId?: string | null;
    defaultFeeTemplateId?: string | null;
  }): Promise<ProjectRecord> {
    await this.assertCanManageProject(input.projectId, input.userId);
    await this.validatePricingDefaults({
      defaultPriceVersionId: input.defaultPriceVersionId,
      defaultFeeTemplateId: input.defaultFeeTemplateId,
    });

    return this.projectRepository.updateDefaults(input.projectId, {
      defaultPriceVersionId: input.defaultPriceVersionId,
      defaultFeeTemplateId: input.defaultFeeTemplateId,
    });
  }

  private async assertCanManageProject(
    projectId: string,
    userId: string,
  ): Promise<void> {
    await this.getProject(projectId);
    const authorizationService = new ProjectAuthorizationService({
      stages: await this.projectStageRepository.listByProjectId(projectId),
      disciplines: await this.projectDisciplineRepository.listByProjectId(projectId),
      members: await this.projectMemberRepository.listByProjectId(projectId),
    });

    if (!authorizationService.canManageProject({ projectId, userId })) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have permission to manage this project",
      );
    }
  }

  private async validatePricingDefaults(input: {
    defaultPriceVersionId?: string | null;
    defaultFeeTemplateId?: string | null;
  }): Promise<void> {
    if (input.defaultPriceVersionId) {
      if (!this.priceVersionRepository) {
        throw new AppError(
          500,
          "INTERNAL_ERROR",
          "Price version repository is not configured",
        );
      }
      const priceVersions = await this.priceVersionRepository.list({});
      const exists = priceVersions.some(
        (priceVersion) => priceVersion.id === input.defaultPriceVersionId,
      );
      if (!exists) {
        throw new AppError(
          404,
          "PRICE_VERSION_NOT_FOUND",
          "Price version not found",
        );
      }
    }

    if (input.defaultFeeTemplateId) {
      if (!this.feeTemplateRepository) {
        throw new AppError(
          500,
          "INTERNAL_ERROR",
          "Fee template repository is not configured",
        );
      }
      const feeTemplate = await this.feeTemplateRepository.findById(
        input.defaultFeeTemplateId,
      );
      if (!feeTemplate) {
        throw new AppError(
          404,
          "FEE_TEMPLATE_NOT_FOUND",
          "Fee template not found",
        );
      }
    }
  }
}
