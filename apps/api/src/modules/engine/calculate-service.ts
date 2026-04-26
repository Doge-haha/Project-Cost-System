import { z } from "zod";

import { requireDependency } from "../../shared/dependency/require-dependency.js";
import { AppError } from "../../shared/errors/app-error.js";
import {
  divideDecimal,
  multiplyDecimal,
  roundDecimal,
  subtractDecimal,
  sumDecimal,
} from "../../shared/math/decimal-money.js";
import type { AuditLogService } from "../audit/audit-log-service.js";
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
  skippedSummary: Array<{
    reason: "missing_quota_lines" | "invalid_quantity" | "unmatched_price_items";
    label: string;
    count: number;
  }>;
  totalSystemAmount: number;
  totalFinalAmount: number;
  skippedItems: Array<{
    billItemId: string;
    reason:
      | "missing_quota_lines"
      | "invalid_quantity"
      | "unmatched_price_items";
    label: string;
    details?: Record<string, unknown>;
  }>;
  items: EngineCalculateResult[];
};

export type ProjectBatchRecalculateResult = {
  projectId: string;
  stageCode: string | null;
  disciplineCode: string | null;
  versionCount: number;
  recalculatedCount: number;
  skippedCount: number;
  skippedSummary: Array<{
    reason: "missing_quota_lines" | "invalid_quantity" | "unmatched_price_items";
    label: string;
    count: number;
  }>;
  totalSystemAmount: number;
  totalFinalAmount: number;
  skippedItems: Array<{
    billVersionId: string;
    billItemId: string;
    reason:
      | "missing_quota_lines"
      | "invalid_quantity"
      | "unmatched_price_items";
    label: string;
    details?: Record<string, unknown>;
  }>;
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
  private readonly auditLogService: AuditLogService;

  constructor(
    private readonly dependencies: Dependencies,
    auditLogService?: AuditLogService,
  ) {
    this.auditLogService = requireDependency(
      auditLogService,
      "auditLogService",
    );
  }

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
    if (priceVersion.status !== "active") {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "Price version must be active before calculation",
      );
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

    const systemAmount = sumDecimal(
      quotaLines.map((quotaLine) => {
        const priceItem = priceItemsByQuotaCode.get(quotaLine.quotaCode)!;
        return multiplyDecimal(quotaLine.quantity, priceItem.totalUnitPrice, 6);
      }),
      2,
    );
    const systemUnitPrice = divideDecimal(systemAmount, billItem.quantity, 6);
    const appliedFeeRate = await this.resolveAppliedFeeRate({
      feeTemplateId: resolvedFeeTemplateId,
      disciplineCode: version.disciplineCode,
      stageCode: version.stageCode,
    });
    const finalAmount = multiplyDecimal(systemAmount, 1 + appliedFeeRate, 2);
    const finalUnitPrice = divideDecimal(finalAmount, billItem.quantity, 6);
    const calculatedAt = new Date().toISOString();

    const beforePricing = {
      systemUnitPrice: billItem.systemUnitPrice ?? null,
      finalUnitPrice: billItem.finalUnitPrice ?? null,
      systemAmount: billItem.systemAmount ?? null,
      finalAmount: billItem.finalAmount ?? null,
      calculatedAt: billItem.calculatedAt ?? null,
    };

    await this.dependencies.billItemRepository.updatePricing(billItem.id, {
      systemUnitPrice,
      finalUnitPrice,
      systemAmount,
      finalAmount,
      calculatedAt,
    });

    await this.auditLogService.writeAuditLog({
      projectId: billVersion.projectId,
      stageCode: billVersion.stageCode,
      resourceType: "bill_item",
      resourceId: billItem.id,
      action: "calculate",
      operatorId: input.userId,
      beforePayload: beforePricing,
      afterPayload: {
        systemUnitPrice,
        finalUnitPrice,
        systemAmount,
        finalAmount,
        calculatedAt,
        priceVersionId: priceVersion.id,
        feeTemplateId: resolvedFeeTemplateId ?? null,
      },
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
    const version = await this.dependencies.billVersionService.getAuthorizedVersion(
      {
        projectId: input.projectId,
        billVersionId: input.billVersionId,
        userId: input.userId,
      },
      "edit",
    );

    await this.validateRecalculationPricingContext({
      projectId: input.projectId,
      candidateVersions: [version],
      priceVersionId: input.priceVersionId,
      feeTemplateId: input.feeTemplateId,
    });

    const billItems = await this.dependencies.billItemRepository.listByBillVersionId(
      input.billVersionId,
    );
    const result = await this.recalculateBillItems({
      billVersionId: input.billVersionId,
      billItems,
      priceVersionId: input.priceVersionId,
      feeTemplateId: input.feeTemplateId,
      userId: input.userId,
    });

    await this.auditLogService.writeAuditLog({
      projectId: input.projectId,
      stageCode: version.stageCode,
      resourceType: "bill_version",
      resourceId: version.id,
      action: "recalculate",
      operatorId: input.userId,
      afterPayload: result,
    });

    return result;
  }

  async recalculateProject(input: {
    projectId: string;
    stageCode?: string;
    disciplineCode?: string;
    priceVersionId?: string;
    feeTemplateId?: string;
    userId: string;
    roleCodes?: string[];
  }): Promise<ProjectBatchRecalculateResult> {
    const candidateVersions = await this.resolveRecalculationCandidateVersions(input);
    await this.validateRecalculationPricingContext({
      projectId: input.projectId,
      candidateVersions,
      priceVersionId: input.priceVersionId,
      feeTemplateId: input.feeTemplateId,
    });

    const versions: BatchRecalculateResult[] = [];
    let recalculatedCount = 0;
    let skippedCount = 0;
    let totalSystemAmount = 0;
    let totalFinalAmount = 0;
    const skippedItems: ProjectBatchRecalculateResult["skippedItems"] = [];

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
      totalSystemAmount = sumDecimal([totalSystemAmount, result.totalSystemAmount], 2);
      totalFinalAmount = sumDecimal([totalFinalAmount, result.totalFinalAmount], 2);
      skippedItems.push(
        ...result.skippedItems.map((item) => ({
          billVersionId: billVersion.id,
          ...item,
        })),
      );
    }

    const result = {
      projectId: input.projectId,
      stageCode: input.stageCode ?? null,
      disciplineCode: input.disciplineCode ?? null,
      versionCount: versions.length,
      recalculatedCount,
      skippedCount,
      skippedSummary: summarizeSkippedItems(skippedItems),
      totalSystemAmount,
      totalFinalAmount,
      skippedItems,
      versions,
    };

    await this.auditLogService.writeAuditLog({
      projectId: input.projectId,
      stageCode: input.stageCode ?? null,
      resourceType: "project",
      resourceId: input.projectId,
      action: "recalculate",
      operatorId: input.userId,
      afterPayload: result,
    });

    return result;
  }

  async validateProjectRecalculationScope(input: {
    projectId: string;
    stageCode?: string;
    disciplineCode?: string;
    userId: string;
    priceVersionId?: string;
    feeTemplateId?: string;
    roleCodes?: string[];
  }): Promise<void> {
    const candidateVersions = await this.resolveRecalculationCandidateVersions(input);
    await this.validateRecalculationPricingContext({
      projectId: input.projectId,
      candidateVersions,
      priceVersionId: input.priceVersionId,
      feeTemplateId: input.feeTemplateId,
    });
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
    let totalSystemAmount = 0;
    let totalFinalAmount = 0;
    const skippedItems: BatchRecalculateResult["skippedItems"] = [];

    for (const billItem of input.billItems) {
      if (billItem.quantity <= 0) {
        skippedCount += 1;
        skippedItems.push({
          billItemId: billItem.id,
          reason: "invalid_quantity",
          label: formatSkippedReason("invalid_quantity"),
          details: {
            quantity: billItem.quantity,
          },
        });
        continue;
      }

      const quotaLines = await this.dependencies.quotaLineRepository.listByBillItemId(
        billItem.id,
      );
      if (quotaLines.length === 0) {
        skippedCount += 1;
        skippedItems.push({
          billItemId: billItem.id,
          reason: "missing_quota_lines",
          label: formatSkippedReason("missing_quota_lines"),
          details: {
            quotaLineCount: 0,
          },
        });
        continue;
      }

      try {
        items.push(
          await this.calculate({
            billItemId: billItem.id,
            priceVersionId: input.priceVersionId,
            feeTemplateId: input.feeTemplateId,
            userId: input.userId,
          }),
        );
        const latest = items.at(-1)!;
        totalSystemAmount = sumDecimal([totalSystemAmount, latest.systemAmount], 2);
        totalFinalAmount = sumDecimal([totalFinalAmount, latest.finalAmount], 2);
      } catch (error) {
        if (
          error instanceof AppError &&
          error.code === "VALIDATION_ERROR" &&
          error.message ===
            "Some quota lines could not be matched to the selected price version"
        ) {
          skippedCount += 1;
          skippedItems.push({
            billItemId: billItem.id,
            reason: "unmatched_price_items",
            label: formatSkippedReason("unmatched_price_items"),
            details: {
              unmatchedQuotaCodes: Array.isArray(error.details)
                ? error.details
                    .map((detail) =>
                      detail &&
                      typeof detail === "object" &&
                      typeof (detail as { quotaCode?: unknown }).quotaCode === "string"
                        ? (detail as { quotaCode: string }).quotaCode
                        : null,
                    )
                    .filter((value): value is string => value !== null)
                : [],
            },
          });
          continue;
        }

        throw error;
      }
    }

    return {
      billVersionId: input.billVersionId,
      recalculatedCount: items.length,
      skippedCount,
      skippedSummary: summarizeSkippedItems(skippedItems),
      totalSystemAmount,
      totalFinalAmount,
      skippedItems,
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
    const selectedRuleByType = new Map<string, (typeof rules)[number]>();
    const allocationMode = feeTemplate.allocationMode;

    if (allocationMode === "none") {
      return 0;
    }

    if (allocationMode !== "proportional" && allocationMode !== "by_discipline") {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "Unsupported fee allocation mode",
      );
    }

    for (const rule of rules) {
      const matchesDiscipline =
        allocationMode === "by_discipline"
          ? rule.disciplineCode === input.disciplineCode
          : rule.disciplineCode === null ||
            rule.disciplineCode === input.disciplineCode;
      if (!matchesDiscipline) {
        continue;
      }

      const current = selectedRuleByType.get(rule.feeType);
      if (!current) {
        selectedRuleByType.set(rule.feeType, rule);
        continue;
      }

      const currentPriority =
        current.disciplineCode === input.disciplineCode ? 2 : current.disciplineCode === null ? 1 : 0;
      const nextPriority =
        rule.disciplineCode === input.disciplineCode ? 2 : rule.disciplineCode === null ? 1 : 0;

      if (nextPriority > currentPriority) {
        selectedRuleByType.set(rule.feeType, rule);
      }
    }

    return roundDecimal(
      Array.from(selectedRuleByType.values()).reduce(
        (sum, rule) => sum + rule.feeRate,
        0,
      ),
      6,
    );
  }

  private async resolveRecalculationCandidateVersions(input: {
    projectId: string;
    stageCode?: string;
    disciplineCode?: string;
    userId: string;
    roleCodes?: string[];
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

    const canManageAsSystemAdmin = (input.roleCodes ?? []).includes("system_admin");

    if (
      (input.stageCode || input.disciplineCode) &&
      !canManageAsSystemAdmin &&
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
      if (canManageAsSystemAdmin) {
        return true;
      }
      return authorizationService.canEditContext({
        projectId: input.projectId,
        stageCode: billVersion.stageCode,
        disciplineCode: billVersion.disciplineCode,
        userId: input.userId,
      });
    });

    if (candidateVersions.length === 0) {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "No bill versions matched the requested recalculation scope",
      );
    }

    return candidateVersions;
  }

  private async validateRecalculationPricingContext(input: {
    projectId: string;
    candidateVersions: Awaited<
      ReturnType<CalculateService["resolveRecalculationCandidateVersions"]>
    >;
    priceVersionId?: string;
    feeTemplateId?: string;
  }): Promise<void> {
    const project = await this.dependencies.projectRepository.findById(input.projectId);
    if (!project) {
      throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
    }

    const resolvedPriceVersionId =
      input.priceVersionId ?? project.defaultPriceVersionId ?? null;
    const resolvedFeeTemplateId =
      input.feeTemplateId ?? project.defaultFeeTemplateId ?? undefined;

    if (resolvedPriceVersionId) {
      const priceVersion = (await this.dependencies.priceVersionRepository.list({})).find(
        (candidate) => candidate.id === resolvedPriceVersionId,
      );
      if (!priceVersion) {
        throw new AppError(404, "PRICE_VERSION_NOT_FOUND", "Price version not found");
      }
      if (priceVersion.status !== "active") {
        throw new AppError(
          422,
          "VALIDATION_ERROR",
          "Price version must be active before calculation",
        );
      }

      const hasDisciplineMismatch = input.candidateVersions.some(
        (billVersion) => billVersion.disciplineCode !== priceVersion.disciplineCode,
      );
      if (hasDisciplineMismatch) {
        throw new AppError(
          422,
          "VALIDATION_ERROR",
          "Price version discipline does not match the requested recalculation scope",
        );
      }
    }

    if (resolvedFeeTemplateId) {
      const feeTemplate = await this.dependencies.feeTemplateRepository.findById(
        resolvedFeeTemplateId,
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

      const hasStageMismatch = input.candidateVersions.some(
        (billVersion) => !feeTemplate.stageScope.includes(billVersion.stageCode),
      );
      if (hasStageMismatch) {
        throw new AppError(
          422,
          "VALIDATION_ERROR",
          "Fee template does not apply to the requested recalculation scope",
        );
      }
    }
  }
}

function formatSkippedReason(
  reason: "missing_quota_lines" | "invalid_quantity" | "unmatched_price_items",
): string {
  if (reason === "missing_quota_lines") {
    return "缺少定额明细";
  }
  if (reason === "invalid_quantity") {
    return "工程量不合法";
  }
  return "价目匹配失败";
}

function summarizeSkippedItems(
  items: Array<{
    reason: "missing_quota_lines" | "invalid_quantity" | "unmatched_price_items";
    label: string;
  }>,
) {
  const summary = new Map<
    "missing_quota_lines" | "invalid_quantity" | "unmatched_price_items",
    { reason: "missing_quota_lines" | "invalid_quantity" | "unmatched_price_items"; label: string; count: number }
  >();

  for (const item of items) {
    const current = summary.get(item.reason);
    if (current) {
      current.count += 1;
      continue;
    }

    summary.set(item.reason, {
      reason: item.reason,
      label: item.label,
      count: 1,
    });
  }

  return Array.from(summary.values());
}
