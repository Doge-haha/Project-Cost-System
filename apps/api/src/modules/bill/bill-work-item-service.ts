import { z } from "zod";

import { requireDependency } from "../../shared/dependency/require-dependency.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { AuditLogService } from "../audit/audit-log-service.js";
import type { BillItemRepository } from "./bill-item-repository.js";
import type {
  BillWorkItemRecord,
  BillWorkItemRepository,
} from "./bill-work-item-repository.js";
import { BillItemService } from "./bill-item-service.js";

export const createBillWorkItemSchema = z.object({
  workContent: z.string().min(1),
  sortNo: z.number().int().min(1),
});

export const updateBillWorkItemSchema = createBillWorkItemSchema;

type Dependencies = {
  billItemService: BillItemService;
  billItemRepository: BillItemRepository;
};

export class BillWorkItemService {
  private readonly auditLogService: AuditLogService;

  constructor(
    private readonly billWorkItemRepository: BillWorkItemRepository,
    private readonly dependencies: Dependencies,
    auditLogService?: AuditLogService,
  ) {
    this.auditLogService = requireDependency(
      auditLogService,
      "auditLogService",
    );
  }

  async listWorkItems(input: {
    projectId: string;
    billVersionId: string;
    billItemId: string;
    userId: string;
  }): Promise<BillWorkItemRecord[]> {
    await this.assertBillItemInVersion(input);
    await this.dependencies.billItemService.listBillItems({
      projectId: input.projectId,
      billVersionId: input.billVersionId,
      userId: input.userId,
    });

    return this.billWorkItemRepository.listByBillItemId(input.billItemId);
  }

  async listProjectWorkItems(input: {
    projectId: string;
    billItemId: string;
    userId: string;
  }): Promise<BillWorkItemRecord[]> {
    const billVersionId = await this.getBillVersionIdForItem(input.billItemId);
    return this.listWorkItems({
      projectId: input.projectId,
      billVersionId,
      billItemId: input.billItemId,
      userId: input.userId,
    });
  }

  async createWorkItem(input: {
    projectId: string;
    billVersionId: string;
    billItemId: string;
    workContent: string;
    sortNo: number;
    userId: string;
  }): Promise<BillWorkItemRecord> {
    await this.assertBillItemInVersion(input);
    const billItem = await this.dependencies.billItemService.assertEditableBillItemContext({
      projectId: input.projectId,
      billVersionId: input.billVersionId,
      itemId: input.billItemId,
      userId: input.userId,
    });

    const created = await this.billWorkItemRepository.create({
      billItemId: input.billItemId,
      workContent: input.workContent,
      sortNo: input.sortNo,
    });

    await this.auditLogService.writeAuditLog({
      projectId: input.projectId,
      resourceType: "bill_work_item",
      resourceId: created.id,
      action: "create",
      operatorId: input.userId,
      afterPayload: {
        ...created,
        stageCode: null,
        billItemCode: billItem.itemCode,
      },
    });

    return created;
  }

  async createProjectWorkItem(input: {
    projectId: string;
    billItemId: string;
    workContent: string;
    sortNo: number;
    userId: string;
  }): Promise<BillWorkItemRecord> {
    const billVersionId = await this.getBillVersionIdForItem(input.billItemId);
    return this.createWorkItem({
      projectId: input.projectId,
      billVersionId,
      billItemId: input.billItemId,
      workContent: input.workContent,
      sortNo: input.sortNo,
      userId: input.userId,
    });
  }

  async deleteWorkItem(input: {
    projectId: string;
    billVersionId: string;
    billItemId: string;
    workItemId: string;
    userId: string;
  }): Promise<void> {
    const billItem = await this.dependencies.billItemService.assertEditableBillItemContext({
      projectId: input.projectId,
      billVersionId: input.billVersionId,
      itemId: input.billItemId,
      userId: input.userId,
    });
    const workItem = await this.billWorkItemRepository.findById(input.workItemId);
    if (!workItem || workItem.billItemId !== input.billItemId) {
      throw new AppError(404, "BILL_WORK_ITEM_NOT_FOUND", "Bill work item not found");
    }

    await this.billWorkItemRepository.delete(workItem.id);

    await this.auditLogService.writeAuditLog({
      projectId: input.projectId,
      resourceType: "bill_work_item",
      resourceId: workItem.id,
      action: "delete",
      operatorId: input.userId,
      beforePayload: {
        ...workItem,
        billItemCode: billItem.itemCode,
      },
    });
  }

  async updateWorkItem(input: {
    projectId: string;
    billVersionId: string;
    billItemId: string;
    workItemId: string;
    workContent: string;
    sortNo: number;
    userId: string;
  }): Promise<BillWorkItemRecord> {
    const billItem = await this.dependencies.billItemService.assertEditableBillItemContext({
      projectId: input.projectId,
      billVersionId: input.billVersionId,
      itemId: input.billItemId,
      userId: input.userId,
    });
    const workItem = await this.billWorkItemRepository.findById(input.workItemId);
    if (!workItem || workItem.billItemId !== input.billItemId) {
      throw new AppError(404, "BILL_WORK_ITEM_NOT_FOUND", "Bill work item not found");
    }

    const updated = await this.billWorkItemRepository.update(workItem.id, {
      workContent: input.workContent,
      sortNo: input.sortNo,
    });

    await this.auditLogService.writeAuditLog({
      projectId: input.projectId,
      resourceType: "bill_work_item",
      resourceId: updated.id,
      action: "update",
      operatorId: input.userId,
      beforePayload: {
        ...workItem,
        billItemCode: billItem.itemCode,
      },
      afterPayload: {
        ...updated,
        billItemCode: billItem.itemCode,
      },
    });

    return updated;
  }

  async updateProjectWorkItem(input: {
    projectId: string;
    billItemId: string;
    workItemId: string;
    workContent: string;
    sortNo: number;
    userId: string;
  }): Promise<BillWorkItemRecord> {
    const billVersionId = await this.getBillVersionIdForItem(input.billItemId);
    return this.updateWorkItem({
      projectId: input.projectId,
      billVersionId,
      billItemId: input.billItemId,
      workItemId: input.workItemId,
      workContent: input.workContent,
      sortNo: input.sortNo,
      userId: input.userId,
    });
  }

  private async assertBillItemInVersion(input: {
    billVersionId: string;
    billItemId: string;
  }): Promise<void> {
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
  }

  private async getBillVersionIdForItem(billItemId: string): Promise<string> {
    const billItem = await this.dependencies.billItemRepository.findById(billItemId);
    if (!billItem) {
      throw new AppError(404, "BILL_ITEM_NOT_FOUND", "Bill item not found");
    }

    return billItem.billVersionId;
  }
}
