import { z } from "zod";

import { AppError } from "../../shared/errors/app-error.js";
import { ProjectAuthorizationService } from "../project/project-authorization-service.js";
import type { ProjectRepository } from "../project/project-repository.js";
import type { ProjectStageRepository } from "../project/project-stage-repository.js";
import type { ProjectDisciplineRepository } from "../project/project-discipline-repository.js";
import type { ProjectMemberRepository } from "../project/project-member-repository.js";
import type {
  BillItemRecord,
  BillItemRepository,
} from "./bill-item-repository.js";
import type { BillWorkItemRepository } from "./bill-work-item-repository.js";
import type {
  BillVersionRecord,
  BillVersionRepository,
} from "./bill-version-repository.js";

export const billVersionContextSchema = z.object({
  stageCode: z.string().min(1),
  disciplineCode: z.string().min(1),
});

export const createBillVersionSchema = billVersionContextSchema.extend({
  versionName: z.string().min(1),
});

type AuthorizationDependencies = {
  projectRepository: ProjectRepository;
  projectStageRepository: ProjectStageRepository;
  projectDisciplineRepository: ProjectDisciplineRepository;
  projectMemberRepository: ProjectMemberRepository;
  billItemRepository: BillItemRepository;
  billWorkItemRepository: BillWorkItemRepository;
};

export type BillVersionValidationIssue = {
  code: "EMPTY_VERSION" | "DUPLICATE_ITEM_CODE" | "MISSING_WORK_ITEMS";
  severity: "error" | "warning";
  message: string;
  itemCode?: string;
};

export type BillVersionValidationSummary = {
  passed: boolean;
  errorCount: number;
  warningCount: number;
  issues: BillVersionValidationIssue[];
};

export class BillVersionService {
  constructor(
    private readonly billVersionRepository: BillVersionRepository,
    private readonly dependencies: AuthorizationDependencies,
  ) {}

  async listBillVersions(input: {
    projectId: string;
    stageCode: string;
    disciplineCode: string;
    userId: string;
  }): Promise<BillVersionRecord[]> {
    await this.assertProjectExists(input.projectId);
    await this.assertCanView(input);

    return this.billVersionRepository.listByContext(input);
  }

  async createBillVersion(input: {
    projectId: string;
    stageCode: string;
    disciplineCode: string;
    versionName: string;
    userId: string;
  }): Promise<BillVersionRecord> {
    await this.assertProjectExists(input.projectId);
    await this.assertCanEdit(input);

    return this.billVersionRepository.create({
      projectId: input.projectId,
      stageCode: input.stageCode,
      disciplineCode: input.disciplineCode,
      versionName: input.versionName,
    });
  }

  async copyFromVersion(input: {
    projectId: string;
    sourceBillVersionId: string;
    userId: string;
  }): Promise<BillVersionRecord> {
    const sourceVersion = await this.getAuthorizedVersion(
      {
        projectId: input.projectId,
        billVersionId: input.sourceBillVersionId,
        userId: input.userId,
      },
      "edit",
    );

    const created = await this.billVersionRepository.create({
      projectId: sourceVersion.projectId,
      stageCode: sourceVersion.stageCode,
      disciplineCode: sourceVersion.disciplineCode,
      versionName: `${sourceVersion.versionName} - Copy`,
      sourceVersionId: sourceVersion.id,
    });

    const sourceItems = await this.dependencies.billItemRepository.listByBillVersionId(
      sourceVersion.id,
    );
    const createdBySourceId = new Map<string, BillItemRecord>();

    for (const sourceItem of sourceItems) {
      const cloned = await this.dependencies.billItemRepository.create({
        billVersionId: created.id,
        parentId: null,
        itemCode: sourceItem.itemCode,
        itemName: sourceItem.itemName,
        quantity: sourceItem.quantity,
        unit: sourceItem.unit,
        sortNo: sourceItem.sortNo,
      });
      createdBySourceId.set(sourceItem.id, cloned);
    }

    for (const sourceItem of sourceItems) {
      if (!sourceItem.parentId) {
        continue;
      }
      const cloned = createdBySourceId.get(sourceItem.id)!;
      const clonedParent = createdBySourceId.get(sourceItem.parentId)!;
      await this.dependencies.billItemRepository.update(cloned.id, {
        billVersionId: created.id,
        parentId: clonedParent.id,
        itemCode: cloned.itemCode,
        itemName: cloned.itemName,
        quantity: cloned.quantity,
        unit: cloned.unit,
        sortNo: cloned.sortNo,
      });
    }

    for (const sourceItem of sourceItems) {
      const cloned = createdBySourceId.get(sourceItem.id)!;
      await this.dependencies.billWorkItemRepository.cloneByBillItemId(
        sourceItem.id,
        cloned.id,
      );
    }

    return created;
  }

  async getValidationSummary(input: {
    projectId: string;
    billVersionId: string;
    userId: string;
  }): Promise<BillVersionValidationSummary> {
    const version = await this.getAuthorizedVersion(input, "view");
    const items = await this.dependencies.billItemRepository.listByBillVersionId(
      version.id,
    );

    const issues = await this.validateItems(items);
    return {
      passed: issues.every((issue) => issue.severity !== "error"),
      errorCount: issues.filter((issue) => issue.severity === "error").length,
      warningCount: issues.filter((issue) => issue.severity === "warning").length,
      issues,
    };
  }

  async submitBillVersion(input: {
    projectId: string;
    billVersionId: string;
    userId: string;
  }): Promise<BillVersionRecord> {
    const version = await this.getAuthorizedVersion(input, "edit");
    const summary = await this.getValidationSummary(input);

    if (!summary.passed) {
      throw new AppError(422, "VALIDATION_ERROR", "Bill version cannot be submitted", summary.issues);
    }

    return this.billVersionRepository.updateStatus({
      versionId: version.id,
      versionStatus: "submitted",
    });
  }

  async getSourceChain(input: {
    projectId: string;
    billVersionId: string;
    userId: string;
  }): Promise<BillVersionRecord[]> {
    const version = await this.getAuthorizedVersion(input, "view");
    const chain: BillVersionRecord[] = [version];

    let current = version;
    while (current.sourceVersionId) {
      const parent = await this.billVersionRepository.findById(current.sourceVersionId);
      if (!parent || parent.projectId !== input.projectId) {
        break;
      }
      chain.push(parent);
      current = parent;
    }

    return chain;
  }

  async withdrawBillVersion(input: {
    projectId: string;
    billVersionId: string;
    userId: string;
  }): Promise<BillVersionRecord> {
    const version = await this.getAuthorizedVersion(input, "edit");

    if (version.versionStatus !== "submitted") {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "Only submitted bill versions can be withdrawn",
      );
    }

    return this.billVersionRepository.updateStatus({
      versionId: version.id,
      versionStatus: "editable",
    });
  }

  private async assertProjectExists(projectId: string): Promise<void> {
    const project = await this.dependencies.projectRepository.findById(projectId);
    if (!project) {
      throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
    }
  }

  async getAuthorizedVersion(
    input: {
      projectId: string;
      billVersionId: string;
      userId: string;
    },
    action: "view" | "edit",
  ): Promise<BillVersionRecord> {
    await this.assertProjectExists(input.projectId);
    const version = await this.billVersionRepository.findById(input.billVersionId);

    if (!version || version.projectId !== input.projectId) {
      throw new AppError(404, "BILL_VERSION_NOT_FOUND", "Bill version not found");
    }

    const authorizationService = await this.createAuthorizationService(
      input.projectId,
    );

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

  private async createAuthorizationService(projectId: string) {
    const [stages, disciplines, members] = await Promise.all([
      this.dependencies.projectStageRepository.listByProjectId(projectId),
      this.dependencies.projectDisciplineRepository.listByProjectId(projectId),
      this.dependencies.projectMemberRepository.listByProjectId(projectId),
    ]);

    return new ProjectAuthorizationService({
      stages,
      disciplines,
      members,
    });
  }

  private async assertCanView(input: {
    projectId: string;
    stageCode: string;
    disciplineCode: string;
    userId: string;
  }): Promise<void> {
    const authorizationService = await this.createAuthorizationService(
      input.projectId,
    );

    if (!authorizationService.canViewContext(input)) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have permission to access this resource",
      );
    }
  }

  private async assertCanEdit(input: {
    projectId: string;
    stageCode: string;
    disciplineCode: string;
    userId: string;
  }): Promise<void> {
    const authorizationService = await this.createAuthorizationService(
      input.projectId,
    );

    if (!authorizationService.canEditContext(input)) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have permission to access this resource",
      );
    }
  }

  private async validateItems(
    items: BillItemRecord[],
  ): Promise<BillVersionValidationIssue[]> {
    if (items.length === 0) {
      return [
        {
          code: "EMPTY_VERSION",
          severity: "error",
          message: "Bill version must contain at least one item before submission",
        },
      ];
    }

    const counts = new Map<string, number>();
    for (const item of items) {
      counts.set(item.itemCode, (counts.get(item.itemCode) ?? 0) + 1);
    }

    const duplicateCode = [...counts.entries()].find(([, count]) => count > 1)?.[0];
    if (duplicateCode) {
      return [
        {
          code: "DUPLICATE_ITEM_CODE",
          severity: "error",
          message: "Duplicate bill item code detected",
          itemCode: duplicateCode,
        },
      ];
    }

    const warnings: BillVersionValidationIssue[] = [];
    for (const item of items) {
      const workItems =
        await this.dependencies.billWorkItemRepository.listByBillItemId(item.id);
      if (workItems.length === 0) {
        warnings.push({
          code: "MISSING_WORK_ITEMS",
          severity: "warning",
          message: "Bill item has no work items",
          itemCode: item.itemCode,
        });
      }
    }

    return warnings;
  }
}
