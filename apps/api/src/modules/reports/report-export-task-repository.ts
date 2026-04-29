import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";

import type { ApiDatabase } from "../../infrastructure/database/database-client.js";
import { reportExportTasks } from "../../infrastructure/database/schema.js";

export type ReportExportTaskStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed";

export type ReportExportTaskType = "summary" | "variance" | "stage_bill";

export type ReportExportTaskRecord = {
  id: string;
  projectId: string;
  reportType: ReportExportTaskType;
  status: ReportExportTaskStatus;
  requestedBy: string;
  stageCode?: string | null;
  disciplineCode?: string | null;
  reportTemplateId?: string | null;
  outputFormat?: "json" | "excel" | "pdf" | null;
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

    if (hasReturnedRecord(record)) {
      return mapReportExportTaskRecord(record);
    }
    return this.findRawById(taskId);
  }

  async create(
    input: Omit<ReportExportTaskRecord, "id">,
  ): Promise<ReportExportTaskRecord> {
    const taskId = randomUUID();
    const [created] = await this.db
      .insert(reportExportTasks)
      .values({
        id: taskId,
        projectId: input.projectId,
        reportType: input.reportType,
        status: input.status,
        requestedBy: input.requestedBy,
        stageCode: input.stageCode ?? null,
        disciplineCode: input.disciplineCode ?? null,
        reportTemplateId: input.reportTemplateId ?? null,
        outputFormat: input.outputFormat ?? null,
        createdAt: new Date(input.createdAt),
        completedAt: input.completedAt ? new Date(input.completedAt) : null,
        errorMessage: input.errorMessage ?? null,
        resultPreview: input.resultPreview ?? null,
        downloadFileName: input.downloadFileName ?? null,
        downloadContentType: input.downloadContentType ?? null,
        downloadContentLength: input.downloadContentLength ?? null,
      })
      .returning();

    if (hasReturnedRecord(created)) {
      return mapReportExportTaskRecord(created);
    }

    const persisted = await this.findById(taskId);
    if (!persisted) {
      throw new Error("Report export task was not persisted");
    }
    return persisted;
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
        reportTemplateId:
          input.reportTemplateId === undefined
            ? undefined
            : (input.reportTemplateId ?? null),
        outputFormat:
          input.outputFormat === undefined ? undefined : (input.outputFormat ?? null),
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

    if (hasReturnedRecord(updated)) {
      return mapReportExportTaskRecord(updated);
    }

    const persisted = await this.findById(taskId);
    if (!persisted) {
      throw new Error("Report export task not found");
    }
    return persisted;
  }

  private async findRawById(taskId: string): Promise<ReportExportTaskRecord | null> {
    const result = (await this.db.execute(sql`
      select
        id,
        project_id,
        report_type,
        status,
        requested_by,
        stage_code,
        discipline_code,
        report_template_id,
        output_format,
        created_at,
        completed_at,
        error_message,
        result_preview,
        download_file_name,
        download_content_type,
        download_content_length
      from report_export_task
      where id = ${taskId}
      limit 1
    `)) as { rows: Record<string, unknown>[] };
    const [record] = result.rows;
    return record ? mapReportExportTaskRecord(record) : null;
  }
}

function hasReturnedRecord(
  record: typeof reportExportTasks.$inferSelect | undefined,
): record is typeof reportExportTasks.$inferSelect {
  return Boolean(record && typeof record.id === "string");
}

function mapReportExportTaskRecord(
  record: typeof reportExportTasks.$inferSelect | Record<string, unknown>,
): ReportExportTaskRecord {
  const row = record as Record<string, unknown>;
  const outputFormat = readField(row, "outputFormat", "output_format");

  return {
    id: readRequiredString(row, "id", "id"),
    projectId: readRequiredString(row, "projectId", "project_id"),
    reportType: readRequiredString(
      row,
      "reportType",
      "report_type",
    ) as ReportExportTaskType,
    status: readRequiredString(row, "status", "status") as ReportExportTaskStatus,
    requestedBy: readRequiredString(row, "requestedBy", "requested_by"),
    stageCode: readOptionalString(row, "stageCode", "stage_code"),
    disciplineCode: readOptionalString(row, "disciplineCode", "discipline_code"),
    reportTemplateId: readOptionalString(
      row,
      "reportTemplateId",
      "report_template_id",
    ),
    outputFormat:
      outputFormat === "excel" || outputFormat === "pdf" || outputFormat === "json"
        ? outputFormat
        : null,
    createdAt: toIsoTimestamp(readField(row, "createdAt", "created_at")),
    completedAt: toOptionalIsoTimestamp(
      readField(row, "completedAt", "completed_at"),
    ),
    errorMessage: readOptionalString(row, "errorMessage", "error_message"),
    resultPreview: readResultPreview(row),
    downloadFileName: readOptionalString(
      row,
      "downloadFileName",
      "download_file_name",
    ),
    downloadContentType: readOptionalString(
      row,
      "downloadContentType",
      "download_content_type",
    ),
    downloadContentLength: readOptionalNumber(
      row,
      "downloadContentLength",
      "download_content_length",
    ),
  };
}

function readField(
  record: Record<string, unknown>,
  camelKey: string,
  snakeKey: string,
): unknown {
  return record[camelKey] ?? record[snakeKey];
}

function readRequiredString(
  record: Record<string, unknown>,
  camelKey: string,
  snakeKey: string,
): string {
  const value = readField(record, camelKey, snakeKey);
  if (typeof value !== "string") {
    throw new Error(`Report export task field ${camelKey} is missing`);
  }
  return value;
}

function readOptionalString(
  record: Record<string, unknown>,
  camelKey: string,
  snakeKey: string,
): string | null {
  const value = readField(record, camelKey, snakeKey);
  return typeof value === "string" ? value : null;
}

function readOptionalNumber(
  record: Record<string, unknown>,
  camelKey: string,
  snakeKey: string,
): number | null {
  const value = readField(record, camelKey, snakeKey);
  return typeof value === "number" ? value : null;
}

function readResultPreview(
  record: Record<string, unknown>,
): Record<string, unknown> | null {
  const value = readField(record, "resultPreview", "result_preview");
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function toIsoTimestamp(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return new Date(value).toISOString();
  }
  throw new Error("Report export task timestamp is missing");
}

function toOptionalIsoTimestamp(value: unknown): string | null {
  return value === null || value === undefined ? null : toIsoTimestamp(value);
}
