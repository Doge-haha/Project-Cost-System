import type {
  BackgroundJobPayload,
  BackgroundJobRecord,
  BackgroundJobStatus,
  BackgroundJobType,
} from "@saas-pricing/job-contracts";

import { randomUUID } from "node:crypto";

import type { ApiDatabase } from "../../infrastructure/database/database-client.js";
import { backgroundJobs } from "../../infrastructure/database/schema.js";
import { desc, eq } from "drizzle-orm";

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
    const records = await this.db.query.backgroundJobs.findMany({
      orderBy: (table, { desc }) => [desc(table.createdAt), desc(table.id)],
      limit: input?.limit,
    });

    return records
      .map((record) => ({
        id: record.id,
        jobType: record.jobType as BackgroundJobType,
        status: record.status as BackgroundJobStatus,
        requestedBy: record.requestedBy,
        projectId: record.projectId ?? null,
        payload: record.payload as BackgroundJobPayload,
        result:
          record.result && typeof record.result === "object"
            ? (record.result as Record<string, unknown>)
            : null,
        errorMessage: record.errorMessage ?? null,
        createdAt: record.createdAt.toISOString(),
        completedAt: record.completedAt?.toISOString() ?? null,
      }))
      .filter((job) => {
        if (input?.projectId && job.projectId !== input.projectId) {
          return false;
        }
        if (input?.requestedBy && job.requestedBy !== input.requestedBy) {
          return false;
        }
        if (input?.jobType && job.jobType !== input.jobType) {
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
      });
  }

  async findById(jobId: string): Promise<BackgroundJobRecord | null> {
    const record = await this.db.query.backgroundJobs.findFirst({
      where: (table, { eq }) => eq(table.id, jobId),
    });

    if (!record) {
      return null;
    }

    return {
      id: record.id,
      jobType: record.jobType as BackgroundJobType,
      status: record.status as BackgroundJobStatus,
      requestedBy: record.requestedBy,
      projectId: record.projectId ?? null,
      payload: record.payload as BackgroundJobPayload,
      result:
        record.result && typeof record.result === "object"
          ? (record.result as Record<string, unknown>)
          : null,
      errorMessage: record.errorMessage ?? null,
      createdAt: record.createdAt.toISOString(),
      completedAt: record.completedAt?.toISOString() ?? null,
    };
  }

  async create(input: Omit<BackgroundJobRecord, "id">): Promise<BackgroundJobRecord> {
    const [created] = await this.db
      .insert(backgroundJobs)
      .values({
        id: randomUUID(),
        jobType: input.jobType,
        status: input.status,
        requestedBy: input.requestedBy,
        projectId: input.projectId ?? null,
        payload: input.payload,
        result: input.result ?? null,
        errorMessage: input.errorMessage ?? null,
        createdAt: new Date(input.createdAt),
        completedAt: input.completedAt ? new Date(input.completedAt) : null,
      })
      .returning();

    return {
      id: created.id,
      jobType: created.jobType as BackgroundJobType,
      status: created.status as BackgroundJobStatus,
      requestedBy: created.requestedBy,
      projectId: created.projectId ?? null,
      payload: created.payload as BackgroundJobPayload,
      result:
        created.result && typeof created.result === "object"
          ? (created.result as Record<string, unknown>)
          : null,
      errorMessage: created.errorMessage ?? null,
      createdAt: created.createdAt.toISOString(),
      completedAt: created.completedAt?.toISOString() ?? null,
    };
  }

  async update(
    jobId: string,
    input: Partial<Omit<BackgroundJobRecord, "id" | "jobType" | "requestedBy">>,
  ): Promise<BackgroundJobRecord> {
    const [updated] = await this.db
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
      .where(eq(backgroundJobs.id, jobId))
      .returning();

    if (!updated) {
      throw new Error("Background job not found");
    }

    return {
      id: updated.id,
      jobType: updated.jobType as BackgroundJobType,
      status: updated.status as BackgroundJobStatus,
      requestedBy: updated.requestedBy,
      projectId: updated.projectId ?? null,
      payload: updated.payload as BackgroundJobPayload,
      result:
        updated.result && typeof updated.result === "object"
          ? (updated.result as Record<string, unknown>)
          : null,
      errorMessage: updated.errorMessage ?? null,
      createdAt: updated.createdAt.toISOString(),
      completedAt: updated.completedAt?.toISOString() ?? null,
    };
  }
}
