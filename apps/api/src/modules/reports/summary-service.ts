import { AppError } from "../../shared/errors/app-error.js";
import {
  absoluteDecimal,
  divideDecimal,
  multiplyDecimal,
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
import type { FeeRuleRepository } from "../fee/fee-rule-repository.js";
import type { FeeTemplateRepository } from "../fee/fee-template-repository.js";

type SummaryTaxMode = "tax_included" | "tax_excluded";
type VarianceBreakdownGroupBy = "discipline" | "unit";

export type SummaryResult = {
  projectId: string;
  billVersionId: string | null;
  stageCode: string | null;
  disciplineCode: string | null;
  unitCode: string | null;
  versionCount: number;
  itemCount: number;
  totalSystemAmount: number;
  totalFinalAmount: number;
  varianceAmount: number;
  varianceRate: number;
  taxMode?: SummaryTaxMode;
  totalTaxAmount?: number;
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
  taxAmount?: number;
};

export type SummaryDetailResult = {
  projectId: string;
  billVersionId: string | null;
  stageCode: string | null;
  disciplineCode: string | null;
  unitCode: string | null;
  taxMode?: SummaryTaxMode;
  totalCount: number;
  items: SummaryDetailItem[];
};

export type VarianceBreakdownItem = {
  groupKey: string;
  groupLabel: string;
  versionCount: number;
  itemCount: number;
  totalSystemAmount: number;
  totalFinalAmount: number;
  varianceAmount: number;
  varianceRate: number;
  varianceShare: number;
};

export type VarianceBreakdownResult = {
  projectId: string;
  groupBy: VarianceBreakdownGroupBy;
  billVersionId: string | null;
  stageCode: string | null;
  disciplineCode: string | null;
  unitCode: string | null;
  totalCount: number;
  items: VarianceBreakdownItem[];
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
  feeTemplateRepository: FeeTemplateRepository;
  feeRuleRepository: FeeRuleRepository;
};

export class SummaryService {
  constructor(private readonly dependencies: Dependencies) {}

  async getSummary(input: {
    projectId: string;
    billVersionId?: string;
    stageCode?: string;
    disciplineCode?: string;
    unitCode?: string;
    taxMode?: SummaryTaxMode;
    userId: string;
  }): Promise<SummaryResult> {
    const billVersions = await this.getAuthorizedBillVersions(input);
    const allItems = this.filterItemsByUnitCode(
      await this.listBillItemsForVersions(billVersions),
      input.unitCode,
    );
    const taxRatesByBillVersionId =
      input.taxMode === "tax_excluded"
        ? await this.resolveTaxRatesByBillVersion(billVersions, input.projectId)
        : new Map<string, number>();

    const totalSystemAmount = sumDecimal(
      allItems.map((item) => item.systemAmount ?? 0),
      2,
    );
    const totalFinalAmount = sumDecimal(
      allItems.map((item) =>
        this.applyTaxModeToFinalAmount({
          systemAmount: item.systemAmount ?? 0,
          finalAmount: item.finalAmount ?? 0,
          taxRate: taxRatesByBillVersionId.get(item.billVersionId) ?? 0,
          taxMode: input.taxMode,
        }),
      ),
      2,
    );
    const totalTaxAmount = sumDecimal(
      allItems.map((item) =>
        multiplyDecimal(
          item.systemAmount ?? 0,
          taxRatesByBillVersionId.get(item.billVersionId) ?? 0,
          2,
        ),
      ),
      2,
    );
    const varianceAmount = subtractDecimal(totalFinalAmount, totalSystemAmount, 2);
    const varianceRate = divideDecimal(varianceAmount, totalSystemAmount, 6);

    const result: SummaryResult = {
      projectId: input.projectId,
      billVersionId: input.billVersionId ?? null,
      stageCode: input.stageCode ?? null,
      disciplineCode: input.disciplineCode ?? null,
      unitCode: input.unitCode ?? null,
      versionCount: billVersions.length,
      itemCount: allItems.length,
      totalSystemAmount,
      totalFinalAmount,
      varianceAmount,
      varianceRate,
    };
    if (input.taxMode) {
      result.taxMode = input.taxMode;
      result.totalTaxAmount = totalTaxAmount;
    }
    return result;
  }

  async getSummaryDetails(input: {
    projectId: string;
    billVersionId?: string;
    stageCode?: string;
    disciplineCode?: string;
    unitCode?: string;
    taxMode?: SummaryTaxMode;
    limit?: number;
    userId: string;
  }): Promise<SummaryDetailResult> {
    const billVersions = await this.getAuthorizedBillVersions(input);
    const allItems = this.filterItemsByUnitCode(
      await this.listBillItemsForVersions(billVersions),
      input.unitCode,
    );
    const taxRatesByBillVersionId =
      input.taxMode === "tax_excluded"
        ? await this.resolveTaxRatesByBillVersion(billVersions, input.projectId)
        : new Map<string, number>();
    const totalVariance = sumDecimal(
      allItems.map((item) =>
        absoluteDecimal(
          subtractDecimal(
            this.applyTaxModeToFinalAmount({
              systemAmount: item.systemAmount ?? 0,
              finalAmount: item.finalAmount ?? 0,
              taxRate: taxRatesByBillVersionId.get(item.billVersionId) ?? 0,
              taxMode: input.taxMode,
            }),
            item.systemAmount ?? 0,
            2,
          ),
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
          return this.filterItemsByUnitCode(items, input.unitCode).map((item) => {
            const systemAmount = roundDecimal(item.systemAmount ?? 0, 2);
            const taxRate = taxRatesByBillVersionId.get(item.billVersionId) ?? 0;
            const taxAmount = multiplyDecimal(systemAmount, taxRate, 2);
            const finalAmount = this.applyTaxModeToFinalAmount({
              systemAmount,
              finalAmount: item.finalAmount ?? 0,
              taxRate,
              taxMode: input.taxMode,
            });
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
              ...(input.taxMode ? { taxAmount } : {}),
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
      unitCode: input.unitCode ?? null,
      ...(input.taxMode ? { taxMode: input.taxMode } : {}),
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

  async getVarianceBreakdown(input: {
    projectId: string;
    groupBy: VarianceBreakdownGroupBy;
    billVersionId?: string;
    stageCode?: string;
    disciplineCode?: string;
    unitCode?: string;
    userId: string;
  }): Promise<VarianceBreakdownResult> {
    const billVersions = await this.getAuthorizedBillVersions(input);
    const versionById = new Map(
      billVersions.map((billVersion) => [billVersion.id, billVersion]),
    );
    const allItems = this.filterItemsByUnitCode(
      await this.listBillItemsForVersions(billVersions),
      input.unitCode,
    );
    const totalAbsoluteVariance = sumDecimal(
      allItems.map((item) =>
        absoluteDecimal(
          subtractDecimal(item.finalAmount ?? 0, item.systemAmount ?? 0, 2),
          2,
        ),
      ),
      2,
    );
    const groups = new Map<
      string,
      {
        versionIds: Set<string>;
        itemCount: number;
        totalSystemAmount: number;
        totalFinalAmount: number;
      }
    >();

    for (const item of allItems) {
      const billVersion = versionById.get(item.billVersionId);
      if (!billVersion) {
        continue;
      }
      const groupKey =
        input.groupBy === "discipline" ? billVersion.disciplineCode : item.unit;
      const current =
        groups.get(groupKey) ??
        {
          versionIds: new Set<string>(),
          itemCount: 0,
          totalSystemAmount: 0,
          totalFinalAmount: 0,
        };

      current.versionIds.add(item.billVersionId);
      current.itemCount += 1;
      current.totalSystemAmount = sumDecimal(
        [current.totalSystemAmount, item.systemAmount ?? 0],
        2,
      );
      current.totalFinalAmount = sumDecimal(
        [current.totalFinalAmount, item.finalAmount ?? 0],
        2,
      );
      groups.set(groupKey, current);
    }

    const items = Array.from(groups.entries())
      .map(([groupKey, group]) => {
        const varianceAmount = subtractDecimal(
          group.totalFinalAmount,
          group.totalSystemAmount,
          2,
        );
        return {
          groupKey,
          groupLabel: groupKey,
          versionCount: group.versionIds.size,
          itemCount: group.itemCount,
          totalSystemAmount: group.totalSystemAmount,
          totalFinalAmount: group.totalFinalAmount,
          varianceAmount,
          varianceRate: divideDecimal(varianceAmount, group.totalSystemAmount, 6),
          varianceShare: divideDecimal(
            absoluteDecimal(varianceAmount, 2),
            totalAbsoluteVariance,
            6,
          ),
        };
      })
      .sort((left, right) => Math.abs(right.varianceAmount) - Math.abs(left.varianceAmount));

    return {
      projectId: input.projectId,
      groupBy: input.groupBy,
      billVersionId: input.billVersionId ?? null,
      stageCode: input.stageCode ?? null,
      disciplineCode: input.disciplineCode ?? null,
      unitCode: input.unitCode ?? null,
      totalCount: items.length,
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

  private async resolveTaxRatesByBillVersion(
    billVersions: Array<{ id: string; stageCode: string; disciplineCode: string }>,
    projectId: string,
  ) {
    const project = await this.dependencies.projectRepository.findById(projectId);
    const feeTemplateId = project?.defaultFeeTemplateId ?? null;
    if (!feeTemplateId) {
      return new Map<string, number>();
    }

    const feeTemplate = await this.dependencies.feeTemplateRepository.findById(
      feeTemplateId,
    );
    if (!feeTemplate || feeTemplate.status !== "active") {
      return new Map<string, number>();
    }

    const feeRules = await this.dependencies.feeRuleRepository.listByFeeTemplateId(
      feeTemplate.id,
    );
    const taxRules = feeRules.filter((rule) => rule.feeType === "tax");
    const taxRatesByBillVersionId = new Map<string, number>();
    for (const billVersion of billVersions) {
      if (!feeTemplate.stageScope.includes(billVersion.stageCode)) {
        taxRatesByBillVersionId.set(billVersion.id, 0);
        continue;
      }
      const matchedRule =
        taxRules.find((rule) => rule.disciplineCode === billVersion.disciplineCode) ??
        taxRules.find((rule) => rule.disciplineCode === null);
      taxRatesByBillVersionId.set(billVersion.id, matchedRule?.feeRate ?? 0);
    }

    return taxRatesByBillVersionId;
  }

  private applyTaxModeToFinalAmount(input: {
    systemAmount: number;
    finalAmount: number;
    taxRate: number;
    taxMode?: SummaryTaxMode;
  }) {
    const finalAmount = roundDecimal(input.finalAmount, 2);
    if (input.taxMode !== "tax_excluded") {
      return finalAmount;
    }
    return subtractDecimal(
      finalAmount,
      multiplyDecimal(input.systemAmount, input.taxRate, 2),
      2,
    );
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

  private filterItemsByUnitCode<
    Item extends {
      unit: string;
    },
  >(items: Item[], unitCode?: string): Item[] {
    if (!unitCode) {
      return items;
    }

    return items.filter((item) => item.unit === unitCode);
  }
}
