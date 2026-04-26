import { randomUUID } from "node:crypto";

import type { ApiDatabase } from "../../infrastructure/database/database-client.js";
import { auditLogs } from "../../infrastructure/database/schema.js";

export type AuditLogRecord = {
  id: string;
  projectId: string;
  stageCode?: string | null;
  resourceType: string;
  resourceId: string;
  action: string;
  operatorId: string;
  beforePayload?: Record<string, unknown> | null;
  afterPayload?: Record<string, unknown> | null;
  createdAt: string;
};

export interface AuditLogRepository {
  listByProjectId(projectId: string): Promise<AuditLogRecord[]>;
  create(input: Omit<AuditLogRecord, "id">): Promise<AuditLogRecord>;
}

export class InMemoryAuditLogRepository implements AuditLogRepository {
  private readonly logs: AuditLogRecord[];

  constructor(seed: AuditLogRecord[]) {
    this.logs = seed.map((log) => ({ ...log }));
  }

  async listByProjectId(projectId: string): Promise<AuditLogRecord[]> {
    return this.logs
      .filter((log) => log.projectId === projectId)
      .sort((left, right) => {
        const createdAtComparison = right.createdAt.localeCompare(left.createdAt);
        if (createdAtComparison !== 0) {
          return createdAtComparison;
        }

        return extractSequence(right.id) - extractSequence(left.id);
      });
  }

  async create(input: Omit<AuditLogRecord, "id">): Promise<AuditLogRecord> {
    const created: AuditLogRecord = {
      id: `audit-log-${String(this.logs.length + 1).padStart(3, "0")}`,
      ...input,
    };

    this.logs.push(created);
    return created;
  }
}

function extractSequence(id: string): number {
  const match = id.match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

export class DbAuditLogRepository implements AuditLogRepository {
  constructor(private readonly db: ApiDatabase) {}

  async listByProjectId(projectId: string): Promise<AuditLogRecord[]> {
    const records = await this.db.query.auditLogs.findMany({
      where: (table, { eq }) => eq(table.projectId, projectId),
      orderBy: (table, { desc }) => [desc(table.createdAt), desc(table.id)],
    });

    return records.map((record) => ({
      id: record.id,
      projectId: record.projectId,
      stageCode: record.stageCode ?? null,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      action: record.action,
      operatorId: record.operatorId,
      beforePayload:
        record.beforePayload && typeof record.beforePayload === "object"
          ? (record.beforePayload as Record<string, unknown>)
          : null,
      afterPayload:
        record.afterPayload && typeof record.afterPayload === "object"
          ? (record.afterPayload as Record<string, unknown>)
          : null,
      createdAt: record.createdAt.toISOString(),
    }));
  }

  async create(input: Omit<AuditLogRecord, "id">): Promise<AuditLogRecord> {
    const [created] = await this.db
      .insert(auditLogs)
      .values({
        id: randomUUID(),
        projectId: input.projectId,
        stageCode: input.stageCode ?? null,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        action: input.action,
        operatorId: input.operatorId,
        beforePayload: input.beforePayload ?? null,
        afterPayload: input.afterPayload ?? null,
        createdAt: new Date(input.createdAt),
      })
      .returning();

    return {
      id: created.id,
      projectId: created.projectId,
      stageCode: created.stageCode ?? null,
      resourceType: created.resourceType,
      resourceId: created.resourceId,
      action: created.action,
      operatorId: created.operatorId,
      beforePayload:
        created.beforePayload && typeof created.beforePayload === "object"
          ? (created.beforePayload as Record<string, unknown>)
          : null,
      afterPayload:
        created.afterPayload && typeof created.afterPayload === "object"
          ? (created.afterPayload as Record<string, unknown>)
          : null,
      createdAt: created.createdAt.toISOString(),
    };
  }
}
