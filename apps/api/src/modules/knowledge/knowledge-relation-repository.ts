import { randomUUID } from "node:crypto";

import type { ApiDatabase } from "../../infrastructure/database/database-client.js";
import { knowledgeRelations } from "../../infrastructure/database/schema.js";

export type KnowledgeRelationRecord = {
  id: string;
  projectId: string;
  fromType: string;
  fromId: string;
  toType: string;
  toId: string;
  relationType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export interface KnowledgeRelationRepository {
  listByProjectId(projectId: string): Promise<KnowledgeRelationRecord[]>;
  create(
    input: Omit<KnowledgeRelationRecord, "id">,
  ): Promise<KnowledgeRelationRecord>;
}

export class InMemoryKnowledgeRelationRepository
  implements KnowledgeRelationRepository
{
  private readonly relations: KnowledgeRelationRecord[];

  constructor(seed: KnowledgeRelationRecord[]) {
    this.relations = seed.map((relation) => ({
      ...relation,
      metadata: { ...relation.metadata },
    }));
  }

  async listByProjectId(projectId: string): Promise<KnowledgeRelationRecord[]> {
    return this.relations
      .filter((relation) => relation.projectId === projectId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async create(
    input: Omit<KnowledgeRelationRecord, "id">,
  ): Promise<KnowledgeRelationRecord> {
    const created: KnowledgeRelationRecord = {
      id: `knowledge-relation-${String(this.relations.length + 1).padStart(3, "0")}`,
      ...input,
      metadata: { ...input.metadata },
    };

    this.relations.push(created);
    return created;
  }
}

export class DbKnowledgeRelationRepository
  implements KnowledgeRelationRepository
{
  constructor(private readonly db: ApiDatabase) {}

  async listByProjectId(projectId: string): Promise<KnowledgeRelationRecord[]> {
    const records = await this.db.query.knowledgeRelations.findMany({
      where: (table, { eq }) => eq(table.projectId, projectId),
      orderBy: (table, { desc }) => [desc(table.createdAt), desc(table.id)],
    });

    return records.map((record) => ({
      id: record.id,
      projectId: record.projectId,
      fromType: record.fromType,
      fromId: record.fromId,
      toType: record.toType,
      toId: record.toId,
      relationType: record.relationType,
      metadata:
        record.metadata && typeof record.metadata === "object"
          ? (record.metadata as Record<string, unknown>)
          : {},
      createdAt: record.createdAt.toISOString(),
    }));
  }

  async create(
    input: Omit<KnowledgeRelationRecord, "id">,
  ): Promise<KnowledgeRelationRecord> {
    const [created] = await this.db
      .insert(knowledgeRelations)
      .values({
        id: randomUUID(),
        projectId: input.projectId,
        fromType: input.fromType,
        fromId: input.fromId,
        toType: input.toType,
        toId: input.toId,
        relationType: input.relationType,
        metadata: input.metadata,
        createdAt: new Date(input.createdAt),
      })
      .returning();

    return {
      id: created.id,
      projectId: created.projectId,
      fromType: created.fromType,
      fromId: created.fromId,
      toType: created.toType,
      toId: created.toId,
      relationType: created.relationType,
      metadata:
        created.metadata && typeof created.metadata === "object"
          ? (created.metadata as Record<string, unknown>)
          : {},
      createdAt: created.createdAt.toISOString(),
    };
  }
}
