import { randomUUID } from "node:crypto";

import { desc, eq } from "drizzle-orm";

import type { ApiDatabase } from "../../infrastructure/database/database-client.js";
import { importTasks } from "../../infrastructure/database/schema.js";

export type ImportTaskStatus = "queued" | "processing" | "completed" | "failed";

export type ImportTaskRecord = {
  id: string;
  projectId: string;
  sourceType: string;
  sourceLabel: string;
  sourceFileName?: string | null;
  sourceBatchNo?: string | null;
  status: ImportTaskStatus;
  requestedBy: string;
  totalItemCount: number;
  importedItemCount: number;
  memoryItemCount: number;
  failedItemCount: number;
  latestJobId?: string | null;
  latestErrorMessage?: string | null;
  failureDetails: string[];
  retryCount: number;
  retryLimit: number;
  canRetry: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  completedAt?: string | null;
};

export interface ImportTaskRepository {
  listByProjectId(projectId: string): Promise<ImportTaskRecord[]>;
  findById(taskId: string): Promise<ImportTaskRecord | null>;
  create(input: Omit<ImportTaskRecord, "id">): Promise<ImportTaskRecord>;
  update(
    taskId: string,
    input: Partial<Omit<ImportTaskRecord, "id" | "projectId" | "requestedBy" | "sourceType">>,
  ): Promise<ImportTaskRecord>;
}

export class InMemoryImportTaskRepository implements ImportTaskRepository {
  private readonly tasks: ImportTaskRecord[];

  constructor(seed: ImportTaskRecord[]) {
    this.tasks = seed.map((task) => ({ ...task }));
  }

  async listByProjectId(projectId: string): Promise<ImportTaskRecord[]> {
    return this.tasks
      .filter((task) => task.projectId === projectId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async findById(taskId: string): Promise<ImportTaskRecord | null> {
    return this.tasks.find((task) => task.id === taskId) ?? null;
  }

  async create(input: Omit<ImportTaskRecord, "id">): Promise<ImportTaskRecord> {
    const created: ImportTaskRecord = {
      id: `import-task-${String(this.tasks.length + 1).padStart(3, "0")}`,
      ...input,
    };
    this.tasks.push(created);
    return created;
  }

  async update(
    taskId: string,
    input: Partial<Omit<ImportTaskRecord, "id" | "projectId" | "requestedBy" | "sourceType">>,
  ): Promise<ImportTaskRecord> {
    const target = this.tasks.find((task) => task.id === taskId);
    if (!target) {
      throw new Error("Import task not found");
    }

    Object.assign(target, input);
    return target;
  }
}

export class DbImportTaskRepository implements ImportTaskRepository {
  constructor(private readonly db: ApiDatabase) {}

  async listByProjectId(projectId: string): Promise<ImportTaskRecord[]> {
    const records = await this.db.query.importTasks.findMany({
      where: (table, { eq }) => eq(table.projectId, projectId),
      orderBy: (table, { desc }) => [desc(table.createdAt), desc(table.id)],
    });

    return records.map(mapImportTaskRecord);
  }

  async findById(taskId: string): Promise<ImportTaskRecord | null> {
    const record = await this.db.query.importTasks.findFirst({
      where: (table, { eq }) => eq(table.id, taskId),
    });

    return record ? mapImportTaskRecord(record) : null;
  }

  async create(input: Omit<ImportTaskRecord, "id">): Promise<ImportTaskRecord> {
    const [created] = await this.db
      .insert(importTasks)
      .values({
        id: randomUUID(),
        projectId: input.projectId,
        sourceType: input.sourceType,
        sourceLabel: input.sourceLabel,
        status: input.status,
        requestedBy: input.requestedBy,
        totalItemCount: input.totalItemCount,
        importedItemCount: input.importedItemCount,
        memoryItemCount: input.memoryItemCount,
        failedItemCount: input.failedItemCount,
        latestJobId: input.latestJobId ?? null,
        latestErrorMessage: input.latestErrorMessage ?? null,
        metadata: input.metadata,
        createdAt: new Date(input.createdAt),
        completedAt: input.completedAt ? new Date(input.completedAt) : null,
      })
      .returning();

    return mapImportTaskRecord(created);
  }

  async update(
    taskId: string,
    input: Partial<Omit<ImportTaskRecord, "id" | "projectId" | "requestedBy" | "sourceType">>,
  ): Promise<ImportTaskRecord> {
    const [updated] = await this.db
      .update(importTasks)
      .set({
        sourceLabel: input.sourceLabel,
        status: input.status,
        totalItemCount: input.totalItemCount,
        importedItemCount: input.importedItemCount,
        memoryItemCount: input.memoryItemCount,
        failedItemCount: input.failedItemCount,
        latestJobId: input.latestJobId,
        latestErrorMessage: input.latestErrorMessage,
        metadata: input.metadata,
        completedAt:
          input.completedAt === undefined
            ? undefined
            : input.completedAt
              ? new Date(input.completedAt)
              : null,
      })
      .where(eq(importTasks.id, taskId))
      .returning();

    if (!updated) {
      throw new Error("Import task not found");
    }

    return mapImportTaskRecord(updated);
  }
}

function mapImportTaskRecord(
  record: typeof importTasks.$inferSelect,
): ImportTaskRecord {
  const metadata = normalizeImportTaskMetadata(record.metadata);
  return {
    id: record.id,
    projectId: record.projectId,
    sourceType: record.sourceType,
    sourceLabel: record.sourceLabel,
    sourceFileName: metadata.sourceFileName,
    sourceBatchNo: metadata.sourceBatchNo,
    status: record.status as ImportTaskStatus,
    requestedBy: record.requestedBy,
    totalItemCount: record.totalItemCount,
    importedItemCount: record.importedItemCount,
    memoryItemCount: record.memoryItemCount,
    failedItemCount: record.failedItemCount,
    latestJobId: record.latestJobId ?? null,
    latestErrorMessage: record.latestErrorMessage ?? null,
    failureDetails: metadata.failureDetails,
    retryCount: metadata.retryCount,
    retryLimit: metadata.retryLimit,
    canRetry: metadata.retryCount < metadata.retryLimit,
    metadata,
    createdAt: record.createdAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
  };
}

function normalizeImportTaskMetadata(
  metadata: unknown,
): Record<string, unknown> & {
  sourceFileName: string | null;
  sourceBatchNo: string | null;
  failureDetails: string[];
  retryCount: number;
  retryLimit: number;
} {
  const base =
    metadata && typeof metadata === "object"
      ? ({ ...metadata } as Record<string, unknown>)
      : {};

  const sourceFileName =
    typeof base.sourceFileName === "string" && base.sourceFileName.length > 0
      ? base.sourceFileName
      : null;
  const sourceBatchNo =
    typeof base.sourceBatchNo === "string" && base.sourceBatchNo.length > 0
      ? base.sourceBatchNo
      : null;
  const failureDetails = Array.isArray(base.failureDetails)
    ? base.failureDetails.filter(
        (item): item is string => typeof item === "string" && item.length > 0,
      )
    : [];
  const retryCount =
    typeof base.retryCount === "number" && Number.isFinite(base.retryCount)
      ? base.retryCount
      : 0;
  const retryLimit =
    typeof base.retryLimit === "number" && Number.isFinite(base.retryLimit)
      ? base.retryLimit
      : 3;

  return {
    ...base,
    sourceFileName,
    sourceBatchNo,
    failureDetails,
    retryCount,
    retryLimit,
  };
}
