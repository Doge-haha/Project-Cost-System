import { z } from "zod";

import { AppError } from "../../shared/errors/app-error.js";
import type { AuditLogService } from "../audit/audit-log-service.js";
import type { ImportTaskRecord } from "../import/import-task-repository.js";
import type { ImportTaskService } from "../import/import-task-service.js";
import { ProjectAuthorizationService } from "../project/project-authorization-service.js";
import type { ProjectDisciplineRepository } from "../project/project-discipline-repository.js";
import type { ProjectMemberRepository } from "../project/project-member-repository.js";
import type { ProjectRepository } from "../project/project-repository.js";
import type { ProjectStageRepository } from "../project/project-stage-repository.js";
import type { BillItemRecord, BillItemRepository } from "./bill-item-repository.js";
import type { BillVersionRecord, BillVersionRepository } from "./bill-version-repository.js";
import type { BillWorkItemRecord, BillWorkItemRepository } from "./bill-work-item-repository.js";

const sourceRowSchema = z.record(z.string(), z.unknown());
const sourceTablesSchema = z.object({
  ZaoJia_Qd_QdList: z.array(sourceRowSchema).default([]),
  ZaoJia_Qd_Qdxm: z.array(sourceRowSchema).default([]),
  ZaoJia_Qd_Gznr: z.array(sourceRowSchema).default([]),
});

export const sourceBillImportSchema = z.object({
  stageCode: z.string().min(1),
  disciplineCode: z.string().min(1),
  versionName: z.string().min(1).optional(),
  sourceFileName: z.string().min(1).optional(),
  sourceFileContent: z.string().min(1).optional(),
  sourceBatchNo: z.string().min(1).optional(),
  sourceTables: sourceTablesSchema.optional(),
});

type SourceBillImportPayload = z.infer<typeof sourceBillImportSchema>;

export type SourceBillFailureItem = {
  lineNo: number | null;
  tableName: string;
  sourceId: string | null;
  itemCode: string | null;
  reasonCode:
    | "missing_field"
    | "duplicate_code"
    | "unmapped_parent"
    | "unmapped_work_item"
    | "parse_error";
  reasonLabel: string;
  errorMessage: string;
  projectId: string | null;
  resourceType: "bill_version" | "bill_item" | "bill_work_item" | "source_bill";
  action: "preview" | "create" | "link";
  keys: string[];
  retryEventSnapshot: Record<string, unknown> | null;
};

export type SourceBillImportPreview = {
  summary: {
    versionCount: number;
    billItemCount: number;
    workItemCount: number;
    failedItemCount: number;
    measureItemCount: number;
    feeItemCount: number;
    featureItemCount: number;
    quotaClueCount: number;
    failureDetails: string[];
  };
  failedItems: SourceBillFailureItem[];
};

export type SourceBillImportResult = {
  billVersion: BillVersionRecord;
  importTask: ImportTaskRecord;
  summary: {
    versionCount: number;
    billItemCount: number;
    workItemCount: number;
    failedItemCount: number;
    measureItemCount: number;
    feeItemCount: number;
    featureItemCount: number;
    quotaClueCount: number;
    failureDetails: string[];
  };
  failedItems: SourceBillFailureItem[];
  imported: {
    billItems: BillItemRecord[];
    workItems: BillWorkItemRecord[];
  };
};

type Dependencies = {
  projectRepository: ProjectRepository;
  projectStageRepository: ProjectStageRepository;
  projectDisciplineRepository: ProjectDisciplineRepository;
  projectMemberRepository: ProjectMemberRepository;
  billVersionRepository: BillVersionRepository;
  billItemRepository: BillItemRepository;
  billWorkItemRepository: BillWorkItemRepository;
  importTaskService: ImportTaskService;
  auditLogService: AuditLogService;
};

export class BillSourceImportService {
  constructor(private readonly dependencies: Dependencies) {}

  async previewSourceBill(input: SourceBillImportPayload & {
    projectId: string;
    userId: string;
  }): Promise<SourceBillImportPreview> {
    await this.assertCanImport(input);
    const parsed = parseSourceBill(input);

    return {
      summary: buildSummary(parsed, parsed.failures.length, []),
      failedItems: parsed.failures,
    };
  }

  async importSourceBill(input: SourceBillImportPayload & {
    projectId: string;
    userId: string;
  }): Promise<SourceBillImportResult> {
    await this.assertCanImport(input);

    const parsed = parseSourceBill(input);
    const { sourceTables, failures } = parsed;
    const qdListRows = sourceTables.ZaoJia_Qd_QdList;
    const qdxmRows = sourceTables.ZaoJia_Qd_Qdxm;
    const gznrRows = sourceTables.ZaoJia_Qd_Gznr;
    const firstList = qdListRows[0] ?? {};
    const sourceSpecCode = readString(firstList, ["QdGf", "qdGf", "specCode"]);
    const sourceSpecName = readString(firstList, ["Qdmc", "QdMc", "qdMc", "specName"]);
    const sourceBillId = readString(firstList, ["QdID", "QdId", "qdId", "id"]);
    const stages = await this.dependencies.projectStageRepository.listByProjectId(
      input.projectId,
    );
    const sourceStageId =
      stages.find((stage) => stage.stageCode === input.stageCode)?.id ?? null;

    const billVersion = await this.dependencies.billVersionRepository.create({
      projectId: input.projectId,
      stageCode: input.stageCode,
      disciplineCode: input.disciplineCode,
      versionName:
        input.versionName ??
        sourceSpecName ??
        `源清单导入 ${new Date().toISOString().slice(0, 10)}`,
      sourceStageId,
      sourceVersionId: sourceBillId,
      sourceSpecCode,
      sourceSpecName,
      sourceVisibleFlag: readBoolean(firstList, ["Visible", "visible"]) ?? true,
      sourceDefaultFlag: readBoolean(firstList, ["DefaultFlag", "defaultFlag"]) ?? false,
    });
    for (const [index, row] of qdListRows.slice(1).entries()) {
      await this.dependencies.billVersionRepository.create({
        projectId: input.projectId,
        stageCode: input.stageCode,
        disciplineCode: input.disciplineCode,
        versionName:
          readString(row, ["Qdmc", "QdMc", "qdMc", "specName"]) ??
          `${billVersion.versionName}-${index + 2}`,
        sourceStageId,
        sourceVersionId: readString(row, ["QdID", "QdId", "qdId", "id"]),
        sourceSpecCode: readString(row, ["QdGf", "qdGf", "specCode"]),
        sourceSpecName: readString(row, ["Qdmc", "QdMc", "qdMc", "specName"]),
        sourceVisibleFlag: readBoolean(row, ["Visible", "visible"]) ?? true,
        sourceDefaultFlag: readBoolean(row, ["DefaultFlag", "defaultFlag"]) ?? false,
      });
    }

    const importTask = await this.dependencies.importTaskService.createImportTask({
      projectId: input.projectId,
      sourceType: "source_bill",
      sourceLabel: sourceSpecName ?? input.versionName ?? "源清单导入",
      sourceFileName: input.sourceFileName ?? null,
      sourceBatchNo: input.sourceBatchNo ?? sourceBillId ?? null,
      totalItemCount: qdListRows.length + qdxmRows.length + gznrRows.length,
      metadata: {
        createdFrom: "bill_source_import",
        billVersionId: billVersion.id,
        sourceTables: {
          ZaoJia_Qd_QdList: qdListRows.length,
          ZaoJia_Qd_Qdxm: qdxmRows.length,
          ZaoJia_Qd_Gznr: gznrRows.length,
        },
      },
      requestedBy: input.userId,
    });

    const createdItems: BillItemRecord[] = [];
    const itemsBySourceId = new Map<string, BillItemRecord>();

    for (const [index, row] of qdxmRows.entries()) {
      const sourceId = readString(row, ["QdID", "QdId", "qdId", "id", "billId"]);
      const itemCode = readString(row, ["Qdbh", "qdBh", "code", "itemCode"]);
      const itemName = readString(row, ["Xmmc", "xmMc", "name", "itemName"]);
      const unit = readString(row, ["Dw", "dw", "unit", "unitName"]);
      if (!sourceId || !itemCode || !itemName || !unit) {
        failures.push(buildFailure({
          tableName: "ZaoJia_Qd_Qdxm",
          row,
          index,
          reasonCode: "missing_field",
          resourceType: "bill_item",
          action: "create",
          errorMessage: "缺少必填字段 QdID/Qdbh/Xmmc/Dw",
          keys: ["QdID", "Qdbh", "Xmmc", "Dw"],
        }));
        continue;
      }

      const created = await this.dependencies.billItemRepository.create({
        billVersionId: billVersion.id,
        parentId: null,
        itemCode,
        itemName,
        quantity: readNumber(row, ["Gcl", "gcl", "Sl", "sl", "quantity"]) ?? 0,
        unit,
        sortNo: readNumber(row, ["Sjxh", "sjxh", "orderNo", "sequence"]) ?? createdItems.length + 1,
        sourceBillId: sourceId,
        sourceSequence: readNumber(row, ["Sjxh", "sjxh", "orderNo", "sequence"]),
        sourceLevelCode: readString(row, ["Fbcch", "Qdbh", "qdBh", "levelCode", "code"]),
        isMeasureItem: readBoolean(row, [
          "IsMeasure",
          "isMeasureItem",
          "MeasureFlag",
          "measureFlag",
          "Sfcx",
          "sfcx",
        ]),
        sourceReferencePrice: readNumber(row, [
          "Zhdj",
          "zhdj",
          "referencePrice",
          "sourceReferencePrice",
        ]),
        sourceFeeId: readString(row, ["FyID", "FyId", "fyId", "feeId", "sourceFeeId"]),
        measureCategory: readString(row, [
          "Csxfl",
          "csxfl",
          "measureCategory",
          "measureType",
        ]),
        measureFeeFlag: readBoolean(row, [
          "IsFee",
          "isFeeItem",
          "FeeFlag",
          "feeFlag",
          "Fyx",
          "fyx",
        ]),
        measureCategorySubtype: readString(row, [
          "Csxzfl",
          "csxzfl",
          "measureCategorySubtype",
          "measureSubtype",
        ]),
        featureRuleText: buildFeatureRuleText(row),
      });
      createdItems.push(created);
      itemsBySourceId.set(sourceId, created);
    }

    for (const [index, row] of qdxmRows.entries()) {
      const sourceId = readString(row, ["QdID", "QdId", "qdId", "id", "billId"]);
      const parentSourceId = readString(row, [
        "ParentQdID",
        "ParentQdId",
        "parentQdId",
        "parentId",
        "Fjxh",
        "fjxh",
      ]);
      if (!sourceId || !parentSourceId) {
        continue;
      }
      const item = itemsBySourceId.get(sourceId);
      const parent = itemsBySourceId.get(parentSourceId);
      if (!item || !parent) {
        failures.push(buildFailure({
          tableName: "ZaoJia_Qd_Qdxm",
          row,
          index,
          reasonCode: "unmapped_parent",
          resourceType: "bill_item",
          action: "link",
          errorMessage: `父级 ${parentSourceId} 无法映射`,
          keys: ["ParentQdID", "parentId", "Fjxh"],
        }));
        continue;
      }
      const updated = await this.dependencies.billItemRepository.update(item.id, {
        ...item,
        parentId: parent.id,
      });
      itemsBySourceId.set(sourceId, updated);
      const createdIndex = createdItems.findIndex((candidate) => candidate.id === item.id);
      if (createdIndex >= 0) {
        createdItems[createdIndex] = updated;
      }
    }

    const createdWorkItems: BillWorkItemRecord[] = [];
    for (const [index, row] of gznrRows.entries()) {
      const sourceId = readString(row, ["QdID", "QdId", "qdId", "billId", "id"]);
      const workContent = readString(row, ["Gznr", "gznr", "content", "workContent"]);
      if (!sourceId || !workContent) {
        failures.push(buildFailure({
          tableName: "ZaoJia_Qd_Gznr",
          row,
          index,
          reasonCode: "missing_field",
          resourceType: "bill_work_item",
          action: "create",
          errorMessage: "缺少必填字段 QdID/Gznr",
          keys: ["QdID", "Gznr"],
        }));
        continue;
      }
      const billItem = itemsBySourceId.get(sourceId);
      if (!billItem) {
        failures.push(buildFailure({
          tableName: "ZaoJia_Qd_Gznr",
          row,
          index,
          reasonCode: "unmapped_work_item",
          resourceType: "bill_work_item",
          action: "link",
          errorMessage: `QdID ${sourceId} 无法挂接清单项`,
          keys: ["QdID"],
        }));
        continue;
      }
      createdWorkItems.push(
        await this.dependencies.billWorkItemRepository.create({
          billItemId: billItem.id,
          workContent,
          sortNo: readNumber(row, ["Sjxh", "sjxh", "orderNo", "sequence"]) ?? createdWorkItems.length + 1,
          sourceSpecCode,
          sourceBillId: sourceId,
        }),
      );
    }

    const failureDetails = failures.map(formatFailureDetail).slice(0, 20);
    const summary = buildSummary(parsed, failures.length, [
      ...createdItems,
    ]);
    const finishedTask =
      await this.dependencies.importTaskService.finishImportTaskWithSummary({
        taskId: importTask.id,
        jobId: `sync-bill-import-${billVersion.id}`,
        status: failures.length > 0 ? "failed" : "completed",
        importedItemCount: createdItems.length + createdWorkItems.length,
        failedItemCount: failures.length,
        failureDetails,
        latestErrorMessage: failureDetails[0] ?? null,
        metadata: {
          billVersionId: billVersion.id,
          summary,
          failedItems: failures,
          failureSummary: buildFailureSummary(failures),
          failureSnapshots: failures
            .filter((failure) => failure.retryEventSnapshot)
            .map((failure) => ({
              lineNo: failure.lineNo,
              reasonCode: failure.reasonCode,
              resourceType: failure.resourceType,
              action: failure.action,
              retryEventSnapshot: failure.retryEventSnapshot,
            })),
        },
      });

    await this.dependencies.auditLogService.writeAuditLog({
      projectId: input.projectId,
      stageCode: input.stageCode,
      resourceType: "import_task",
      resourceId: finishedTask.id,
      action: "bill_import",
      operatorId: input.userId,
      afterPayload: {
        billVersionId: billVersion.id,
        sourceSpecCode,
        sourceSpecName,
        versionCount: summary.versionCount,
        billItemCount: summary.billItemCount,
        workItemCount: summary.workItemCount,
        failedItemCount: failures.length,
      },
    });

    return {
      billVersion,
      importTask: finishedTask,
      summary: {
        ...summary,
        billItemCount: createdItems.length,
        workItemCount: createdWorkItems.length,
        failedItemCount: failures.length,
        failureDetails,
      },
      failedItems: failures,
      imported: {
        billItems: createdItems,
        workItems: createdWorkItems,
      },
    };
  }

  private async assertCanImport(input: {
    projectId: string;
    stageCode: string;
    disciplineCode: string;
    userId: string;
  }): Promise<void> {
    const project = await this.dependencies.projectRepository.findById(input.projectId);
    if (!project) {
      throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
    }

    const authorizationService = new ProjectAuthorizationService({
      stages: await this.dependencies.projectStageRepository.listByProjectId(input.projectId),
      disciplines: await this.dependencies.projectDisciplineRepository.listByProjectId(
        input.projectId,
      ),
      members: await this.dependencies.projectMemberRepository.listByProjectId(input.projectId),
    });

    if (!authorizationService.canEditContext(input)) {
      throw new AppError(403, "FORBIDDEN", "Current user lacks bill:import permission");
    }
  }
}

type ParsedSourceBill = {
  sourceTables: z.infer<typeof sourceTablesSchema>;
  failures: SourceBillFailureItem[];
  measureItemCount: number;
  feeItemCount: number;
  featureItemCount: number;
  quotaClueCount: number;
};

function parseSourceBill(input: SourceBillImportPayload): ParsedSourceBill {
  const sourceTables = normalizeSourceTables(input);
  const failures: SourceBillFailureItem[] = [];
  const codeCounts = new Map<string, number>();
  let measureItemCount = 0;
  let feeItemCount = 0;
  let featureItemCount = 0;
  let quotaClueCount = 0;

  for (const [index, row] of sourceTables.ZaoJia_Qd_Qdxm.entries()) {
    const itemCode = readString(row, ["Qdbh", "qdBh", "code", "itemCode"]);
    if (itemCode) {
      const nextCount = (codeCounts.get(itemCode) ?? 0) + 1;
      codeCounts.set(itemCode, nextCount);
      if (nextCount > 1) {
        failures.push(buildFailure({
          tableName: "ZaoJia_Qd_Qdxm",
          row,
          index,
          reasonCode: "duplicate_code",
          resourceType: "bill_item",
          action: "create",
          errorMessage: `重复编码 ${itemCode}，已按源行保留`,
          keys: ["Qdbh", "code", "itemCode"],
        }));
      }
    }
    if (isMeasureRow(row)) {
      measureItemCount += 1;
    }
    if (isFeeRow(row)) {
      feeItemCount += 1;
    }
    if (readString(row, featureKeys)) {
      featureItemCount += 1;
    }
    if (readString(row, quotaClueKeys)) {
      quotaClueCount += 1;
    }
  }

  return {
    sourceTables,
    failures,
    measureItemCount,
    feeItemCount,
    featureItemCount,
    quotaClueCount,
  };
}

const featureKeys = [
  "QdTz",
  "qdtz",
  "Xmtz",
  "xmtz",
  "项目特征",
  "feature",
  "featureText",
  "featureRuleText",
];

const calculationRuleKeys = [
  "Jsgz",
  "jsgz",
  "计算规则",
  "calculationRule",
  "calculationRuleText",
];

const quotaClueKeys = [
  "DeID",
  "DeId",
  "deId",
  "定额ID",
  "Debh",
  "deBh",
  "quotaCode",
  "quotaId",
  "quotaClue",
  "定额关联线索",
];

function buildSummary(
  parsed: ParsedSourceBill,
  failedItemCount: number,
  createdItems: BillItemRecord[],
) {
  return {
    versionCount: Math.max(parsed.sourceTables.ZaoJia_Qd_QdList.length, 1),
    billItemCount:
      createdItems.length > 0
        ? createdItems.length
        : parsed.sourceTables.ZaoJia_Qd_Qdxm.length,
    workItemCount: parsed.sourceTables.ZaoJia_Qd_Gznr.length,
    failedItemCount,
    measureItemCount: parsed.measureItemCount,
    feeItemCount: parsed.feeItemCount,
    featureItemCount: parsed.featureItemCount,
    quotaClueCount: parsed.quotaClueCount,
    failureDetails: parsed.failures.map(formatFailureDetail).slice(0, 20),
  };
}

function buildFailure(input: {
  tableName: string;
  row: Record<string, unknown>;
  index: number;
  reasonCode: SourceBillFailureItem["reasonCode"];
  resourceType: SourceBillFailureItem["resourceType"];
  action: SourceBillFailureItem["action"];
  errorMessage: string;
  keys: string[];
}): SourceBillFailureItem {
  const sourceId = readString(input.row, ["QdID", "QdId", "qdId", "id", "billId"]);
  return {
    lineNo: input.index + 1,
    tableName: input.tableName,
    sourceId,
    itemCode: readString(input.row, ["Qdbh", "qdBh", "code", "itemCode"]),
    reasonCode: input.reasonCode,
    reasonLabel: formatReasonLabel(input.reasonCode),
    errorMessage: input.errorMessage,
    projectId: null,
    resourceType: input.resourceType,
    action: input.action,
    keys: input.keys,
    retryEventSnapshot: {
      tableName: input.tableName,
      sourceId,
      itemCode: readString(input.row, ["Qdbh", "qdBh", "code", "itemCode"]),
      row: input.row,
    },
  };
}

function formatFailureDetail(failure: SourceBillFailureItem) {
  return `${failure.tableName}[${(failure.lineNo ?? 1) - 1}] ${failure.errorMessage}`;
}

function formatReasonLabel(reasonCode: SourceBillFailureItem["reasonCode"]) {
  if (reasonCode === "missing_field") {
    return "缺少必填字段";
  }
  if (reasonCode === "duplicate_code") {
    return "重复编码";
  }
  if (reasonCode === "unmapped_parent") {
    return "父级无法映射";
  }
  if (reasonCode === "unmapped_work_item") {
    return "工作内容无法挂接";
  }
  return "解析失败";
}

function buildFailureSummary(failures: SourceBillFailureItem[]) {
  const counts = new Map<string, { reasonCode: string; reasonLabel: string; count: number }>();
  for (const failure of failures) {
    const current = counts.get(failure.reasonCode) ?? {
      reasonCode: failure.reasonCode,
      reasonLabel: failure.reasonLabel,
      count: 0,
    };
    current.count += 1;
    counts.set(failure.reasonCode, current);
  }
  return [...counts.values()];
}

function buildFeatureRuleText(row: Record<string, unknown>) {
  const parts: string[] = [];
  const feature = readString(row, featureKeys);
  const calculationRule = readString(row, calculationRuleKeys);
  const quotaClue = readString(row, quotaClueKeys);
  if (feature) {
    parts.push(`清单特征：${feature}`);
  }
  if (calculationRule) {
    parts.push(`计算规则：${calculationRule}`);
  }
  if (quotaClue) {
    parts.push(`定额关联线索：${quotaClue}`);
  }
  return parts.length > 0 ? parts.join("\n") : null;
}

function isMeasureRow(row: Record<string, unknown>) {
  return (
    readBoolean(row, [
      "IsMeasure",
      "isMeasureItem",
      "MeasureFlag",
      "measureFlag",
      "Sfcx",
      "sfcx",
    ]) === true ||
    Boolean(
      readString(row, ["Csxfl", "csxfl", "measureCategory", "measureType"]),
    )
  );
}

function isFeeRow(row: Record<string, unknown>) {
  return (
    readBoolean(row, ["IsFee", "isFeeItem", "FeeFlag", "feeFlag", "Fyx", "fyx"]) ===
      true || Boolean(readString(row, ["FyID", "FyId", "fyId", "feeId", "sourceFeeId"]))
  );
}

function normalizeSourceTables(input: SourceBillImportPayload): z.infer<typeof sourceTablesSchema> {
  if (input.sourceTables) {
    return sourceTablesSchema.parse(input.sourceTables);
  }
  if (!input.sourceFileContent) {
    throw new AppError(400, "SOURCE_FILE_REQUIRED", "sourceTables or sourceFileContent is required");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.sourceFileContent);
  } catch {
    throw new AppError(400, "SOURCE_FILE_PARSE_ERROR", "Source bill file must be valid JSON");
  }

  const root =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  const rawTables =
    root.sourceTables && typeof root.sourceTables === "object"
      ? (root.sourceTables as Record<string, unknown>)
      : root;

  return sourceTablesSchema.parse({
    ZaoJia_Qd_QdList:
      readArray(rawTables, ["ZaoJia_Qd_QdList", "qdList", "billLists"]) ?? [],
    ZaoJia_Qd_Qdxm:
      readArray(rawTables, ["ZaoJia_Qd_Qdxm", "qdxm", "billItems", "items"]) ?? [],
    ZaoJia_Qd_Gznr:
      readArray(rawTables, ["ZaoJia_Qd_Gznr", "gznr", "workItems", "workContents"]) ?? [],
  });
}

function readArray(
  row: Record<string, unknown>,
  keys: string[],
): Array<Record<string, unknown>> | null {
  for (const key of keys) {
    const value = row[key];
    if (Array.isArray(value)) {
      return value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      );
    }
  }
  return null;
}

function readString(row: Record<string, unknown>, keys: string[]): string | null {
  const value = readValue(row, keys);
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function readNumber(row: Record<string, unknown>, keys: string[]): number | null {
  const value = readValue(row, keys);
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readBoolean(row: Record<string, unknown>, keys: string[]): boolean | null {
  const value = readValue(row, keys);
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    if (["true", "1", "yes", "是"].includes(value.trim().toLowerCase())) {
      return true;
    }
    if (["false", "0", "no", "否"].includes(value.trim().toLowerCase())) {
      return false;
    }
  }
  return null;
}

function readValue(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      return row[key];
    }
  }
  return undefined;
}
