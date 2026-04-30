import { randomUUID } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import type { ApiDatabase } from "../../infrastructure/database/database-client.js";
import { varianceWarningThresholds } from "../../infrastructure/database/schema.js";

export type VarianceWarningThresholdRecord = {
  id: string;
  projectId: string;
  stageCode?: string | null;
  thresholdAmount: number;
  thresholdRate: number;
  createdAt: string;
  updatedAt: string;
};

export interface VarianceWarningThresholdRepository {
  listByProjectId(projectId: string): Promise<VarianceWarningThresholdRecord[]>;
  upsert(input: {
    projectId: string;
    stageCode?: string | null;
    thresholdAmount: number;
    thresholdRate: number;
  }): Promise<VarianceWarningThresholdRecord>;
}

export class InMemoryVarianceWarningThresholdRepository
  implements VarianceWarningThresholdRepository
{
  private readonly thresholds: VarianceWarningThresholdRecord[];

  constructor(seed: VarianceWarningThresholdRecord[]) {
    this.thresholds = seed.map((threshold) => ({ ...threshold }));
  }

  async listByProjectId(
    projectId: string,
  ): Promise<VarianceWarningThresholdRecord[]> {
    return this.thresholds
      .filter((threshold) => threshold.projectId === projectId)
      .sort((left, right) =>
        (left.stageCode ?? "").localeCompare(right.stageCode ?? ""),
      )
      .map((threshold) => ({ ...threshold }));
  }

  async upsert(input: {
    projectId: string;
    stageCode?: string | null;
    thresholdAmount: number;
    thresholdRate: number;
  }): Promise<VarianceWarningThresholdRecord> {
    const now = new Date().toISOString();
    const target = this.thresholds.find(
      (threshold) =>
        threshold.projectId === input.projectId &&
        (threshold.stageCode ?? null) === (input.stageCode ?? null),
    );
    if (target) {
      target.thresholdAmount = input.thresholdAmount;
      target.thresholdRate = input.thresholdRate;
      target.updatedAt = now;
      return { ...target };
    }

    const created = {
      id: `variance-threshold-${String(this.thresholds.length + 1).padStart(3, "0")}`,
      projectId: input.projectId,
      stageCode: input.stageCode ?? null,
      thresholdAmount: input.thresholdAmount,
      thresholdRate: input.thresholdRate,
      createdAt: now,
      updatedAt: now,
    };
    this.thresholds.push(created);
    return { ...created };
  }
}

export class DbVarianceWarningThresholdRepository
  implements VarianceWarningThresholdRepository
{
  constructor(private readonly db: ApiDatabase) {}

  async listByProjectId(
    projectId: string,
  ): Promise<VarianceWarningThresholdRecord[]> {
    const records = await this.db.query.varianceWarningThresholds.findMany({
      where: (table, { eq: isEqual }) => isEqual(table.projectId, projectId),
      orderBy: (table, { asc }) => [asc(table.stageCode), asc(table.id)],
    });

    return records.map(mapThresholdRecord);
  }

  async upsert(input: {
    projectId: string;
    stageCode?: string | null;
    thresholdAmount: number;
    thresholdRate: number;
  }): Promise<VarianceWarningThresholdRecord> {
    const existing = await this.db.query.varianceWarningThresholds.findFirst({
      where: (table) =>
        and(
          eq(table.projectId, input.projectId),
          input.stageCode ? eq(table.stageCode, input.stageCode) : isNull(table.stageCode),
        ),
    });

    if (existing) {
      const [updated] = await this.db
        .update(varianceWarningThresholds)
        .set({
          thresholdAmount: input.thresholdAmount,
          thresholdRate: input.thresholdRate,
          updatedAt: new Date(),
        })
        .where(eq(varianceWarningThresholds.id, existing.id))
        .returning();
      return mapThresholdRecord(updated);
    }

    const now = new Date();
    const [created] = await this.db
      .insert(varianceWarningThresholds)
      .values({
        id: randomUUID(),
        projectId: input.projectId,
        stageCode: input.stageCode ?? null,
        thresholdAmount: input.thresholdAmount,
        thresholdRate: input.thresholdRate,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return mapThresholdRecord(created);
  }
}

function mapThresholdRecord(
  record: typeof varianceWarningThresholds.$inferSelect,
): VarianceWarningThresholdRecord {
  return {
    id: record.id,
    projectId: record.projectId,
    stageCode: record.stageCode ?? null,
    thresholdAmount: record.thresholdAmount,
    thresholdRate: record.thresholdRate,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
