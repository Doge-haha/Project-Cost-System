import { randomUUID } from "node:crypto";

import type { ApiDatabase } from "../../infrastructure/database/database-client.js";
import { knowledgeEntries } from "../../infrastructure/database/schema.js";
import { desc } from "drizzle-orm";

export type KnowledgeEntryRecord = {
  id: string;
  projectId: string;
  stageCode?: string | null;
  sourceJobId?: string | null;
  sourceType: string;
  sourceAction: string;
  title: string;
  summary: string;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
};

export interface KnowledgeEntryRepository {
  listByProjectId(projectId: string): Promise<KnowledgeEntryRecord[]>;
  create(
    input: Omit<KnowledgeEntryRecord, "id">,
  ): Promise<KnowledgeEntryRecord>;
}

export class InMemoryKnowledgeEntryRepository
  implements KnowledgeEntryRepository
{
  private readonly entries: KnowledgeEntryRecord[];

  constructor(seed: KnowledgeEntryRecord[]) {
    this.entries = seed.map((entry) => ({
      ...entry,
      tags: [...entry.tags],
      metadata: { ...entry.metadata },
    }));
  }

  async listByProjectId(projectId: string): Promise<KnowledgeEntryRecord[]> {
    return this.entries
      .filter((entry) => entry.projectId === projectId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async create(
    input: Omit<KnowledgeEntryRecord, "id">,
  ): Promise<KnowledgeEntryRecord> {
    const created: KnowledgeEntryRecord = {
      id: `knowledge-entry-${String(this.entries.length + 1).padStart(3, "0")}`,
      ...input,
      tags: [...input.tags],
      metadata: { ...input.metadata },
    };

    this.entries.push(created);
    return created;
  }
}

export class DbKnowledgeEntryRepository
  implements KnowledgeEntryRepository
{
  constructor(private readonly db: ApiDatabase) {}

  async listByProjectId(projectId: string): Promise<KnowledgeEntryRecord[]> {
    const records = await this.db.query.knowledgeEntries.findMany({
      where: (table, { eq }) => eq(table.projectId, projectId),
      orderBy: (table, { desc }) => [desc(table.createdAt), desc(table.id)],
    });

    return records.map((record) => ({
      id: record.id,
      projectId: record.projectId,
      stageCode: record.stageCode ?? null,
      sourceJobId: record.sourceJobId ?? null,
      sourceType: record.sourceType,
      sourceAction: record.sourceAction,
      title: record.title,
      summary: record.summary,
      tags: [...record.tags],
      metadata:
        record.metadata && typeof record.metadata === "object"
          ? (record.metadata as Record<string, unknown>)
          : {},
      createdAt: record.createdAt.toISOString(),
    }));
  }

  async create(
    input: Omit<KnowledgeEntryRecord, "id">,
  ): Promise<KnowledgeEntryRecord> {
    const [created] = await this.db
      .insert(knowledgeEntries)
      .values({
        id: randomUUID(),
        projectId: input.projectId,
        stageCode: input.stageCode ?? null,
        sourceJobId: input.sourceJobId ?? null,
        sourceType: input.sourceType,
        sourceAction: input.sourceAction,
        title: input.title,
        summary: input.summary,
        tags: input.tags,
        metadata: input.metadata,
        createdAt: new Date(input.createdAt),
      })
      .returning();

    return {
      id: created.id,
      projectId: created.projectId,
      stageCode: created.stageCode ?? null,
      sourceJobId: created.sourceJobId ?? null,
      sourceType: created.sourceType,
      sourceAction: created.sourceAction,
      title: created.title,
      summary: created.summary,
      tags: [...created.tags],
      metadata:
        created.metadata && typeof created.metadata === "object"
          ? (created.metadata as Record<string, unknown>)
          : {},
      createdAt: created.createdAt.toISOString(),
    };
  }
}
