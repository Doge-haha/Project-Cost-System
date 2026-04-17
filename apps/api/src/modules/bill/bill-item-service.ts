import { z } from "zod";

import { AppError } from "../../shared/errors/app-error.js";
import { ProjectAuthorizationService } from "../project/project-authorization-service.js";
import type { ProjectRepository } from "../project/project-repository.js";
import type { ProjectStageRepository } from "../project/project-stage-repository.js";
import type { ProjectDisciplineRepository } from "../project/project-discipline-repository.js";
import type { ProjectMemberRepository } from "../project/project-member-repository.js";
import type {
  BillVersionRecord,
  BillVersionRepository,
} from "./bill-version-repository.js";
import type {
  BillItemRecord,
  BillItemRepository,
} from "./bill-item-repository.js";
import type { BillWorkItemRepository } from "./bill-work-item-repository.js";

export const createBillItemSchema = z.object({
  parentId: z.string().min(1).nullable(),
  itemCode: z.string().min(1),
  itemName: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  sortNo: z.number().int().min(1),
});

export const updateBillItemSchema = createBillItemSchema;
export const updateBillItemManualPricingSchema = z.object({
  manualUnitPrice: z.number().positive().nullable(),
});

type Dependencies = {
  projectRepository: ProjectRepository;
  projectStageRepository: ProjectStageRepository;
  projectDisciplineRepository: ProjectDisciplineRepository;
  projectMemberRepository: ProjectMemberRepository;
  billVersionRepository: BillVersionRepository;
  billWorkItemRepository?: BillWorkItemRepository;
};

export class BillItemService {
  constructor(
    private readonly billItemRepository: BillItemRepository,
    private readonly dependencies: Dependencies,
  ) {}

  async listBillItems(input: {
    projectId: string;
    billVersionId: string;
    userId: string;
  }): Promise<BillItemRecord[]> {
    const version = await this.getAuthorizedVersion(input, "view");
    return this.billItemRepository.listByBillVersionId(version.id);
  }

  async createBillItem(input: {
    projectId: string;
    billVersionId: string;
    parentId: string | null;
    itemCode: string;
    itemName: string;
    quantity: number;
    unit: string;
    sortNo: number;
    userId: string;
  }): Promise<BillItemRecord> {
    const version = await this.getAuthorizedVersion(input, "edit");

    if (version.versionStatus !== "editable") {
      throw new AppError(
        423,
        "RESOURCE_LOCKED",
        "Bill version is not editable in its current status",
      );
    }

    if (input.parentId) {
      const parentItem = await this.billItemRepository.findById(input.parentId);
      if (!parentItem || parentItem.billVersionId !== version.id) {
        throw new AppError(
          422,
          "VALIDATION_ERROR",
          "Parent item must belong to the same bill version",
        );
      }
    }

    return this.billItemRepository.create({
      billVersionId: version.id,
      parentId: input.parentId,
      itemCode: input.itemCode,
      itemName: input.itemName,
      quantity: input.quantity,
      unit: input.unit,
      sortNo: input.sortNo,
    });
  }

  async updateBillItem(input: {
    projectId: string;
    billVersionId: string;
    itemId: string;
    parentId: string | null;
    itemCode: string;
    itemName: string;
    quantity: number;
    unit: string;
    sortNo: number;
    userId: string;
  }): Promise<BillItemRecord> {
    const { version, billItem: existingItem } =
      await this.getEditableBillItemContext({
        projectId: input.projectId,
        billVersionId: input.billVersionId,
        itemId: input.itemId,
        userId: input.userId,
      });

    if (input.parentId) {
      const parentItem = await this.billItemRepository.findById(input.parentId);
      if (!parentItem || parentItem.billVersionId !== version.id) {
        throw new AppError(
          422,
          "VALIDATION_ERROR",
          "Parent item must belong to the same bill version",
        );
      }
    }

    return this.billItemRepository.update(input.itemId, {
      billVersionId: version.id,
      parentId: input.parentId,
      itemCode: input.itemCode,
      itemName: input.itemName,
      quantity: input.quantity,
      unit: input.unit,
      sortNo: input.sortNo,
    });
  }

  async updateBillItemManualPricing(input: {
    projectId: string;
    billVersionId: string;
    itemId: string;
    manualUnitPrice: number | null;
    userId: string;
  }): Promise<BillItemRecord> {
    const { billItem: existingItem } = await this.getEditableBillItemContext({
      projectId: input.projectId,
      billVersionId: input.billVersionId,
      itemId: input.itemId,
      userId: input.userId,
    });

    const baseUnitPrice = existingItem.systemUnitPrice ?? 0;
    const finalUnitPrice = input.manualUnitPrice ?? baseUnitPrice;
    const finalAmount = Number((finalUnitPrice * existingItem.quantity).toFixed(2));

    return this.billItemRepository.updateManualPricing(input.itemId, {
      manualUnitPrice: input.manualUnitPrice,
      finalUnitPrice,
      finalAmount,
      calculatedAt: new Date().toISOString(),
    });
  }

  async assertEditableBillItemContext(input: {
    projectId: string;
    billVersionId: string;
    itemId: string;
    userId: string;
  }): Promise<BillItemRecord> {
    const { billItem } = await this.getEditableBillItemContext(input);
    return billItem;
  }

  private async getEditableBillItemContext(input: {
    projectId: string;
    billVersionId: string;
    itemId: string;
    userId: string;
  }): Promise<{
    version: BillVersionRecord;
    billItem: BillItemRecord;
  }> {
    const version = await this.getAuthorizedVersion(input, "edit");

    if (version.versionStatus !== "editable") {
      throw new AppError(
        423,
        "RESOURCE_LOCKED",
        "Bill version is not editable in its current status",
      );
    }

    const billItem = await this.billItemRepository.findById(input.itemId);
    if (!billItem) {
      throw new AppError(404, "BILL_ITEM_NOT_FOUND", "Bill item not found");
    }

    if (billItem.billVersionId !== version.id) {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "Bill item must belong to the target bill version",
      );
    }

    return { version, billItem };
  }

  private async getAuthorizedVersion(
    input: {
      projectId: string;
      billVersionId: string;
      userId: string;
    },
    action: "view" | "edit",
  ): Promise<BillVersionRecord> {
    const project = await this.dependencies.projectRepository.findById(input.projectId);
    if (!project) {
      throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
    }

    const allStages = await this.dependencies.projectStageRepository.listByProjectId(
      input.projectId,
    );
    const allDisciplines =
      await this.dependencies.projectDisciplineRepository.listByProjectId(
        input.projectId,
      );
    const allMembers = await this.dependencies.projectMemberRepository.listByProjectId(
      input.projectId,
    );

    const authorizationService = new ProjectAuthorizationService({
      stages: allStages,
      disciplines: allDisciplines,
      members: allMembers,
    });

    const version = await this.dependencies.billVersionRepository.findById(
      input.billVersionId,
    );

    if (!version || version.projectId !== input.projectId) {
      throw new AppError(404, "BILL_VERSION_NOT_FOUND", "Bill version not found");
    }

    const authorized =
      action === "view"
        ? authorizationService.canViewContext({
            projectId: input.projectId,
            stageCode: version.stageCode,
            disciplineCode: version.disciplineCode,
            userId: input.userId,
          })
        : authorizationService.canEditContext({
            projectId: input.projectId,
            stageCode: version.stageCode,
            disciplineCode: version.disciplineCode,
            userId: input.userId,
          });

    if (!authorized) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have permission to access this resource",
      );
    }

    return version;
  }
}
