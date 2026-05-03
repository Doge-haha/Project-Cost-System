import type {
  BackgroundJobPayload,
  BackgroundJobRecord,
  BackgroundJobStatus,
  BackgroundJobType,
} from "@saas-pricing/job-contracts";

import { randomUUID } from "node:crypto";

import type { ApiDatabase } from "../../infrastructure/database/database-client.js";
import { backgroundJobs } from "../../infrastructure/database/schema.js";
import { eq, sql, type SQL } from "drizzle-orm";

export type {
  BackgroundJobPayload,
  BackgroundJobRecord,
  BackgroundJobStatus,
  BackgroundJobType,
};

export interface BackgroundJobRepository {
  list(input?: {
    projectId?: string;
    requestedBy?: string;
    jobType?: BackgroundJobType;
    status?: BackgroundJobStatus;
    createdFrom?: string;
    createdTo?: string;
    completedFrom?: string;
    completedTo?: string;
    limit?: number;
  }): Promise<BackgroundJobRecord[]>;
  findById(jobId: string): Promise<BackgroundJobRecord | null>;
  create(input: Omit<BackgroundJobRecord, "id">): Promise<BackgroundJobRecord>;
  update(
    jobId: string,
    input: Partial<Omit<BackgroundJobRecord, "id" | "jobType" | "requestedBy">>,
  ): Promise<BackgroundJobRecord>;
}

export class InMemoryBackgroundJobRepository implements BackgroundJobRepository {
  private readonly jobs: BackgroundJobRecord[];

  constructor(seed: BackgroundJobRecord[]) {
    this.jobs = seed.map((job) => ({ ...job }));
  }

  async list(input?: {
    projectId?: string;
    requestedBy?: string;
    jobType?: BackgroundJobType;
    status?: BackgroundJobStatus;
    createdFrom?: string;
    createdTo?: string;
    completedFrom?: string;
    completedTo?: string;
    limit?: number;
  }): Promise<BackgroundJobRecord[]> {
    const filtered = this.jobs
      .filter((job) => {
        if (input?.projectId && job.projectId !== input.projectId) {
          return false;
        }
        if (input?.jobType && job.jobType !== input.jobType) {
          return false;
        }
        if (input?.requestedBy && job.requestedBy !== input.requestedBy) {
          return false;
        }
        if (input?.status && job.status !== input.status) {
          return false;
        }
        if (input?.createdFrom && job.createdAt < input.createdFrom) {
          return false;
        }
        if (input?.createdTo && job.createdAt > input.createdTo) {
          return false;
        }
        if (
          input?.completedFrom &&
          (!job.completedAt || job.completedAt < input.completedFrom)
        ) {
          return false;
        }
        if (
          input?.completedTo &&
          (!job.completedAt || job.completedAt > input.completedTo)
        ) {
          return false;
        }
        return true;
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    if (input?.limit !== undefined) {
      return filtered.slice(0, input.limit);
    }

    return filtered;
  }

  async findById(jobId: string): Promise<BackgroundJobRecord | null> {
    return this.jobs.find((job) => job.id === jobId) ?? null;
  }

  async create(input: Omit<BackgroundJobRecord, "id">): Promise<BackgroundJobRecord> {
    const created: BackgroundJobRecord = {
      id: `background-job-${String(this.jobs.length + 1).padStart(3, "0")}`,
      ...input,
    };
    this.jobs.push(created);
    return created;
  }

  async update(
    jobId: string,
    input: Partial<Omit<BackgroundJobRecord, "id" | "jobType" | "requestedBy">>,
  ): Promise<BackgroundJobRecord> {
    const target = this.jobs.find((job) => job.id === jobId);
    if (!target) {
      throw new Error("Background job not found");
    }

    Object.assign(target, input);
    return target;
  }
}

export class DbBackgroundJobRepository implements BackgroundJobRepository {
  constructor(private readonly db: ApiDatabase) {}

  async list(input?: {
    projectId?: string;
    requestedBy?: string;
    jobType?: BackgroundJobType;
    status?: BackgroundJobStatus;
    createdFrom?: string;
    createdTo?: string;
    completedFrom?: string;
    completedTo?: string;
    limit?: number;
  }): Promise<BackgroundJobRecord[]> {
    const filters = [
      input?.projectId ? sql`project_id = ${input.projectId}` : undefined,
      input?.requestedBy ? sql`requested_by = ${input.requestedBy}` : undefined,
      input?.jobType ? sql`job_type = ${input.jobType}` : undefined,
      input?.status ? sql`status = ${input.status}` : undefined,
      input?.createdFrom
        ? sql`created_at >= ${new Date(input.createdFrom)}`
        : undefined,
      input?.createdTo ? sql`created_at <= ${new Date(input.createdTo)}` : undefined,
      input?.completedFrom
        ? sql`completed_at >= ${new Date(input.completedFrom)}`
        : undefined,
      input?.completedTo
        ? sql`completed_at <= ${new Date(input.completedTo)}`
        : undefined,
    ].filter((filter): filter is SQL => filter !== undefined);
    const whereClause =
      filters.length > 0 ? sql`where ${sql.join(filters, sql` and `)}` : sql``;
    const limitClause =
      input?.limit === undefined ? sql`` : sql`limit ${input.limit}`;
    const records = await this.db.execute(sql`
      select
        id,
        job_type as "jobType",
        status,
        requested_by as "requestedBy",
        project_id as "projectId",
        payload,
        result,
        error_message as "errorMessage",
        created_at as "createdAt",
        completed_at as "completedAt"
      from background_job
      ${whereClause}
      order by created_at desc, id desc
      ${limitClause}
    `);

    return records.rows.map((record) =>
      mapDbBackgroundJobRecord(record as unknown as DbBackgroundJobRow),
    );
  }

  async findById(jobId: string): Promise<BackgroundJobRecord | null> {
    const records = await this.db.execute(sql`
      select
        id,
        job_type as "jobType",
        status,
        requested_by as "requestedBy",
        project_id as "projectId",
        payload,
        result,
        error_message as "errorMessage",
        created_at as "createdAt",
        completed_at as "completedAt"
      from background_job
      where id = ${jobId}
      limit 1
    `);
    const [record] = records.rows;

    if (!record) {
      return null;
    }

    return mapDbBackgroundJobRecord(record as unknown as DbBackgroundJobRow);
  }

  async create(input: Omit<BackgroundJobRecord, "id">): Promise<BackgroundJobRecord> {
    const id = randomUUID();
    await this.db
      .insert(backgroundJobs)
      .values({
        id,
        jobType: input.jobType,
        status: input.status,
        requestedBy: input.requestedBy,
        projectId: input.projectId ?? null,
        payload: input.payload,
        result: input.result ?? null,
        errorMessage: input.errorMessage ?? null,
        createdAt: new Date(input.createdAt),
        completedAt: input.completedAt ? new Date(input.completedAt) : null,
      });

    const created = await this.findById(id);
    if (!created) {
      throw new Error("Background job not found");
    }
    return created;
  }

  async update(
    jobId: string,
    input: Partial<Omit<BackgroundJobRecord, "id" | "jobType" | "requestedBy">>,
  ): Promise<BackgroundJobRecord> {
    await this.db
      .update(backgroundJobs)
      .set({
        status: input.status,
        projectId:
          input.projectId === undefined ? undefined : (input.projectId ?? null),
        payload: input.payload,
        result: input.result === undefined ? undefined : (input.result ?? null),
        errorMessage:
          input.errorMessage === undefined ? undefined : (input.errorMessage ?? null),
        createdAt: input.createdAt ? new Date(input.createdAt) : undefined,
        completedAt:
          input.completedAt === undefined
            ? undefined
            : input.completedAt
              ? new Date(input.completedAt)
              : null,
      })
      .where(eq(backgroundJobs.id, jobId));

    const updated = await this.findById(jobId);
    if (!updated) {
      throw new Error("Background job not found");
    }

    return updated;
  }
}

type DbBackgroundJobRow = Record<string, unknown>;

function mapDbBackgroundJobRecord(record: DbBackgroundJobRow): BackgroundJobRecord {
  const result = readObjectField(record, "result", "result");

  return {
    id: readStringField(record, "id", "id"),
    jobType: readStringField(record, "jobType", "job_type") as BackgroundJobType,
    status: readStringField(record, "status", "status") as BackgroundJobStatus,
    requestedBy: readStringField(record, "requestedBy", "requested_by"),
    projectId: readNullableStringField(record, "projectId", "project_id"),
    payload: readField(record, "payload", "payload") as BackgroundJobPayload,
    result,
    errorMessage: readNullableStringField(record, "errorMessage", "error_message"),
    createdAt: readDateField(record, "createdAt", "created_at").toISOString(),
    completedAt:
      readNullableDateField(record, "completedAt", "completed_at")?.toISOString() ??
      null,
  };
}

function readField(
  record: DbBackgroundJobRow,
  camelKey: string,
  snakeKey: string,
): unknown {
  return record[camelKey] ?? record[snakeKey];
}

function readStringField(
  record: DbBackgroundJobRow,
  camelKey: string,
  snakeKey: string,
): string {
  const value = readField(record, camelKey, snakeKey);
  if (typeof value !== "string") {
    throw new Error(`Background job field ${camelKey} is missing`);
  }
  return value;
}

function readNullableStringField(
  record: DbBackgroundJobRow,
  camelKey: string,
  snakeKey: string,
): string | null {
  const value = readField(record, camelKey, snakeKey);
  return typeof value === "string" ? value : null;
}

function readObjectField(
  record: DbBackgroundJobRow,
  camelKey: string,
  snakeKey: string,
): Record<string, unknown> | null {
  const value = readField(record, camelKey, snakeKey);
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readDateField(
  record: DbBackgroundJobRow,
  camelKey: string,
  snakeKey: string,
): Date {
  const value = readField(record, camelKey, snakeKey);
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Background job field ${camelKey} is missing`);
  }
  return date;
}

function readNullableDateField(
  record: DbBackgroundJobRow,
  camelKey: string,
  snakeKey: string,
): Date | null {
  const value = readField(record, camelKey, snakeKey);
  if (value === null || value === undefined) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}
