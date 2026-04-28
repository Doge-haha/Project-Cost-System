import { z } from "zod";

import { requireDependency } from "../../shared/dependency/require-dependency.js";
import { AppError } from "../../shared/errors/app-error.js";
import {
  multiplyDecimal,
  roundDecimal,
  subtractDecimal,
  sumDecimal,
} from "../../shared/math/decimal-money.js";
import type { AuditLogService } from "../audit/audit-log-service.js";
import type { BillItemRepository } from "../bill/bill-item-repository.js";
import { BillItemService } from "../bill/bill-item-service.js";
import { BillVersionService } from "../bill/bill-version-service.js";
import type { ProjectDisciplineRepository } from "../project/project-discipline-repository.js";
import type {
  QuotaLineRecord,
  QuotaLineRepository,
  QuotaLineSourceMode,
} from "./quota-line-repository.js";
import type {
  ReferenceQuotaRecord,
  ReferenceQuotaRepository,
} from "./reference-quota-repository.js";

export const quotaLineSourceModeSchema = z.enum([
  "manual",
  "ai",
  "history_reference",
  "reference_knowledge",
]);

export const createQuotaLineSchema = z.object({
  sourceStandardSetCode: z.string().min(1),
  sourceQuotaId: z.string().min(1),
  sourceSequence: z.number().int().positive().nullable().optional(),
  chapterCode: z.string().min(1),
  quotaCode: z.string().min(1),
  quotaName: z.string().min(1),
  unit: z.string().min(1),
  quantity: z.number().positive(),
  laborFee: z.number().nonnegative().nullable().optional(),
  materialFee: z.number().nonnegative().nullable().optional(),
  machineFee: z.number().nonnegative().nullable().optional(),
  contentFactor: z.number().positive().optional(),
  sourceMode: quotaLineSourceModeSchema,
});

export const updateQuotaLineSchema = createQuotaLineSchema;
export const batchCreateQuotaLinesSchema = z.object({
  items: z
    .array(
      createQuotaLineSchema.extend({
        billVersionId: z.string().min(1),
        billItemId: z.string().min(1),
      }),
    )
    .min(1),
});

export const listQuotaSourceCandidatesSchema = z.object({
  standardSetCode: z.string().min(1).optional(),
  disciplineCode: z.string().min(1).optional(),
  keyword: z.string().min(1).optional(),
  chapterCode: z.string().min(1).optional(),
});

export type ProjectQuotaLineRecord = QuotaLineRecord & {
  billVersionId: string;
  stageCode: string;
  disciplineCode: string;
  billItemCode: string;
  billItemName: string;
};

export type QuotaLineSourceChainRecord = {
  quotaLineId: string;
  billVersionId: string;
  billVersionName: string;
  stageCode: string;
  disciplineCode: string;
  billItemId: string;
  billItemCode: string;
  billItemName: string;
  sourceMode: QuotaLineSourceMode;
  sourceStandardSetCode: string;
  sourceQuotaId: string;
  sourceSequence?: number | null;
  quotaCode: string;
  quotaName: string;
};

export type QuotaSourceCandidateRecord = {
  sourceStandardSetCode: string;
  sourceQuotaId: string;
  sourceSequence?: number | null;
  chapterCode: string;
  quotaCode: string;
  quotaName: string;
  unit: string;
  laborFee?: number | null;
  materialFee?: number | null;
  machineFee?: number | null;
  sourceMode: QuotaLineSourceMode;
  sourceDataset: string;
  sourceRegion?: string | null;
  workContentSummary?: string | null;
  resourceCompositionSummary?: string | null;
  matchReason?: string | null;
  matchScore?: number | null;
};

export type QuotaLineValidationIssue = {
  code: "MISSING_QUOTA_LINES" | "UNIT_MISMATCH" | "AMOUNT_MISMATCH";
  severity: "warning";
  message: string;
  billVersionId: string;
  billItemId: string;
  billItemCode: string;
  billItemName: string;
  quotaLineId?: string;
  quotaCode?: string;
  billItemUnit?: string;
  quotaUnit?: string;
  billItemSystemAmount?: number;
  quotaLineAmountTotal?: number;
  varianceAmount?: number;
};

export type QuotaLineValidationResult = {
  passed: boolean;
  issueCount: number;
  issues: QuotaLineValidationIssue[];
};

type Dependencies = {
  billItemService: BillItemService;
  billItemRepository: BillItemRepository;
  billVersionService: BillVersionService;
  projectDisciplineRepository: ProjectDisciplineRepository;
  referenceQuotaRepository?: ReferenceQuotaRepository;
};

export class QuotaLineService {
  private readonly auditLogService: AuditLogService;

  constructor(
    private readonly quotaLineRepository: QuotaLineRepository,
    private readonly dependencies: Dependencies,
    auditLogService?: AuditLogService,
  ) {
    this.auditLogService = requireDependency(
      auditLogService,
      "auditLogService",
    );
  }

  async listQuotaLines(input: {
    projectId: string;
    billVersionId: string;
    billItemId: string;
    userId: string;
  }): Promise<QuotaLineRecord[]> {
    await this.assertBillItemInEditableContext(input, "view");
    return this.quotaLineRepository.listByBillItemId(input.billItemId);
  }

  async listProjectQuotaLines(input: {
    projectId: string;
    userId: string;
  }): Promise<ProjectQuotaLineRecord[]> {
    const versions = await this.dependencies.billVersionService.listAuthorizedProjectVersions({
      projectId: input.projectId,
      userId: input.userId,
    });
    const projectQuotaLines: ProjectQuotaLineRecord[] = [];

    for (const version of versions) {
      const billItems = await this.dependencies.billItemRepository.listByBillVersionId(
        version.id,
      );

      for (const billItem of billItems) {
        const quotaLines = await this.quotaLineRepository.listByBillItemId(billItem.id);
        projectQuotaLines.push(
          ...quotaLines.map((quotaLine) => ({
            ...quotaLine,
            billVersionId: version.id,
            stageCode: version.stageCode,
            disciplineCode: version.disciplineCode,
            billItemCode: billItem.itemCode,
            billItemName: billItem.itemName,
          })),
        );
      }
    }

    return projectQuotaLines;
  }

  async listQuotaSourceCandidates(input: {
    projectId: string;
    userId: string;
    standardSetCode?: string;
    disciplineCode?: string;
    keyword?: string;
    chapterCode?: string;
  }): Promise<QuotaSourceCandidateRecord[]> {
    const versions = await this.dependencies.billVersionService.listAuthorizedProjectVersions({
      projectId: input.projectId,
      userId: input.userId,
    });
    const allowedDisciplineCodes = new Set(
      versions.map((version) => version.disciplineCode),
    );
    if (input.disciplineCode && !allowedDisciplineCodes.has(input.disciplineCode)) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "User cannot view quota candidates for this discipline",
      );
    }

    const sourceStandardSetCode =
      input.standardSetCode ??
      (await this.resolveDefaultStandardSetCode({
        projectId: input.projectId,
        disciplineCode: input.disciplineCode,
        allowedDisciplineCodes,
      }));
    const candidates = await this.quotaLineRepository.listSourceCandidates({
      sourceStandardSetCode: sourceStandardSetCode ?? undefined,
      chapterCode: input.chapterCode,
      keyword: input.keyword,
    });
    const referenceCandidates =
      await this.dependencies.referenceQuotaRepository?.listCandidates({
        standardSetCode: sourceStandardSetCode ?? undefined,
        disciplineCode: input.disciplineCode,
        chapterCode: input.chapterCode,
        keyword: input.keyword,
      }) ?? [];

    return sortCandidatesByMatch([
      ...candidates.map((candidate) =>
        mapQuotaLineCandidate(candidate, input.keyword),
      ),
      ...referenceCandidates.map((candidate) =>
        mapReferenceQuotaCandidate(candidate, input.keyword),
      ),
    ]);
  }

  async listProjectQuotaLineSourceChains(input: {
    projectId: string;
    userId: string;
  }): Promise<QuotaLineSourceChainRecord[]> {
    const versions = await this.dependencies.billVersionService.listAuthorizedProjectVersions({
      projectId: input.projectId,
      userId: input.userId,
    });
    const sourceChains: QuotaLineSourceChainRecord[] = [];

    for (const version of versions) {
      const billItems = await this.dependencies.billItemRepository.listByBillVersionId(
        version.id,
      );

      for (const billItem of billItems) {
        const quotaLines = await this.quotaLineRepository.listByBillItemId(billItem.id);
        sourceChains.push(
          ...quotaLines.map((quotaLine) => ({
            quotaLineId: quotaLine.id,
            billVersionId: version.id,
            billVersionName: version.versionName,
            stageCode: version.stageCode,
            disciplineCode: version.disciplineCode,
            billItemId: billItem.id,
            billItemCode: billItem.itemCode,
            billItemName: billItem.itemName,
            sourceMode: quotaLine.sourceMode,
            sourceStandardSetCode: quotaLine.sourceStandardSetCode,
            sourceQuotaId: quotaLine.sourceQuotaId,
            sourceSequence: quotaLine.sourceSequence ?? null,
            quotaCode: quotaLine.quotaCode,
            quotaName: quotaLine.quotaName,
          })),
        );
      }
    }

    return sourceChains;
  }

  async validateProjectQuotaLines(input: {
    projectId: string;
    userId: string;
  }): Promise<QuotaLineValidationResult> {
    const versions = await this.dependencies.billVersionService.listAuthorizedProjectVersions({
      projectId: input.projectId,
      userId: input.userId,
    });
    const issues: QuotaLineValidationIssue[] = [];

    for (const version of versions) {
      const billItems = await this.dependencies.billItemRepository.listByBillVersionId(
        version.id,
      );

      for (const billItem of billItems) {
        const quotaLines = await this.quotaLineRepository.listByBillItemId(billItem.id);

        if (quotaLines.length === 0) {
          issues.push({
            code: "MISSING_QUOTA_LINES",
            severity: "warning",
            message: "Bill item has no quota lines",
            billVersionId: version.id,
            billItemId: billItem.id,
            billItemCode: billItem.itemCode,
            billItemName: billItem.itemName,
          });
          continue;
        }

        for (const quotaLine of quotaLines) {
          if (quotaLine.unit !== billItem.unit) {
            issues.push({
              code: "UNIT_MISMATCH",
              severity: "warning",
              message: "Quota line unit does not match bill item unit",
              billVersionId: version.id,
              billItemId: billItem.id,
              billItemCode: billItem.itemCode,
              billItemName: billItem.itemName,
              quotaLineId: quotaLine.id,
              quotaCode: quotaLine.quotaCode,
              billItemUnit: billItem.unit,
              quotaUnit: quotaLine.unit,
            });
          }
        }

        if (billItem.systemAmount !== null && billItem.systemAmount !== undefined) {
          const quotaLineAmountTotal = this.calculateQuotaLineAmountTotal(quotaLines);
          const varianceAmount = subtractDecimal(
            billItem.systemAmount,
            quotaLineAmountTotal,
            2,
          );
          if (Math.abs(varianceAmount) > 0.01) {
            issues.push({
              code: "AMOUNT_MISMATCH",
              severity: "warning",
              message:
                "Bill item system amount does not match quota line amount total",
              billVersionId: version.id,
              billItemId: billItem.id,
              billItemCode: billItem.itemCode,
              billItemName: billItem.itemName,
              billItemSystemAmount: roundDecimal(billItem.systemAmount, 2),
              quotaLineAmountTotal,
              varianceAmount,
            });
          }
        }
      }
    }

    return {
      passed: issues.length === 0,
      issueCount: issues.length,
      issues,
    };
  }

  private calculateQuotaLineAmountTotal(quotaLines: QuotaLineRecord[]): number {
    return sumDecimal(
      quotaLines.map((quotaLine) => {
        const unitAmount = sumDecimal([
          quotaLine.laborFee ?? 0,
          quotaLine.materialFee ?? 0,
          quotaLine.machineFee ?? 0,
        ]);
        return multiplyDecimal(
          multiplyDecimal(quotaLine.quantity, quotaLine.contentFactor, 6),
          unitAmount,
          6,
        );
      }),
      2,
    );
  }

  async createQuotaLine(input: {
    projectId: string;
    billVersionId: string;
    billItemId: string;
    sourceStandardSetCode: string;
    sourceQuotaId: string;
    sourceSequence?: number | null;
    chapterCode: string;
    quotaCode: string;
    quotaName: string;
    unit: string;
    quantity: number;
    laborFee?: number | null;
    materialFee?: number | null;
    machineFee?: number | null;
    contentFactor?: number;
    sourceMode: QuotaLineSourceMode;
    userId: string;
  }): Promise<QuotaLineRecord> {
    const version = await this.assertBillItemInEditableContext(input, "edit");
    await this.assertUniqueSourceQuota({
      billItemId: input.billItemId,
      sourceStandardSetCode: input.sourceStandardSetCode,
      sourceQuotaId: input.sourceQuotaId,
    });

    const created = await this.quotaLineRepository.create({
      billItemId: input.billItemId,
      sourceStandardSetCode: input.sourceStandardSetCode,
      sourceQuotaId: input.sourceQuotaId,
      sourceSequence: input.sourceSequence ?? null,
      chapterCode: input.chapterCode,
      quotaCode: input.quotaCode,
      quotaName: input.quotaName,
      unit: input.unit,
      quantity: input.quantity,
      laborFee: input.laborFee ?? null,
      materialFee: input.materialFee ?? null,
      machineFee: input.machineFee ?? null,
      contentFactor: input.contentFactor ?? 1,
      sourceMode: input.sourceMode,
    });

    await this.auditLogService.writeAuditLog({
      projectId: input.projectId,
      stageCode: version.stageCode,
      resourceType: "quota_line",
      resourceId: created.id,
      action: "create",
      operatorId: input.userId,
      afterPayload: created,
    });

    return created;
  }

  async updateQuotaLine(input: {
    projectId: string;
    quotaLineId: string;
    sourceStandardSetCode: string;
    sourceQuotaId: string;
    sourceSequence?: number | null;
    chapterCode: string;
    quotaCode: string;
    quotaName: string;
    unit: string;
    quantity: number;
    laborFee?: number | null;
    materialFee?: number | null;
    machineFee?: number | null;
    contentFactor?: number;
    sourceMode: QuotaLineSourceMode;
    userId: string;
  }): Promise<QuotaLineRecord> {
    const existingQuotaLine = await this.quotaLineRepository.findById(input.quotaLineId);
    if (!existingQuotaLine) {
      throw new AppError(404, "QUOTA_LINE_NOT_FOUND", "Quota line not found");
    }

    const billItem = await this.dependencies.billItemRepository.findById(
      existingQuotaLine.billItemId,
    );
    if (!billItem) {
      throw new AppError(404, "BILL_ITEM_NOT_FOUND", "Bill item not found");
    }

    const version = await this.assertBillItemInEditableContext(
      {
        projectId: input.projectId,
        billVersionId: billItem.billVersionId,
        billItemId: billItem.id,
        userId: input.userId,
      },
      "edit",
    );
    await this.assertUniqueSourceQuota({
      billItemId: billItem.id,
      sourceStandardSetCode: input.sourceStandardSetCode,
      sourceQuotaId: input.sourceQuotaId,
      excludeQuotaLineId: input.quotaLineId,
    });

    const before = { ...existingQuotaLine };
    const updated = await this.quotaLineRepository.update(input.quotaLineId, {
      billItemId: billItem.id,
      sourceStandardSetCode: input.sourceStandardSetCode,
      sourceQuotaId: input.sourceQuotaId,
      sourceSequence: input.sourceSequence ?? null,
      chapterCode: input.chapterCode,
      quotaCode: input.quotaCode,
      quotaName: input.quotaName,
      unit: input.unit,
      quantity: input.quantity,
      laborFee: input.laborFee ?? null,
      materialFee: input.materialFee ?? null,
      machineFee: input.machineFee ?? null,
      contentFactor: input.contentFactor ?? 1,
      sourceMode: input.sourceMode,
    });

    await this.auditLogService.writeAuditLog({
      projectId: input.projectId,
      stageCode: version.stageCode,
      resourceType: "quota_line",
      resourceId: updated.id,
      action: "update",
      operatorId: input.userId,
      beforePayload: before,
      afterPayload: updated,
    });

    return updated;
  }

  async deleteQuotaLine(input: {
    projectId: string;
    quotaLineId: string;
    userId: string;
  }): Promise<void> {
    const existingQuotaLine = await this.quotaLineRepository.findById(input.quotaLineId);
    if (!existingQuotaLine) {
      throw new AppError(404, "QUOTA_LINE_NOT_FOUND", "Quota line not found");
    }

    const billItem = await this.dependencies.billItemRepository.findById(
      existingQuotaLine.billItemId,
    );
    if (!billItem) {
      throw new AppError(404, "BILL_ITEM_NOT_FOUND", "Bill item not found");
    }

    const version = await this.assertBillItemInEditableContext(
      {
        projectId: input.projectId,
        billVersionId: billItem.billVersionId,
        billItemId: billItem.id,
        userId: input.userId,
      },
      "edit",
    );

    await this.quotaLineRepository.delete(existingQuotaLine.id);

    await this.auditLogService.writeAuditLog({
      projectId: input.projectId,
      stageCode: version.stageCode,
      resourceType: "quota_line",
      resourceId: existingQuotaLine.id,
      action: "delete",
      operatorId: input.userId,
      beforePayload: existingQuotaLine,
    });
  }

  private async assertBillItemInEditableContext(
    input: {
      projectId: string;
      billVersionId: string;
      billItemId: string;
      userId: string;
    },
    action: "view" | "edit",
  ): Promise<Awaited<ReturnType<BillVersionService["getAuthorizedVersion"]>>> {
    const billItem = await this.dependencies.billItemRepository.findById(
      input.billItemId,
    );
    if (!billItem || billItem.billVersionId !== input.billVersionId) {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "Bill item must belong to the target bill version",
      );
    }

    const version = await this.dependencies.billVersionService.getAuthorizedVersion(
      {
        projectId: input.projectId,
        billVersionId: input.billVersionId,
        userId: input.userId,
      },
      action,
    );

    if (action === "edit" && version.versionStatus !== "editable") {
      throw new AppError(
        423,
        "RESOURCE_LOCKED",
        "Bill version is not editable in its current status",
      );
    }

    if (action === "view") {
      await this.dependencies.billItemService.listBillItems({
        projectId: input.projectId,
        billVersionId: input.billVersionId,
        userId: input.userId,
      });
    }

    return version;
  }

  private async assertUniqueSourceQuota(input: {
    billItemId: string;
    sourceStandardSetCode: string;
    sourceQuotaId: string;
    excludeQuotaLineId?: string;
  }): Promise<void> {
    const existingQuotaLines = await this.quotaLineRepository.listByBillItemId(
      input.billItemId,
    );
    const duplicate = existingQuotaLines.some(
      (quotaLine) =>
        quotaLine.id !== input.excludeQuotaLineId &&
        quotaLine.sourceStandardSetCode === input.sourceStandardSetCode &&
        quotaLine.sourceQuotaId === input.sourceQuotaId,
    );

    if (duplicate) {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "Duplicate quota source is not allowed for the same bill item",
      );
    }
  }

  private async resolveDefaultStandardSetCode(input: {
    projectId: string;
    disciplineCode?: string;
    allowedDisciplineCodes: Set<string>;
  }): Promise<string | null> {
    const disciplines = await this.dependencies.projectDisciplineRepository.listByProjectId(
      input.projectId,
    );
    const enabledDisciplines = disciplines.filter(
      (discipline) =>
        discipline.status === "enabled" &&
        input.allowedDisciplineCodes.has(discipline.disciplineCode),
    );

    if (input.disciplineCode) {
      return (
        enabledDisciplines.find(
          (discipline) => discipline.disciplineCode === input.disciplineCode,
        )?.defaultStandardSetCode ?? null
      );
    }

    return enabledDisciplines[0]?.defaultStandardSetCode ?? null;
  }
}

function mapQuotaLineCandidate(
  candidate: QuotaLineRecord,
  keyword?: string,
): QuotaSourceCandidateRecord {
  return {
    sourceStandardSetCode: candidate.sourceStandardSetCode,
    sourceQuotaId: candidate.sourceQuotaId,
    sourceSequence: candidate.sourceSequence ?? null,
    chapterCode: candidate.chapterCode,
    quotaCode: candidate.quotaCode,
    quotaName: candidate.quotaName,
    unit: candidate.unit,
    laborFee: candidate.laborFee ?? null,
    materialFee: candidate.materialFee ?? null,
    machineFee: candidate.machineFee ?? null,
    sourceMode: candidate.sourceMode,
    sourceDataset: candidate.sourceStandardSetCode,
    sourceRegion: null,
    workContentSummary: null,
    resourceCompositionSummary: buildResourceCompositionSummary(candidate),
    matchReason: buildCandidateMatchReason(candidate, keyword),
    matchScore: buildCandidateMatchScore(candidate, keyword),
  };
}

function sortCandidatesByMatch(
  candidates: QuotaSourceCandidateRecord[],
): QuotaSourceCandidateRecord[] {
  return [...candidates].sort((left, right) => {
    const scoreDelta = (right.matchScore ?? 0) - (left.matchScore ?? 0);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }
    return left.quotaCode.localeCompare(right.quotaCode);
  });
}

function mapReferenceQuotaCandidate(
  candidate: ReferenceQuotaRecord,
  keyword?: string,
): QuotaSourceCandidateRecord {
  return {
    sourceStandardSetCode: candidate.standardSetCode,
    sourceQuotaId: candidate.sourceQuotaId,
    sourceSequence: candidate.sourceSequence ?? null,
    chapterCode: candidate.chapterCode,
    quotaCode: candidate.quotaCode,
    quotaName: candidate.quotaName,
    unit: candidate.unit,
    laborFee: candidate.laborFee ?? null,
    materialFee: candidate.materialFee ?? null,
    machineFee: candidate.machineFee ?? null,
    sourceMode: "reference_knowledge",
    sourceDataset: candidate.sourceDataset,
    sourceRegion: candidate.sourceRegion ?? null,
    workContentSummary: candidate.workContentSummary ?? null,
    resourceCompositionSummary:
      candidate.resourceCompositionSummary ?? buildResourceCompositionSummary(candidate),
    matchReason: buildReferenceCandidateMatchReason(candidate, keyword),
    matchScore: buildReferenceCandidateMatchScore(candidate, keyword),
  };
}

function buildResourceCompositionSummary(candidate: {
  laborFee?: number | null;
  materialFee?: number | null;
  machineFee?: number | null;
}): string | null {
  const parts = [
    ["人工费", candidate.laborFee],
    ["材料费", candidate.materialFee],
    ["机械费", candidate.machineFee],
  ]
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([label, value]) => `${label} ${value}`);

  return parts.length > 0 ? parts.join(" / ") : null;
}

function buildReferenceCandidateMatchReason(
  candidate: ReferenceQuotaRecord,
  keyword?: string,
): string | null {
  const normalizedKeyword = keyword?.trim().toLowerCase();
  if (!normalizedKeyword) {
    return "参考定额知识库候选";
  }
  if (candidate.quotaCode.toLowerCase().includes(normalizedKeyword)) {
    return "参考库关键字命中定额编号";
  }
  if (candidate.quotaName.toLowerCase().includes(normalizedKeyword)) {
    return "参考库关键字命中定额名称";
  }
  if (candidate.searchText.toLowerCase().includes(normalizedKeyword)) {
    return "参考库关键字命中工作内容";
  }

  return null;
}

function buildReferenceCandidateMatchScore(
  candidate: ReferenceQuotaRecord,
  keyword?: string,
): number | null {
  const normalizedKeyword = keyword?.trim().toLowerCase();
  if (!normalizedKeyword) {
    return 0.65;
  }
  if (
    candidate.quotaCode.toLowerCase() === normalizedKeyword ||
    candidate.quotaName.toLowerCase() === normalizedKeyword
  ) {
    return 1;
  }
  if (
    candidate.quotaCode.toLowerCase().includes(normalizedKeyword) ||
    candidate.quotaName.toLowerCase().includes(normalizedKeyword)
  ) {
    return 0.92;
  }
  if (candidate.searchText.toLowerCase().includes(normalizedKeyword)) {
    return 0.82;
  }

  return null;
}

function buildCandidateMatchReason(
  candidate: QuotaLineRecord,
  keyword?: string,
): string | null {
  const normalizedKeyword = keyword?.trim().toLowerCase();
  if (!normalizedKeyword) {
    return "默认定额集候选";
  }
  if (candidate.quotaCode.toLowerCase().includes(normalizedKeyword)) {
    return "关键字命中定额编号";
  }
  if (candidate.quotaName.toLowerCase().includes(normalizedKeyword)) {
    return "关键字命中定额名称";
  }

  return null;
}

function buildCandidateMatchScore(
  candidate: QuotaLineRecord,
  keyword?: string,
): number | null {
  const normalizedKeyword = keyword?.trim().toLowerCase();
  if (!normalizedKeyword) {
    return 0.6;
  }
  if (
    candidate.quotaCode.toLowerCase() === normalizedKeyword ||
    candidate.quotaName.toLowerCase() === normalizedKeyword
  ) {
    return 1;
  }
  if (
    candidate.quotaCode.toLowerCase().includes(normalizedKeyword) ||
    candidate.quotaName.toLowerCase().includes(normalizedKeyword)
  ) {
    return 0.9;
  }

  return null;
}
