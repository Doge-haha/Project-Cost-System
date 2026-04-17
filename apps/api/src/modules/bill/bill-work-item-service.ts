import { z } from "zod";

import { AppError } from "../../shared/errors/app-error.js";
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

type Dependencies = {
  billItemService: BillItemService;
  billItemRepository: BillItemRepository;
};

export class BillWorkItemService {
  constructor(
    private readonly billWorkItemRepository: BillWorkItemRepository,
    private readonly dependencies: Dependencies,
  ) {}

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

  async createWorkItem(input: {
    projectId: string;
    billVersionId: string;
    billItemId: string;
    workContent: string;
    sortNo: number;
    userId: string;
  }): Promise<BillWorkItemRecord> {
    await this.assertBillItemInVersion(input);
    await this.dependencies.billItemService.assertEditableBillItemContext({
      projectId: input.projectId,
      billVersionId: input.billVersionId,
      itemId: input.billItemId,
      userId: input.userId,
    });

    return this.billWorkItemRepository.create({
      billItemId: input.billItemId,
      workContent: input.workContent,
      sortNo: input.sortNo,
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
}
