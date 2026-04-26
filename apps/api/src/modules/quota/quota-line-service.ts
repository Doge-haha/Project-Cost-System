import { z } from "zod";

import { requireDependency } from "../../shared/dependency/require-dependency.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { AuditLogService } from "../audit/audit-log-service.js";
import type { BillItemRepository } from "../bill/bill-item-repository.js";
import { BillItemService } from "../bill/bill-item-service.js";
import { BillVersionService } from "../bill/bill-version-service.js";
import type {
  QuotaLineRecord,
  QuotaLineRepository,
} from "./quota-line-repository.js";

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
  sourceMode: z.string().min(1),
});

export const updateQuotaLineSchema = createQuotaLineSchema;

type Dependencies = {
  billItemService: BillItemService;
  billItemRepository: BillItemRepository;
  billVersionService: BillVersionService;
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
    sourceMode: string;
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
    sourceMode: string;
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
}
