import { randomUUID } from "node:crypto";

import type { ApiDatabase } from "../../infrastructure/database/database-client.js";
import { memoryEntries } from "../../infrastructure/database/schema.js";
import { desc } from "drizzle-orm";

export type MemoryEntryRecord = {
  id: string;
  projectId: string;
  stageCode?: string | null;
  sourceJobId?: string | null;
  memoryKey: string;
  subjectType: string;
  subjectId: string;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export interface MemoryEntryRepository {
  listByProjectId(projectId: string): Promise<MemoryEntryRecord[]>;
  create(input: Omit<MemoryEntryRecord, "id">): Promise<MemoryEntryRecord>;
}

export class InMemoryMemoryEntryRepository implements MemoryEntryRepository {
  private readonly entries: MemoryEntryRecord[];

  constructor(seed: MemoryEntryRecord[]) {
    this.entries = seed.map((entry) => ({
      ...entry,
      metadata: { ...entry.metadata },
    }));
  }

  async listByProjectId(projectId: string): Promise<MemoryEntryRecord[]> {
    return this.entries
      .filter((entry) => entry.projectId === projectId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async create(input: Omit<MemoryEntryRecord, "id">): Promise<MemoryEntryRecord> {
    const created: MemoryEntryRecord = {
      id: `memory-entry-${String(this.entries.length + 1).padStart(3, "0")}`,
      ...input,
      metadata: { ...input.metadata },
    };

    this.entries.push(created);
    return created;
  }
}

export class DbMemoryEntryRepository implements MemoryEntryRepository {
  constructor(private readonly db: ApiDatabase) {}

  async listByProjectId(projectId: string): Promise<MemoryEntryRecord[]> {
    const records = await this.db.query.memoryEntries.findMany({
      where: (table, { eq }) => eq(table.projectId, projectId),
      orderBy: (table, { desc }) => [desc(table.createdAt), desc(table.id)],
    });

    return records.map((record) => ({
      id: record.id,
      projectId: record.projectId,
      stageCode: record.stageCode ?? null,
      sourceJobId: record.sourceJobId ?? null,
      memoryKey: record.memoryKey,
      subjectType: record.subjectType,
      subjectId: record.subjectId,
      content: record.content,
      metadata:
        record.metadata && typeof record.metadata === "object"
          ? (record.metadata as Record<string, unknown>)
          : {},
      createdAt: record.createdAt.toISOString(),
    }));
  }

  async create(input: Omit<MemoryEntryRecord, "id">): Promise<MemoryEntryRecord> {
    const [created] = await this.db
      .insert(memoryEntries)
      .values({
        id: randomUUID(),
        projectId: input.projectId,
        stageCode: input.stageCode ?? null,
        sourceJobId: input.sourceJobId ?? null,
        memoryKey: input.memoryKey,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        content: input.content,
        metadata: input.metadata,
        createdAt: new Date(input.createdAt),
      })
      .returning();

    return {
      id: created.id,
      projectId: created.projectId,
      stageCode: created.stageCode ?? null,
      sourceJobId: created.sourceJobId ?? null,
      memoryKey: created.memoryKey,
      subjectType: created.subjectType,
      subjectId: created.subjectId,
      content: created.content,
      metadata:
        created.metadata && typeof created.metadata === "object"
          ? (created.metadata as Record<string, unknown>)
          : {},
      createdAt: created.createdAt.toISOString(),
    };
  }
}
