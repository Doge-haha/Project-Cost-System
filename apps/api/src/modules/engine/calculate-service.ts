import { z } from "zod";

import { AppError } from "../../shared/errors/app-error.js";
import type { BillItemRepository } from "../bill/bill-item-repository.js";
import type { BillVersionRepository } from "../bill/bill-version-repository.js";
import { BillVersionService } from "../bill/bill-version-service.js";
import type { FeeRuleRepository } from "../fee/fee-rule-repository.js";
import type { FeeTemplateRepository } from "../fee/fee-template-repository.js";
import type { PriceItemRepository } from "../pricing/price-item-repository.js";
import type { PriceVersionRepository } from "../pricing/price-version-repository.js";
import { ProjectAuthorizationService } from "../project/project-authorization-service.js";
import type { ProjectDisciplineRepository } from "../project/project-discipline-repository.js";
import type { ProjectMemberRepository } from "../project/project-member-repository.js";
import type { ProjectRepository } from "../project/project-repository.js";
import type { ProjectStageRepository } from "../project/project-stage-repository.js";
import type { QuotaLineRepository } from "../quota/quota-line-repository.js";

export const calculateEngineSchema = z.object({
  billItemId: z.string().min(1),
  priceVersionId: z.string().min(1).optional(),
  feeTemplateId: z.string().min(1).optional(),
});

export type EngineCalculateResult = {
  billItemId: string;
  systemUnitPrice: number;
  finalUnitPrice: number;
  systemAmount: number;
  finalAmount: number;
  matchedPriceItemCount: number;
  appliedFeeRate: number;
  calculatedAt: string;
};

export type BatchRecalculateResult = {
  billVersionId: string;
  recalculatedCount: number;
  skippedCount: number;
  items: EngineCalculateResult[];
};

export type ProjectBatchRecalculateResult = {
  projectId: string;
  stageCode: string | null;
  disciplineCode: string | null;
  versionCount: number;
  recalculatedCount: number;
  skippedCount: number;
  versions: BatchRecalculateResult[];
};

type Dependencies = {
  billItemRepository: BillItemRepository;
  billVersionRepository: BillVersionRepository;
  quotaLineRepository: QuotaLineRepository;
  priceVersionRepository: PriceVersionRepository;
  priceItemRepository: PriceItemRepository;
  feeTemplateRepository: FeeTemplateRepository;
  feeRuleRepository: FeeRuleRepository;
  projectRepository: ProjectRepository;
  projectStageRepository: ProjectStageRepository;
  projectDisciplineRepository: ProjectDisciplineRepository;
  projectMemberRepository: ProjectMemberRepository;
  billVersionService: BillVersionService;
};

export class CalculateService {
  constructor(private readonly dependencies: Dependencies) {}

  async calculate(input: {
    billItemId: string;
    priceVersionId?: string;
    feeTemplateId?: string;
    userId: string;
  }): Promise<EngineCalculateResult> {
    const billItem = await this.dependencies.billItemRepository.findById(
      input.billItemId,
    );
    if (!billItem) {
      throw new AppError(404, "BILL_ITEM_NOT_FOUND", "Bill item not found");
    }

    if (billItem.quantity <= 0) {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "Bill item quantity must be greater than zero",
      );
    }

    const billVersion = await this.dependencies.billVersionRepository.findById(
      billItem.billVersionId,
    );
    if (!billVersion) {
      throw new AppError(404, "BILL_VERSION_NOT_FOUND", "Bill version not found");
    }

    const version = await this.dependencies.billVersionService.getAuthorizedVersion(
      {
        projectId: billVersion.projectId,
        billVersionId: billItem.billVersionId,
        userId: input.userId,
      },
      "view",
    );

    const project = await this.dependencies.projectRepository.findById(
      billVersion.projectId,
    );
    if (!project) {
      throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
    }

    const resolvedPriceVersionId =
      input.priceVersionId ?? project.defaultPriceVersionId ?? null;
    const resolvedFeeTemplateId =
      input.feeTemplateId ?? project.defaultFeeTemplateId ?? undefined;

    if (!resolvedPriceVersionId) {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "Price version is required when the project has no default price version",
      );
    }

    const priceVersions = await this.dependencies.priceVersionRepository.list({});
    const priceVersion = priceVersions.find(
      (candidate) => candidate.id === resolvedPriceVersionId,
    );
    if (!priceVersion) {
      throw new AppError(404, "PRICE_VERSION_NOT_FOUND", "Price version not found");
    }

    if (priceVersion.disciplineCode !== version.disciplineCode) {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "Price version discipline does not match the bill version discipline",
      );
    }

    const quotaLines = await this.dependencies.quotaLineRepository.listByBillItemId(
      billItem.id,
    );
    if (quotaLines.length === 0) {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "Bill item must contain quota lines before calculation",
      );
    }

    const priceItems = await this.dependencies.priceItemRepository.listByPriceVersionId(
      { priceVersionId: priceVersion.id },
    );
    const priceItemsByQuotaCode = new Map(
      priceItems.map((priceItem) => [priceItem.quotaCode, priceItem]),
    );

    const unmatched = quotaLines
      .filter((quotaLine) => !priceItemsByQuotaCode.has(quotaLine.quotaCode))
      .map((quotaLine) => ({
        quotaLineId: quotaLine.id,
        quotaCode: quotaLine.quotaCode,
      }));

    if (unmatched.length > 0) {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "Some quota lines could not be matched to the selected price version",
        unmatched,
      );
    }

    const systemAmount = Number(
      quotaLines
        .reduce((sum, quotaLine) => {
          const priceItem = priceItemsByQuotaCode.get(quotaLine.quotaCode)!;
          return sum + quotaLine.quantity * priceItem.totalUnitPrice;
        }, 0)
        .toFixed(2),
    );
    const systemUnitPrice = Number((systemAmount / billItem.quantity).toFixed(6));
    const appliedFeeRate = await this.resolveAppliedFeeRate({
      feeTemplateId: resolvedFeeTemplateId,
      disciplineCode: version.disciplineCode,
      stageCode: version.stageCode,
    });
    const finalAmount = Number((systemAmount * (1 + appliedFeeRate)).toFixed(2));
    const finalUnitPrice = Number((finalAmount / billItem.quantity).toFixed(6));
    const calculatedAt = new Date().toISOString();

    await this.dependencies.billItemRepository.updatePricing(billItem.id, {
      systemUnitPrice,
      finalUnitPrice,
      systemAmount,
      finalAmount,
      calculatedAt,
    });

    return {
      billItemId: billItem.id,
      systemUnitPrice,
      finalUnitPrice,
      systemAmount,
      finalAmount,
      matchedPriceItemCount: quotaLines.length,
      appliedFeeRate,
      calculatedAt,
    };
  }

  async recalculateBillVersion(input: {
    projectId: string;
    billVersionId: string;
    priceVersionId?: string;
    feeTemplateId?: string;
    userId: string;
  }): Promise<BatchRecalculateResult> {
    await this.dependencies.billVersionService.getAuthorizedVersion(
      {
        projectId: input.projectId,
        billVersionId: input.billVersionId,
        userId: input.userId,
      },
      "edit",
    );

    const billItems = await this.dependencies.billItemRepository.listByBillVersionId(
      input.billVersionId,
    );
    return this.recalculateBillItems({
      billVersionId: input.billVersionId,
      billItems,
      priceVersionId: input.priceVersionId,
      feeTemplateId: input.feeTemplateId,
      userId: input.userId,
    });
  }

  async recalculateProject(input: {
    projectId: string;
    stageCode?: string;
    disciplineCode?: string;
    priceVersionId?: string;
    feeTemplateId?: string;
    userId: string;
  }): Promise<ProjectBatchRecalculateResult> {
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

    if (
      (input.stageCode || input.disciplineCode) &&
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

    const candidateVersions = (await this.dependencies.billVersionRepository.listByProjectId(
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
      return authorizationService.canEditContext({
        projectId: input.projectId,
        stageCode: billVersion.stageCode,
        disciplineCode: billVersion.disciplineCode,
        userId: input.userId,
      });
    });

    const versions: BatchRecalculateResult[] = [];
    let recalculatedCount = 0;
    let skippedCount = 0;

    for (const billVersion of candidateVersions) {
      const billItems = await this.dependencies.billItemRepository.listByBillVersionId(
        billVersion.id,
      );
      const result = await this.recalculateBillItems({
        billVersionId: billVersion.id,
        billItems,
        priceVersionId: input.priceVersionId,
        feeTemplateId: input.feeTemplateId,
        userId: input.userId,
      });
      versions.push(result);
      recalculatedCount += result.recalculatedCount;
      skippedCount += result.skippedCount;
    }

    return {
      projectId: input.projectId,
      stageCode: input.stageCode ?? null,
      disciplineCode: input.disciplineCode ?? null,
      versionCount: versions.length,
      recalculatedCount,
      skippedCount,
      versions,
    };
  }

  private async recalculateBillItems(input: {
    billVersionId: string;
    billItems: Awaited<ReturnType<BillItemRepository["listByBillVersionId"]>>;
    priceVersionId?: string;
    feeTemplateId?: string;
    userId: string;
  }): Promise<BatchRecalculateResult> {
    const items: EngineCalculateResult[] = [];
    let skippedCount = 0;

    for (const billItem of input.billItems) {
      const quotaLines = await this.dependencies.quotaLineRepository.listByBillItemId(
        billItem.id,
      );
      if (quotaLines.length === 0) {
        skippedCount += 1;
        continue;
      }

      items.push(
        await this.calculate({
          billItemId: billItem.id,
          priceVersionId: input.priceVersionId,
          feeTemplateId: input.feeTemplateId,
          userId: input.userId,
        }),
      );
    }

    return {
      billVersionId: input.billVersionId,
      recalculatedCount: items.length,
      skippedCount,
      items,
    };
  }

  private async resolveAppliedFeeRate(input: {
    feeTemplateId?: string;
    disciplineCode: string;
    stageCode: string;
  }): Promise<number> {
    if (!input.feeTemplateId) {
      return 0;
    }

    const feeTemplate = await this.dependencies.feeTemplateRepository.findById(
      input.feeTemplateId,
    );
    if (!feeTemplate) {
      throw new AppError(404, "FEE_TEMPLATE_NOT_FOUND", "Fee template not found");
    }
    if (feeTemplate.status !== "active") {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "Fee template must be active before calculation",
      );
    }
    if (!feeTemplate.stageScope.includes(input.stageCode)) {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "Fee template does not apply to the bill version stage",
      );
    }

    const rules = await this.dependencies.feeRuleRepository.listByFeeTemplateId(
      input.feeTemplateId,
    );
    return Number(
      rules
        .filter(
          (rule) =>
            rule.disciplineCode === null ||
            rule.disciplineCode === input.disciplineCode,
        )
        .reduce((sum, rule) => sum + rule.feeRate, 0)
        .toFixed(6),
    );
  }
}
