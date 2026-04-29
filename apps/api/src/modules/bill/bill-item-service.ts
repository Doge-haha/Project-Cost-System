import { z } from "zod";

import { requireDependency } from "../../shared/dependency/require-dependency.js";
import { AppError } from "../../shared/errors/app-error.js";
import {
  divideDecimal,
  multiplyDecimal,
} from "../../shared/math/decimal-money.js";
import type { AuditLogService } from "../audit/audit-log-service.js";
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
import type { QuotaLineRepository } from "../quota/quota-line-repository.js";

export const createBillItemSchema = z.object({
  parentId: z.string().min(1).nullable(),
  itemCode: z.string().min(1),
  itemName: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  sortNo: z.number().int().min(1),
});

export const batchCreateRootBillItemsSchema = z.object({
  items: z
    .array(createBillItemSchema.omit({ parentId: true }))
    .min(1)
    .max(200),
});

export const updateBillItemSchema = createBillItemSchema;
export const updateBillItemManualPricingSchema = z.object({
  manualUnitPrice: z.number().positive().nullable(),
  reason: z.string().min(1).max(500),
});

export const moveBillItemSchema = z.object({
  parentId: z.string().min(1).nullable(),
  sortNo: z.number().int().min(1),
});

export const listProjectBillItemsSchema = z.object({
  billVersionId: z.string().min(1).optional(),
  stageCode: z.string().min(1).optional(),
  disciplineCode: z.string().min(1).optional(),
  keyword: z.string().min(1).optional(),
});

type Dependencies = {
  projectRepository: ProjectRepository;
  projectStageRepository: ProjectStageRepository;
  projectDisciplineRepository: ProjectDisciplineRepository;
  projectMemberRepository: ProjectMemberRepository;
  billVersionRepository: BillVersionRepository;
  billWorkItemRepository?: BillWorkItemRepository;
  quotaLineRepository?: QuotaLineRepository;
};

export type BillItemTreeNode = BillItemRecord & {
  children: BillItemTreeNode[];
};

export class BillItemService {
  private readonly auditLogService: AuditLogService;

  constructor(
    private readonly billItemRepository: BillItemRepository,
    private readonly dependencies: Dependencies,
    auditLogService?: AuditLogService,
  ) {
    this.auditLogService = requireDependency(
      auditLogService,
      "auditLogService",
    );
  }

  async listBillItems(input: {
    projectId: string;
    billVersionId: string;
    userId: string;
  }): Promise<BillItemRecord[]> {
    const version = await this.getAuthorizedVersion(input, "view");
    return this.billItemRepository.listByBillVersionId(version.id);
  }

  async listBillItemTree(input: {
    projectId: string;
    billVersionId: string;
    userId: string;
  }): Promise<BillItemTreeNode[]> {
    const items = await this.listBillItems(input);
    return this.buildBillItemTree(items);
  }

  async listProjectBillItems(input: {
    projectId: string;
    billVersionId?: string;
    stageCode?: string;
    disciplineCode?: string;
    keyword?: string;
    userId: string;
  }): Promise<BillItemRecord[]> {
    if (input.billVersionId) {
      const version = await this.getAuthorizedVersion(
        {
          projectId: input.projectId,
          billVersionId: input.billVersionId,
          userId: input.userId,
        },
        "view",
      );
      if (input.stageCode && version.stageCode !== input.stageCode) {
        return [];
      }
      if (input.disciplineCode && version.disciplineCode !== input.disciplineCode) {
        return [];
      }
      return this.filterBillItemsByKeyword(
        await this.billItemRepository.listByBillVersionId(version.id),
        input.keyword,
      );
    }

    const project = await this.dependencies.projectRepository.findById(input.projectId);
    if (!project) {
      throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
    }

    const [allStages, allDisciplines, allMembers, versions] = await Promise.all([
      this.dependencies.projectStageRepository.listByProjectId(input.projectId),
      this.dependencies.projectDisciplineRepository.listByProjectId(input.projectId),
      this.dependencies.projectMemberRepository.listByProjectId(input.projectId),
      this.dependencies.billVersionRepository.listByProjectId(input.projectId),
    ]);
    const authorizationService = new ProjectAuthorizationService({
      stages: allStages,
      disciplines: allDisciplines,
      members: allMembers,
    });
    const visibleVersions = versions.filter((version) => {
      if (input.stageCode && version.stageCode !== input.stageCode) {
        return false;
      }
      if (input.disciplineCode && version.disciplineCode !== input.disciplineCode) {
        return false;
      }
      return authorizationService.canViewContext({
        projectId: input.projectId,
        stageCode: version.stageCode,
        disciplineCode: version.disciplineCode,
        userId: input.userId,
      });
    });
    const items = (
      await Promise.all(
        visibleVersions.map((version) =>
          this.billItemRepository.listByBillVersionId(version.id),
        ),
      )
    ).flat();

    return this.filterBillItemsByKeyword(items, input.keyword);
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
    await this.assertUniqueItemCode({
      billVersionId: version.id,
      itemCode: input.itemCode,
    });

    const created = await this.billItemRepository.create({
      billVersionId: version.id,
      parentId: input.parentId,
      itemCode: input.itemCode,
      itemName: input.itemName,
      quantity: input.quantity,
      unit: input.unit,
      sortNo: input.sortNo,
    });

    await this.auditLogService.writeAuditLog({
      projectId: input.projectId,
      stageCode: version.stageCode,
      resourceType: "bill_item",
      resourceId: created.id,
      action: "create",
      operatorId: input.userId,
      afterPayload: created,
    });

    return created;
  }

  async batchCreateRootBillItems(input: {
    projectId: string;
    billVersionId: string;
    items: Array<{
      itemCode: string;
      itemName: string;
      quantity: number;
      unit: string;
      sortNo: number;
    }>;
    userId: string;
  }): Promise<BillItemRecord[]> {
    const version = await this.getAuthorizedVersion(input, "edit");

    if (version.versionStatus !== "editable") {
      throw new AppError(
        423,
        "RESOURCE_LOCKED",
        "Bill version is not editable in its current status",
      );
    }

    const existingItems = await this.billItemRepository.listByBillVersionId(version.id);
    const existingCodes = new Set(existingItems.map((item) => item.itemCode));
    const incomingCodes = new Set<string>();
    for (const item of input.items) {
      if (existingCodes.has(item.itemCode) || incomingCodes.has(item.itemCode)) {
        throw new AppError(
          422,
          "VALIDATION_ERROR",
          "Duplicate bill item code is not allowed in the same version",
        );
      }
      incomingCodes.add(item.itemCode);
    }

    const created: BillItemRecord[] = [];
    for (const item of input.items) {
      created.push(
        await this.billItemRepository.create({
          billVersionId: version.id,
          parentId: null,
          itemCode: item.itemCode,
          itemName: item.itemName,
          quantity: item.quantity,
          unit: item.unit,
          sortNo: item.sortNo,
        }),
      );
    }

    await this.auditLogService.writeAuditLog({
      projectId: input.projectId,
      stageCode: version.stageCode,
      resourceType: "bill_item",
      resourceId: version.id,
      action: "create",
      operatorId: input.userId,
      afterPayload: {
        billVersionId: version.id,
        createdItemCount: created.length,
        itemIds: created.map((item) => item.id),
      },
    });

    return created;
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
      await this.assertParentDoesNotCreateCycle({
        billVersionId: version.id,
        itemId: existingItem.id,
        parentId: parentItem.id,
      });
    }
    await this.assertUniqueItemCode({
      billVersionId: version.id,
      itemCode: input.itemCode,
      excludeItemId: existingItem.id,
    });

    const before = { ...existingItem };
    const updated = await this.billItemRepository.update(input.itemId, {
      billVersionId: version.id,
      parentId: input.parentId,
      itemCode: input.itemCode,
      itemName: input.itemName,
      quantity: input.quantity,
      unit: input.unit,
      sortNo: input.sortNo,
    });

    await this.auditLogService.writeAuditLog({
      projectId: input.projectId,
      stageCode: version.stageCode,
      resourceType: "bill_item",
      resourceId: updated.id,
      action: "update",
      operatorId: input.userId,
      beforePayload: before,
      afterPayload: updated,
    });

    return updated;
  }

  async moveBillItem(input: {
    projectId: string;
    billVersionId: string;
    itemId: string;
    parentId: string | null;
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
      await this.assertParentDoesNotCreateCycle({
        billVersionId: version.id,
        itemId: existingItem.id,
        parentId: parentItem.id,
      });
    }

    const before = { ...existingItem };
    const updated = await this.billItemRepository.update(input.itemId, {
      billVersionId: version.id,
      parentId: input.parentId,
      itemCode: existingItem.itemCode,
      itemName: existingItem.itemName,
      quantity: existingItem.quantity,
      unit: existingItem.unit,
      sortNo: input.sortNo,
      sourceBillId: existingItem.sourceBillId,
      sourceSequence: existingItem.sourceSequence,
      sourceLevelCode: existingItem.sourceLevelCode,
      isMeasureItem: existingItem.isMeasureItem,
      sourceReferencePrice: existingItem.sourceReferencePrice,
      sourceFeeId: existingItem.sourceFeeId,
      measureCategory: existingItem.measureCategory,
      measureFeeFlag: existingItem.measureFeeFlag,
      measureCategorySubtype: existingItem.measureCategorySubtype,
      featureRuleText: existingItem.featureRuleText,
      systemUnitPrice: existingItem.systemUnitPrice,
      manualUnitPrice: existingItem.manualUnitPrice,
      finalUnitPrice: existingItem.finalUnitPrice,
      systemAmount: existingItem.systemAmount,
      finalAmount: existingItem.finalAmount,
      calculatedAt: existingItem.calculatedAt,
    });

    await this.auditLogService.writeAuditLog({
      projectId: input.projectId,
      stageCode: version.stageCode,
      resourceType: "bill_item",
      resourceId: updated.id,
      action: "update",
      operatorId: input.userId,
      beforePayload: before,
      afterPayload: updated,
    });

    return updated;
  }

  async updateBillItemManualPricing(input: {
    projectId: string;
    billVersionId: string;
    itemId: string;
    manualUnitPrice: number | null;
    reason: string;
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
    const finalAmount = multiplyDecimal(finalUnitPrice, existingItem.quantity, 2);

    const before = { ...existingItem };
    const updated = await this.billItemRepository.updateManualPricing(input.itemId, {
      manualUnitPrice: input.manualUnitPrice,
      finalUnitPrice: divideDecimal(finalAmount, existingItem.quantity, 6),
      finalAmount,
      calculatedAt: new Date().toISOString(),
    });

    const version = await this.dependencies.billVersionRepository.findById(
      existingItem.billVersionId,
    );

    await this.auditLogService.writeAuditLog({
      projectId: input.projectId,
      stageCode: version?.stageCode ?? null,
      resourceType: "bill_item",
      resourceId: updated.id,
      action: "manual_pricing",
      operatorId: input.userId,
      beforePayload: before,
      afterPayload: {
        ...updated,
        reason: input.reason,
      },
    });

    return updated;
  }

  async deleteBillItem(input: {
    projectId: string;
    billVersionId: string;
    itemId: string;
    userId: string;
  }): Promise<void> {
    const { version, billItem } = await this.getEditableBillItemContext(input);
    const siblingItems = await this.billItemRepository.listByBillVersionId(version.id);
    if (siblingItems.some((item) => item.parentId === billItem.id)) {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "Parent bill items cannot be deleted before child items",
      );
    }

    await this.dependencies.billWorkItemRepository?.deleteByBillItemId(billItem.id);
    await this.dependencies.quotaLineRepository?.deleteByBillItemId(billItem.id);
    await this.billItemRepository.delete(billItem.id);

    await this.auditLogService.writeAuditLog({
      projectId: input.projectId,
      stageCode: version.stageCode,
      resourceType: "bill_item",
      resourceId: billItem.id,
      action: "delete",
      operatorId: input.userId,
      beforePayload: billItem,
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

  private async assertUniqueItemCode(input: {
    billVersionId: string;
    itemCode: string;
    excludeItemId?: string;
  }): Promise<void> {
    const items = await this.billItemRepository.listByBillVersionId(
      input.billVersionId,
    );
    const duplicate = items.find(
      (item) =>
        item.itemCode === input.itemCode && item.id !== input.excludeItemId,
    );
    if (duplicate) {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "Duplicate bill item code is not allowed in the same version",
      );
    }
  }

  private async assertParentDoesNotCreateCycle(input: {
    billVersionId: string;
    itemId: string;
    parentId: string;
  }): Promise<void> {
    if (input.itemId === input.parentId) {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "Bill item parent cannot be itself or one of its descendants",
      );
    }

    const items = await this.billItemRepository.listByBillVersionId(
      input.billVersionId,
    );
    const itemsById = new Map(items.map((item) => [item.id, item]));
    let currentParentId: string | null = input.parentId;
    while (currentParentId) {
      if (currentParentId === input.itemId) {
        throw new AppError(
          422,
          "VALIDATION_ERROR",
          "Bill item parent cannot be itself or one of its descendants",
        );
      }
      currentParentId = itemsById.get(currentParentId)?.parentId ?? null;
    }
  }

  private filterBillItemsByKeyword(
    items: BillItemRecord[],
    keyword?: string,
  ): BillItemRecord[] {
    const normalizedKeyword = keyword?.trim().toLowerCase();
    if (!normalizedKeyword) {
      return items;
    }

    return items.filter(
      (item) =>
        item.itemCode.toLowerCase().includes(normalizedKeyword) ||
        item.itemName.toLowerCase().includes(normalizedKeyword),
    );
  }

  private buildBillItemTree(items: BillItemRecord[]): BillItemTreeNode[] {
    const nodesById = new Map<string, BillItemTreeNode>(
      items.map((item) => [item.id, { ...item, children: [] }]),
    );
    const roots: BillItemTreeNode[] = [];

    for (const item of items) {
      const node = nodesById.get(item.id)!;
      if (item.parentId && nodesById.has(item.parentId)) {
        nodesById.get(item.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    const sortNodes = (nodes: BillItemTreeNode[]) => {
      nodes.sort((left, right) => left.sortNo - right.sortNo || left.id.localeCompare(right.id));
      for (const node of nodes) {
        sortNodes(node.children);
      }
    };
    sortNodes(roots);

    return roots;
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
