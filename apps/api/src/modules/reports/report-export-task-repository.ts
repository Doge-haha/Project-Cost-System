import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import type { ApiDatabase } from "../../infrastructure/database/database-client.js";
import { reportExportTasks } from "../../infrastructure/database/schema.js";

export type ReportExportTaskStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed";

export type ReportExportTaskType = "summary" | "variance";

export type ReportExportTaskRecord = {
  id: string;
  projectId: string;
  reportType: ReportExportTaskType;
  status: ReportExportTaskStatus;
  requestedBy: string;
  stageCode?: string | null;
  disciplineCode?: string | null;
  createdAt: string;
  completedAt?: string | null;
  errorMessage?: string | null;
  resultPreview?: Record<string, unknown> | null;
  downloadFileName?: string | null;
  downloadContentType?: string | null;
  downloadContentLength?: number | null;
};

export interface ReportExportTaskRepository {
  findById(taskId: string): Promise<ReportExportTaskRecord | null>;
  create(
    input: Omit<ReportExportTaskRecord, "id">,
  ): Promise<ReportExportTaskRecord>;
  update(
    taskId: string,
    input: Partial<Omit<ReportExportTaskRecord, "id" | "projectId" | "requestedBy">>,
  ): Promise<ReportExportTaskRecord>;
}

export class InMemoryReportExportTaskRepository
  implements ReportExportTaskRepository
{
  private readonly tasks: ReportExportTaskRecord[];

  constructor(seed: ReportExportTaskRecord[]) {
    this.tasks = seed.map((task) => ({ ...task }));
  }

  async findById(taskId: string): Promise<ReportExportTaskRecord | null> {
    return this.tasks.find((task) => task.id === taskId) ?? null;
  }

  async create(
    input: Omit<ReportExportTaskRecord, "id">,
  ): Promise<ReportExportTaskRecord> {
    const created: ReportExportTaskRecord = {
      id: `report-export-task-${String(this.tasks.length + 1).padStart(3, "0")}`,
      ...input,
    };
    this.tasks.push(created);
    return created;
  }

  async update(
    taskId: string,
    input: Partial<Omit<ReportExportTaskRecord, "id" | "projectId" | "requestedBy">>,
  ): Promise<ReportExportTaskRecord> {
    const target = this.tasks.find((task) => task.id === taskId);
    if (!target) {
      throw new Error("Report export task not found");
    }

    Object.assign(target, input);
    return target;
  }
}

export class DbReportExportTaskRepository
  implements ReportExportTaskRepository
{
  constructor(private readonly db: ApiDatabase) {}

  async findById(taskId: string): Promise<ReportExportTaskRecord | null> {
    const record = await this.db.query.reportExportTasks.findFirst({
      where: (table, { eq: isEqual }) => isEqual(table.id, taskId),
    });

    return record ? mapReportExportTaskRecord(record) : null;
  }

  async create(
    input: Omit<ReportExportTaskRecord, "id">,
  ): Promise<ReportExportTaskRecord> {
    const [created] = await this.db
      .insert(reportExportTasks)
      .values({
        id: randomUUID(),
        projectId: input.projectId,
        reportType: input.reportType,
        status: input.status,
        requestedBy: input.requestedBy,
        stageCode: input.stageCode ?? null,
        disciplineCode: input.disciplineCode ?? null,
        createdAt: new Date(input.createdAt),
        completedAt: input.completedAt ? new Date(input.completedAt) : null,
        errorMessage: input.errorMessage ?? null,
        resultPreview: input.resultPreview ?? null,
        downloadFileName: input.downloadFileName ?? null,
        downloadContentType: input.downloadContentType ?? null,
        downloadContentLength: input.downloadContentLength ?? null,
      })
      .returning();

    return mapReportExportTaskRecord(created);
  }

  async update(
    taskId: string,
    input: Partial<Omit<ReportExportTaskRecord, "id" | "projectId" | "requestedBy">>,
  ): Promise<ReportExportTaskRecord> {
    const [updated] = await this.db
      .update(reportExportTasks)
      .set({
        reportType: input.reportType,
        status: input.status,
        stageCode:
          input.stageCode === undefined ? undefined : (input.stageCode ?? null),
        disciplineCode:
          input.disciplineCode === undefined
            ? undefined
            : (input.disciplineCode ?? null),
        createdAt: input.createdAt ? new Date(input.createdAt) : undefined,
        completedAt:
          input.completedAt === undefined
            ? undefined
            : input.completedAt
              ? new Date(input.completedAt)
              : null,
        errorMessage:
          input.errorMessage === undefined ? undefined : (input.errorMessage ?? null),
        resultPreview:
          input.resultPreview === undefined ? undefined : (input.resultPreview ?? null),
        downloadFileName:
          input.downloadFileName === undefined
            ? undefined
            : (input.downloadFileName ?? null),
        downloadContentType:
          input.downloadContentType === undefined
            ? undefined
            : (input.downloadContentType ?? null),
        downloadContentLength:
          input.downloadContentLength === undefined
            ? undefined
            : (input.downloadContentLength ?? null),
      })
      .where(eq(reportExportTasks.id, taskId))
      .returning();

    if (!updated) {
      throw new Error("Report export task not found");
    }

    return mapReportExportTaskRecord(updated);
  }
}

function mapReportExportTaskRecord(
  record: typeof reportExportTasks.$inferSelect,
): ReportExportTaskRecord {
  return {
    id: record.id,
    projectId: record.projectId,
    reportType: record.reportType as ReportExportTaskType,
    status: record.status as ReportExportTaskStatus,
    requestedBy: record.requestedBy,
    stageCode: record.stageCode ?? null,
    disciplineCode: record.disciplineCode ?? null,
    createdAt: record.createdAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
    errorMessage: record.errorMessage ?? null,
    resultPreview:
      record.resultPreview && typeof record.resultPreview === "object"
        ? (record.resultPreview as Record<string, unknown>)
        : null,
    downloadFileName: record.downloadFileName ?? null,
    downloadContentType: record.downloadContentType ?? null,
    downloadContentLength: record.downloadContentLength ?? null,
  };
}
