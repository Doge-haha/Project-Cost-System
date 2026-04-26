import { AppError } from "../../shared/errors/app-error.js";
import {
  absoluteDecimal,
  divideDecimal,
  roundDecimal,
  subtractDecimal,
  sumDecimal,
} from "../../shared/math/decimal-money.js";
import type { BillItemRepository } from "../bill/bill-item-repository.js";
import type { BillVersionRepository } from "../bill/bill-version-repository.js";
import { ProjectAuthorizationService } from "../project/project-authorization-service.js";
import type { ProjectDisciplineRepository } from "../project/project-discipline-repository.js";
import type { ProjectMemberRepository } from "../project/project-member-repository.js";
import type { ProjectRepository } from "../project/project-repository.js";
import type { ProjectStageRepository } from "../project/project-stage-repository.js";

export type SummaryResult = {
  projectId: string;
  billVersionId: string | null;
  stageCode: string | null;
  disciplineCode: string | null;
  versionCount: number;
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
  varianceShare: number;
};

export type SummaryDetailResult = {
  projectId: string;
  billVersionId: string | null;
  stageCode: string | null;
  disciplineCode: string | null;
  totalCount: number;
  items: SummaryDetailItem[];
};

export type VersionCompareItem = {
  itemCode: string;
  itemNameBase: string | null;
  itemNameTarget: string | null;
  baseSystemAmount: number;
  targetSystemAmount: number;
  baseFinalAmount: number;
  targetFinalAmount: number;
  systemVarianceAmount: number;
  finalVarianceAmount: number;
};

export type VersionCompareResult = {
  projectId: string;
  baseBillVersionId: string;
  targetBillVersionId: string;
  baseVersionName: string;
  targetVersionName: string;
  itemCount: number;
  items: VersionCompareItem[];
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
    billVersionId?: string;
    stageCode?: string;
    disciplineCode?: string;
    userId: string;
  }): Promise<SummaryResult> {
    const billVersions = await this.getAuthorizedBillVersions(input);
    const allItems = await this.listBillItemsForVersions(billVersions);

    const totalSystemAmount = sumDecimal(
      allItems.map((item) => item.systemAmount ?? 0),
      2,
    );
    const totalFinalAmount = sumDecimal(
      allItems.map((item) => item.finalAmount ?? 0),
      2,
    );
    const varianceAmount = subtractDecimal(totalFinalAmount, totalSystemAmount, 2);
    const varianceRate = divideDecimal(varianceAmount, totalSystemAmount, 6);

    return {
      projectId: input.projectId,
      billVersionId: input.billVersionId ?? null,
      stageCode: input.stageCode ?? null,
      disciplineCode: input.disciplineCode ?? null,
      versionCount: billVersions.length,
      itemCount: allItems.length,
      totalSystemAmount,
      totalFinalAmount,
      varianceAmount,
      varianceRate,
    };
  }

  async getSummaryDetails(input: {
    projectId: string;
    billVersionId?: string;
    stageCode?: string;
    disciplineCode?: string;
    limit?: number;
    userId: string;
  }): Promise<SummaryDetailResult> {
    const billVersions = await this.getAuthorizedBillVersions(input);
    const allItems = await this.listBillItemsForVersions(billVersions);
    const totalVariance = sumDecimal(
      allItems.map((item) =>
        absoluteDecimal(
          subtractDecimal(item.finalAmount ?? 0, item.systemAmount ?? 0, 2),
          2,
        ),
      ),
      2,
    );

    const details = (
      await Promise.all(
        billVersions.map(async (billVersion) => {
          const items = await this.dependencies.billItemRepository.listByBillVersionId(
            billVersion.id,
          );
          return items.map((item) => {
            const systemAmount = roundDecimal(item.systemAmount ?? 0, 2);
            const finalAmount = roundDecimal(item.finalAmount ?? 0, 2);
            const varianceAmount = subtractDecimal(finalAmount, systemAmount, 2);
            const varianceRate = divideDecimal(varianceAmount, systemAmount, 6);
            const varianceShare = divideDecimal(
              absoluteDecimal(varianceAmount, 2),
              totalVariance,
              6,
            );

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
              varianceShare,
            };
          });
        }),
      )
    )
      .flat()
      .sort((left, right) => Math.abs(right.varianceAmount) - Math.abs(left.varianceAmount));

    return {
      projectId: input.projectId,
      billVersionId: input.billVersionId ?? null,
      stageCode: input.stageCode ?? null,
      disciplineCode: input.disciplineCode ?? null,
      totalCount: details.length,
      items: details.slice(0, input.limit ?? 20),
    };
  }

  async compareVersions(input: {
    projectId: string;
    baseBillVersionId: string;
    targetBillVersionId: string;
    userId: string;
  }): Promise<VersionCompareResult> {
    const [baseVersion, targetVersion] = await Promise.all([
      this.getAuthorizedBillVersion({
        projectId: input.projectId,
        billVersionId: input.baseBillVersionId,
        userId: input.userId,
      }),
      this.getAuthorizedBillVersion({
        projectId: input.projectId,
        billVersionId: input.targetBillVersionId,
        userId: input.userId,
      }),
    ]);

    const [baseItems, targetItems] = await Promise.all([
      this.dependencies.billItemRepository.listByBillVersionId(baseVersion.id),
      this.dependencies.billItemRepository.listByBillVersionId(targetVersion.id),
    ]);

    const baseByCode = new Map(baseItems.map((item) => [item.itemCode, item]));
    const targetByCode = new Map(targetItems.map((item) => [item.itemCode, item]));
    const allCodes = [...new Set([...baseByCode.keys(), ...targetByCode.keys()])].sort();

    const items = allCodes.map((itemCode) => {
      const baseItem = baseByCode.get(itemCode) ?? null;
      const targetItem = targetByCode.get(itemCode) ?? null;

      const baseSystemAmount = roundDecimal(baseItem?.systemAmount ?? 0, 2);
      const targetSystemAmount = roundDecimal(targetItem?.systemAmount ?? 0, 2);
      const baseFinalAmount = roundDecimal(baseItem?.finalAmount ?? 0, 2);
      const targetFinalAmount = roundDecimal(targetItem?.finalAmount ?? 0, 2);

      return {
        itemCode,
        itemNameBase: baseItem?.itemName ?? null,
        itemNameTarget: targetItem?.itemName ?? null,
        baseSystemAmount,
        targetSystemAmount,
        baseFinalAmount,
        targetFinalAmount,
        systemVarianceAmount: subtractDecimal(
          targetSystemAmount,
          baseSystemAmount,
          2,
        ),
        finalVarianceAmount: subtractDecimal(
          targetFinalAmount,
          baseFinalAmount,
          2,
        ),
      };
    });

    return {
      projectId: input.projectId,
      baseBillVersionId: baseVersion.id,
      targetBillVersionId: targetVersion.id,
      baseVersionName: baseVersion.versionName,
      targetVersionName: targetVersion.versionName,
      itemCount: items.length,
      items,
    };
  }

  private async getAuthorizedBillVersions(input: {
    projectId: string;
    billVersionId?: string;
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
      if (input.billVersionId && billVersion.id !== input.billVersionId) {
        return false;
      }
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

  private async getAuthorizedBillVersion(input: {
    projectId: string;
    billVersionId: string;
    userId: string;
  }) {
    const [project, billVersion] = await Promise.all([
      this.dependencies.projectRepository.findById(input.projectId),
      this.dependencies.billVersionRepository.findById(input.billVersionId),
    ]);

    if (!project) {
      throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
    }
    if (!billVersion || billVersion.projectId !== input.projectId) {
      throw new AppError(404, "BILL_VERSION_NOT_FOUND", "Bill version not found");
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

    if (
      !authorizationService.canViewContext({
        projectId: input.projectId,
        stageCode: billVersion.stageCode,
        disciplineCode: billVersion.disciplineCode,
        userId: input.userId,
      })
    ) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have permission to access this resource",
      );
    }

    return billVersion;
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
