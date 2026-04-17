import { AppError } from "../../shared/errors/app-error.js";
import type { BillItemRepository } from "../bill/bill-item-repository.js";
import type { BillVersionRepository } from "../bill/bill-version-repository.js";
import { ProjectAuthorizationService } from "../project/project-authorization-service.js";
import type { ProjectDisciplineRepository } from "../project/project-discipline-repository.js";
import type { ProjectMemberRepository } from "../project/project-member-repository.js";
import type { ProjectRepository } from "../project/project-repository.js";
import type { ProjectStageRepository } from "../project/project-stage-repository.js";

export type SummaryResult = {
  projectId: string;
  stageCode: string | null;
  disciplineCode: string | null;
  itemCount: number;
  totalSystemAmount: number;
  totalFinalAmount: number;
  varianceAmount: number;
  varianceRate: number;
};

export type SummaryDetailItem = {
  billVersionId: string;
  versionName: string;
  versionNo: number;
  stageCode: string;
  disciplineCode: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  systemAmount: number;
  finalAmount: number;
  varianceAmount: number;
  varianceRate: number;
};

export type SummaryDetailResult = {
  projectId: string;
  stageCode: string | null;
  disciplineCode: string | null;
  totalCount: number;
  items: SummaryDetailItem[];
};

type Dependencies = {
  projectRepository: ProjectRepository;
  projectStageRepository: ProjectStageRepository;
  projectDisciplineRepository: ProjectDisciplineRepository;
  projectMemberRepository: ProjectMemberRepository;
  billVersionRepository: BillVersionRepository;
  billItemRepository: BillItemRepository;
};

export class SummaryService {
  constructor(private readonly dependencies: Dependencies) {}

  async getSummary(input: {
    projectId: string;
    stageCode?: string;
    disciplineCode?: string;
    userId: string;
  }): Promise<SummaryResult> {
    const billVersions = await this.getAuthorizedBillVersions(input);
    const allItems = await this.listBillItemsForVersions(billVersions);

    const totalSystemAmount = Number(
      allItems
        .reduce((sum, item) => sum + (item.systemAmount ?? 0), 0)
        .toFixed(2),
    );
    const totalFinalAmount = Number(
      allItems
        .reduce((sum, item) => sum + (item.finalAmount ?? 0), 0)
        .toFixed(2),
    );
    const varianceAmount = Number((totalFinalAmount - totalSystemAmount).toFixed(2));
    const varianceRate =
      totalSystemAmount === 0
        ? 0
        : Number((varianceAmount / totalSystemAmount).toFixed(6));

    return {
      projectId: input.projectId,
      stageCode: input.stageCode ?? null,
      disciplineCode: input.disciplineCode ?? null,
      itemCount: allItems.length,
      totalSystemAmount,
      totalFinalAmount,
      varianceAmount,
      varianceRate,
    };
  }

  async getSummaryDetails(input: {
    projectId: string;
    stageCode?: string;
    disciplineCode?: string;
    limit?: number;
    userId: string;
  }): Promise<SummaryDetailResult> {
    const billVersions = await this.getAuthorizedBillVersions(input);
    const details = (
      await Promise.all(
        billVersions.map(async (billVersion) => {
          const items = await this.dependencies.billItemRepository.listByBillVersionId(
            billVersion.id,
          );
          return items.map((item) => {
            const systemAmount = Number((item.systemAmount ?? 0).toFixed(2));
            const finalAmount = Number((item.finalAmount ?? 0).toFixed(2));
            const varianceAmount = Number((finalAmount - systemAmount).toFixed(2));
            const varianceRate =
              systemAmount === 0
                ? 0
                : Number((varianceAmount / systemAmount).toFixed(6));

            return {
              billVersionId: billVersion.id,
              versionName: billVersion.versionName,
              versionNo: billVersion.versionNo,
              stageCode: billVersion.stageCode,
              disciplineCode: billVersion.disciplineCode,
              itemId: item.id,
              itemCode: item.itemCode,
              itemName: item.itemName,
              systemAmount,
              finalAmount,
              varianceAmount,
              varianceRate,
            };
          });
        }),
      )
    )
      .flat()
      .sort((left, right) => Math.abs(right.varianceAmount) - Math.abs(left.varianceAmount));

    return {
      projectId: input.projectId,
      stageCode: input.stageCode ?? null,
      disciplineCode: input.disciplineCode ?? null,
      totalCount: details.length,
      items: details.slice(0, input.limit ?? 20),
    };
  }

  private async getAuthorizedBillVersions(input: {
    projectId: string;
    stageCode?: string;
    disciplineCode?: string;
    userId: string;
  }) {
    const project = await this.dependencies.projectRepository.findById(input.projectId);
    if (!project) {
      throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
    }

    const authorizationService = new ProjectAuthorizationService({
      stages: await this.dependencies.projectStageRepository.listByProjectId(
        input.projectId,
      ),
      disciplines: await this.dependencies.projectDisciplineRepository.listByProjectId(
        input.projectId,
      ),
      members: await this.dependencies.projectMemberRepository.listByProjectId(
        input.projectId,
      ),
    });

    const authorized = authorizationService.canViewContext({
      projectId: input.projectId,
      stageCode: input.stageCode,
      disciplineCode: input.disciplineCode,
      userId: input.userId,
    });
    if (!authorized) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have permission to access this resource",
      );
    }

    return (await this.dependencies.billVersionRepository.listByProjectId(
      input.projectId,
    )).filter((billVersion) => {
      if (input.stageCode && billVersion.stageCode !== input.stageCode) {
        return false;
      }
      if (
        input.disciplineCode &&
        billVersion.disciplineCode !== input.disciplineCode
      ) {
        return false;
      }
      return true;
    });
  }

  private async listBillItemsForVersions(
    billVersions: Awaited<ReturnType<BillVersionRepository["listByProjectId"]>>,
  ) {
    return (
      await Promise.all(
        billVersions.map((billVersion) =>
          this.dependencies.billItemRepository.listByBillVersionId(billVersion.id),
        ),
      )
    ).flat();
  }
}
