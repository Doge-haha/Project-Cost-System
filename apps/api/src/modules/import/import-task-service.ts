import { z } from "zod";

import { AppError } from "../../shared/errors/app-error.js";
import { ProjectAuthorizationService } from "../project/project-authorization-service.js";
import type { AuditLogService } from "../audit/audit-log-service.js";
import type { ProjectDisciplineRepository } from "../project/project-discipline-repository.js";
import type { ProjectMemberRepository } from "../project/project-member-repository.js";
import type { ProjectRepository } from "../project/project-repository.js";
import type { ProjectStageRepository } from "../project/project-stage-repository.js";
import type { ImportTaskRecord, ImportTaskRepository } from "./import-task-repository.js";

export const createImportTaskSchema = z.object({
  source: z.string().min(1),
  sourceLabel: z.string().min(1).optional(),
  sourceFileName: z.string().min(1).optional(),
  sourceBatchNo: z.string().min(1).optional(),
  events: z.array(z.record(z.string(), z.unknown())).max(100),
});

type Dependencies = {
  projectRepository: ProjectRepository;
  projectStageRepository: ProjectStageRepository;
  projectDisciplineRepository: ProjectDisciplineRepository;
  projectMemberRepository: ProjectMemberRepository;
};

export class ImportTaskService {
  constructor(
    private readonly importTaskRepository: ImportTaskRepository,
    private readonly dependencies: Dependencies,
    private readonly auditLogService: AuditLogService,
  ) {}

  async listImportTasks(input: {
    projectId: string;
    userId: string;
  }): Promise<{
    items: ImportTaskRecord[];
    summary: {
      totalCount: number;
      statusCounts: Record<ImportTaskRecord["status"], number>;
    };
  }> {
    await this.assertProjectVisible(input.projectId, input.userId);
    const items = await this.importTaskRepository.listByProjectId(input.projectId);

    return {
      items,
      summary: {
        totalCount: items.length,
        statusCounts: {
          queued: items.filter((item) => item.status === "queued").length,
          processing: items.filter((item) => item.status === "processing").length,
          completed: items.filter((item) => item.status === "completed").length,
          failed: items.filter((item) => item.status === "failed").length,
        },
      },
    };
  }

  async createImportTask(input: {
    projectId: string;
    sourceType: string;
    sourceLabel: string;
    sourceFileName?: string | null;
    sourceBatchNo?: string | null;
    totalItemCount: number;
    failedItemCount?: number;
    failureDetails?: string[];
    latestErrorMessage?: string | null;
    retryLimit?: number;
    metadata?: Record<string, unknown>;
    requestedBy: string;
  }): Promise<ImportTaskRecord> {
    await this.assertProjectVisible(input.projectId, input.requestedBy);
    const failureDetails = dedupeFailureDetails(input.failureDetails ?? []);
    const failedItemCount = Math.max(input.failedItemCount ?? 0, 0);
    const metadata = this.buildImportTaskMetadata(input.metadata, {
      sourceFileName: input.sourceFileName ?? null,
      sourceBatchNo: input.sourceBatchNo ?? null,
      failureDetails,
      retryCount: 0,
      retryLimit: input.retryLimit ?? 3,
    });

    const created = await this.importTaskRepository.create({
      projectId: input.projectId,
      sourceType: input.sourceType,
      sourceLabel: input.sourceLabel,
      sourceFileName: input.sourceFileName ?? null,
      sourceBatchNo: input.sourceBatchNo ?? null,
      status: "queued",
      requestedBy: input.requestedBy,
      totalItemCount: input.totalItemCount,
      importedItemCount: 0,
      memoryItemCount: 0,
      failedItemCount,
      latestJobId: null,
      latestErrorMessage: input.latestErrorMessage ?? null,
      failureDetails,
      retryCount: 0,
      retryLimit: input.retryLimit ?? 3,
      canRetry: true,
      metadata,
      createdAt: new Date().toISOString(),
      completedAt: null,
    });

    await this.auditLogService.writeAuditLog({
      projectId: input.projectId,
      resourceType: "import_task",
      resourceId: created.id,
      action: "create",
      operatorId: input.requestedBy,
      afterPayload: {
        sourceType: created.sourceType,
        sourceLabel: created.sourceLabel,
        status: created.status,
      },
    });

    return created;
  }

  async markImportTaskProcessing(input: {
    taskId: string;
    jobId: string;
  }): Promise<ImportTaskRecord> {
    const task = await this.requireTask(input.taskId);

    return this.importTaskRepository.update(task.id, {
      status: "processing",
      latestJobId: input.jobId,
      latestErrorMessage: null,
      metadata: this.buildImportTaskMetadata(task.metadata, {
        failureDetails: task.failureDetails,
      }),
    });
  }

  async completeImportTask(input: {
    taskId: string;
    jobId: string;
    importedItemCount: number;
    memoryItemCount: number;
  }): Promise<ImportTaskRecord> {
    const task = await this.requireTask(input.taskId);
    const failedItemCount = Math.max(
      task.totalItemCount - input.importedItemCount,
      0,
    );
    const completed = await this.importTaskRepository.update(task.id, {
      status: "completed",
      latestJobId: input.jobId,
      importedItemCount: input.importedItemCount,
      memoryItemCount: input.memoryItemCount,
      failedItemCount,
      latestErrorMessage: null,
      metadata: this.buildImportTaskMetadata(task.metadata, {
        failureDetails: failedItemCount > 0 ? task.failureDetails : [],
      }),
      completedAt: new Date().toISOString(),
    });

    await this.auditLogService.writeAuditLog({
      projectId: completed.projectId,
      resourceType: "import_task",
      resourceId: completed.id,
      action: "completed",
      operatorId: completed.requestedBy,
      afterPayload: {
        status: completed.status,
        importedItemCount: completed.importedItemCount,
        memoryItemCount: completed.memoryItemCount,
      },
    });

    return completed;
  }

  async failImportTask(input: {
    taskId: string;
    jobId: string;
    errorMessage: string;
  }): Promise<ImportTaskRecord> {
    const task = await this.requireTask(input.taskId);
    const failureDetails = dedupeFailureDetails([
      input.errorMessage,
      ...task.failureDetails,
    ]);
    const failed = await this.importTaskRepository.update(task.id, {
      status: "failed",
      latestJobId: input.jobId,
      failedItemCount: task.totalItemCount,
      latestErrorMessage: input.errorMessage,
      metadata: this.buildImportTaskMetadata(task.metadata, {
        failureDetails,
      }),
      completedAt: new Date().toISOString(),
    });

    await this.auditLogService.writeAuditLog({
      projectId: failed.projectId,
      resourceType: "import_task",
      resourceId: failed.id,
      action: "failed",
      operatorId: failed.requestedBy,
      afterPayload: {
        status: failed.status,
        latestErrorMessage: failed.latestErrorMessage,
      },
    });

    return failed;
  }

  async retryImportTask(input: {
    taskId: string;
    operatorId: string;
    retryContext?: {
      failureReason?: string;
      failureResourceType?: string;
      failureAction?: string;
    };
  }): Promise<ImportTaskRecord> {
    const task = await this.requireTask(input.taskId);
    this.assertRetryLimitAvailable(task);

    const retryHistory = Array.isArray(task.metadata.retryHistory)
      ? task.metadata.retryHistory
          .filter(
            (
              entry,
            ): entry is {
              attempt: number;
              operatorId: string;
              triggeredAt: string;
              previousStatus: ImportTaskRecord["status"];
            } =>
              !!entry &&
              typeof entry === "object" &&
              typeof (entry as { attempt?: unknown }).attempt === "number" &&
              typeof (entry as { operatorId?: unknown }).operatorId === "string" &&
              typeof (entry as { triggeredAt?: unknown }).triggeredAt === "string" &&
              typeof (entry as { previousStatus?: unknown }).previousStatus === "string",
          )
          .slice(0, 9)
      : [];
    const retryContext = {
      failureReason:
        typeof input.retryContext?.failureReason === "string" &&
        input.retryContext.failureReason.length > 0
          ? input.retryContext.failureReason
          : null,
      failureResourceType:
        typeof input.retryContext?.failureResourceType === "string" &&
        input.retryContext.failureResourceType.length > 0
          ? input.retryContext.failureResourceType
          : null,
      failureAction:
        typeof input.retryContext?.failureAction === "string" &&
        input.retryContext.failureAction.length > 0
          ? input.retryContext.failureAction
          : null,
    };
    const hasRetryContext = Object.values(retryContext).some((value) => value !== null);

    const retried = await this.importTaskRepository.update(task.id, {
      status: "queued",
      importedItemCount: 0,
      memoryItemCount: 0,
      failedItemCount: 0,
      retryCount: task.retryCount + 1,
      retryLimit: task.retryLimit,
      canRetry: task.retryCount + 1 < task.retryLimit,
      latestErrorMessage: null,
      metadata: this.buildImportTaskMetadata(task.metadata, {
        retryCount: task.retryCount + 1,
        extraMetadata: {
          retryContext: hasRetryContext ? retryContext : null,
          retryHistory: [
            {
              attempt: task.retryCount + 1,
              operatorId: input.operatorId,
              triggeredAt: new Date().toISOString(),
              previousStatus: task.status,
              retryContext: hasRetryContext ? retryContext : null,
            },
            ...retryHistory,
          ].slice(0, 10),
        },
      }),
      completedAt: null,
    });

    await this.auditLogService.writeAuditLog({
      projectId: retried.projectId,
      resourceType: "import_task",
      resourceId: retried.id,
      action: "retried",
      operatorId: input.operatorId,
      beforePayload: {
        status: task.status,
        latestErrorMessage: task.latestErrorMessage ?? null,
      },
      afterPayload: {
        status: retried.status,
        retryContext: hasRetryContext ? retryContext : null,
      },
    });

    return retried;
  }

  async assertImportTaskRetryable(taskId: string): Promise<void> {
    const task = await this.requireTask(taskId);
    this.assertRetryLimitAvailable(task);
  }

  async buildRetryEventsFromSnapshots(input: {
    taskId: string;
    retryContext: {
      failureReason?: string;
      failureResourceType?: string;
      failureAction?: string;
    };
  }): Promise<Array<Record<string, unknown>>> {
    const task = await this.requireTask(input.taskId);
    const failedItems = normalizeFailedItems(task.metadata.failedItems).filter((item) => {
      if (
        input.retryContext.failureReason &&
        item.reasonCode !== input.retryContext.failureReason
      ) {
        return false;
      }

      if (
        input.retryContext.failureResourceType &&
        item.resourceType !== input.retryContext.failureResourceType
      ) {
        return false;
      }

      if (
        input.retryContext.failureAction &&
        item.action !== input.retryContext.failureAction
      ) {
        return false;
      }

      return true;
    });
    const failureSnapshots = normalizeFailureSnapshots(task.metadata.failureSnapshots);

    const retryEvents = failedItems
      .map((item) => {
        if (item.retryEventSnapshot) {
          return item.retryEventSnapshot;
        }

        return (
          failureSnapshots.find(
            (snapshot) =>
              snapshot.lineNo !== null &&
              item.lineNo !== null &&
              snapshot.lineNo === item.lineNo,
          )?.retryEventSnapshot ??
          failureSnapshots.find(
            (snapshot) =>
              snapshot.lineNo === null &&
              snapshot.reasonCode === item.reasonCode &&
              snapshot.resourceType === item.resourceType &&
              snapshot.action === item.action,
          )?.retryEventSnapshot ??
          null
        );
      })
      .filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === "object" && !Array.isArray(item),
      )
      .map((item) => ({ ...item }));

    if (retryEvents.length > 0 && retryEvents.length !== failedItems.length) {
      throw new AppError(
        409,
        "IMPORT_TASK_RETRY_INPUT_INCOMPLETE",
        "Some failed items in the selected subset do not have retryable event snapshots",
      );
    }

    if (retryEvents.length === 0) {
      throw new AppError(
        409,
        "IMPORT_TASK_RETRY_INPUT_UNAVAILABLE",
        "No retryable event snapshots are available for the selected subset",
      );
    }

    return retryEvents;
  }

  async downloadImportTaskErrorReport(input: {
    projectId: string;
    taskId: string;
    userId: string;
    failureReason?: string | null;
    format?: "json" | "csv";
  }): Promise<{
    fileName: string;
    contentType: string;
    content: string;
  }> {
    await this.assertProjectVisible(input.projectId, input.userId);
    const task = await this.requireTask(input.taskId);
    if (task.projectId !== input.projectId) {
      throw new AppError(404, "IMPORT_TASK_NOT_FOUND", "Import task not found");
    }

    const normalizedFailureReason =
      typeof input.failureReason === "string" && input.failureReason.length > 0
        ? input.failureReason
        : null;
    const format = input.format === "csv" ? "csv" : "json";
    const failedItems = normalizeFailedItems(task.metadata.failedItems).filter((item) =>
      normalizedFailureReason ? item.reasonCode === normalizedFailureReason : true,
    );
    const fileNameSuffix = normalizedFailureReason
      ? `-current-filter-${normalizedFailureReason}`
      : "-all-failed-items";

    if (format === "csv") {
      return {
        fileName: `${task.id}-error-report${fileNameSuffix}.csv`,
        contentType: "text/csv; charset=utf-8",
        content: buildCsvErrorReport(failedItems),
      };
    }

    const content = JSON.stringify(
      {
        taskId: task.id,
        projectId: task.projectId,
        sourceLabel: task.sourceLabel,
        sourceFileName: task.sourceFileName ?? null,
        sourceBatchNo: task.sourceBatchNo ?? null,
        status: task.status,
        failedItemCount: failedItems.length,
        failureReason: normalizedFailureReason,
        failureDetails: task.failureDetails,
        failedItems,
      },
      null,
      2,
    );

    return {
      fileName: `${task.id}-error-report${fileNameSuffix}.json`,
      contentType: "application/json; charset=utf-8",
      content,
    };
  }

  private async requireTask(taskId: string): Promise<ImportTaskRecord> {
    const task = await this.importTaskRepository.findById(taskId);
    if (!task) {
      throw new AppError(404, "IMPORT_TASK_NOT_FOUND", "Import task not found");
    }

    return task;
  }

  private assertRetryLimitAvailable(task: ImportTaskRecord): void {
    if (task.retryCount >= task.retryLimit) {
      throw new AppError(
        409,
        "IMPORT_TASK_RETRY_LIMIT_REACHED",
        "Import task retry limit reached",
      );
    }
  }

  private async assertProjectVisible(projectId: string, userId: string): Promise<void> {
    const project = await this.dependencies.projectRepository.findById(projectId);
    if (!project) {
      throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
    }

    const authorizationService = new ProjectAuthorizationService({
      stages: await this.dependencies.projectStageRepository.listByProjectId(projectId),
      disciplines: await this.dependencies.projectDisciplineRepository.listByProjectId(
        projectId,
      ),
      members: await this.dependencies.projectMemberRepository.listByProjectId(projectId),
    });

    if (!authorizationService.canViewContext({ projectId, userId })) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have permission to access this resource",
      );
    }
  }

  private buildImportTaskMetadata(
    currentMetadata: Record<string, unknown> | undefined,
    overrides: Partial<{
      sourceFileName: string | null;
      sourceBatchNo: string | null;
      failureDetails: string[];
      retryCount: number;
      retryLimit: number;
      extraMetadata: Record<string, unknown>;
    }>,
  ): Record<string, unknown> {
    const metadata =
      currentMetadata && typeof currentMetadata === "object"
        ? { ...currentMetadata }
        : {};
    const sourceFileName =
      overrides.sourceFileName !== undefined
        ? overrides.sourceFileName
        : typeof metadata.sourceFileName === "string"
          ? metadata.sourceFileName
          : null;
    const sourceBatchNo =
      overrides.sourceBatchNo !== undefined
        ? overrides.sourceBatchNo
        : typeof metadata.sourceBatchNo === "string"
          ? metadata.sourceBatchNo
          : null;
    const failureDetails =
      overrides.failureDetails ??
      (Array.isArray(metadata.failureDetails)
        ? metadata.failureDetails.filter(
            (item): item is string => typeof item === "string" && item.length > 0,
          )
        : []);
    const retryCount =
      overrides.retryCount ??
      (typeof metadata.retryCount === "number" ? metadata.retryCount : 0);
    const retryLimit =
      overrides.retryLimit ??
      (typeof metadata.retryLimit === "number" ? metadata.retryLimit : 3);

    return {
      ...metadata,
      ...(overrides.extraMetadata ?? {}),
      sourceFileName,
      sourceBatchNo,
      failureDetails,
      retryCount,
      retryLimit,
    };
  }
}

function dedupeFailureDetails(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    if (!item || seen.has(item)) {
      continue;
    }
    seen.add(item);
    result.push(item);
  }

  return result.slice(0, 5);
}

function normalizeFailedItems(input: unknown): Array<{
  lineNo: number | null;
  reasonCode: string;
  reasonLabel: string;
  errorMessage: string;
  projectId: string | null;
  resourceType: string | null;
  action: string | null;
  keys: string[];
  retryEventSnapshot: Record<string, unknown> | null;
}> {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      lineNo: typeof item.lineNo === "number" ? item.lineNo : null,
      reasonCode:
        typeof item.reasonCode === "string" && item.reasonCode.length > 0
          ? item.reasonCode
          : "unknown",
      reasonLabel:
        typeof item.reasonLabel === "string" && item.reasonLabel.length > 0
          ? item.reasonLabel
          : "未分类",
      errorMessage:
        typeof item.errorMessage === "string" && item.errorMessage.length > 0
          ? item.errorMessage
          : "系统未记录",
      projectId: typeof item.projectId === "string" ? item.projectId : null,
      resourceType: typeof item.resourceType === "string" ? item.resourceType : null,
      action: typeof item.action === "string" ? item.action : null,
      keys: Array.isArray(item.keys)
        ? item.keys.filter(
            (value): value is string => typeof value === "string" && value.length > 0,
          )
        : [],
      retryEventSnapshot:
        item.retryEventSnapshot &&
        typeof item.retryEventSnapshot === "object" &&
        !Array.isArray(item.retryEventSnapshot)
          ? { ...(item.retryEventSnapshot as Record<string, unknown>) }
          : null,
    }));
}

function normalizeFailureSnapshots(input: unknown): Array<{
  lineNo: number | null;
  reasonCode: string | null;
  resourceType: string | null;
  action: string | null;
  retryEventSnapshot: Record<string, unknown> | null;
}> {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      lineNo: typeof item.lineNo === "number" ? item.lineNo : null,
      reasonCode:
        typeof item.reasonCode === "string" && item.reasonCode.length > 0
          ? item.reasonCode
          : null,
      resourceType:
        typeof item.resourceType === "string" && item.resourceType.length > 0
          ? item.resourceType
          : null,
      action:
        typeof item.action === "string" && item.action.length > 0 ? item.action : null,
      retryEventSnapshot:
        item.retryEventSnapshot &&
        typeof item.retryEventSnapshot === "object" &&
        !Array.isArray(item.retryEventSnapshot)
          ? { ...(item.retryEventSnapshot as Record<string, unknown>) }
          : null,
    }))
    .filter((item) => item.retryEventSnapshot);
}

function buildCsvErrorReport(
  items: Array<{
    lineNo: number | null;
    reasonCode: string;
    reasonLabel: string;
    errorMessage: string;
    projectId: string | null;
    resourceType: string | null;
    action: string | null;
    keys: string[];
  }>,
): string {
  const header = [
    "lineNo",
    "reasonCode",
    "reasonLabel",
    "errorMessage",
    "projectId",
    "resourceType",
    "action",
    "keys",
  ];
  const rows = items.map((item) => [
    item.lineNo === null ? "" : String(item.lineNo),
    item.reasonCode,
    item.reasonLabel,
    item.errorMessage,
    item.projectId ?? "",
    item.resourceType ?? "",
    item.action ?? "",
    item.keys.join("|"),
  ]);

  return [header, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n");
}

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}
