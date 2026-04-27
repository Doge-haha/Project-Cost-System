import { randomUUID } from "node:crypto";

import { desc, eq } from "drizzle-orm";

import type { ApiDatabase } from "../../infrastructure/database/database-client.js";
import { aiRecommendations } from "../../infrastructure/database/schema.js";

export type AiRecommendationStatus = "generated" | "accepted" | "ignored" | "expired";
export type AiRecommendationType =
  | "bill_recommendation"
  | "quota_recommendation"
  | "variance_warning";

export type AiRecommendationRecord = {
  id: string;
  projectId: string;
  stageCode?: string | null;
  disciplineCode?: string | null;
  resourceType: string;
  resourceId: string;
  recommendationType: AiRecommendationType;
  inputPayload: Record<string, unknown>;
  outputPayload: Record<string, unknown>;
  status: AiRecommendationStatus;
  createdBy: string;
  handledBy?: string | null;
  handledAt?: string | null;
  statusReason?: string | null;
  createdAt: string;
  updatedAt: string;
};

export interface AiRecommendationRepository {
  listByProjectId(projectId: string): Promise<AiRecommendationRecord[]>;
  findById(id: string): Promise<AiRecommendationRecord | null>;
  create(
    input: Omit<AiRecommendationRecord, "id">,
  ): Promise<AiRecommendationRecord>;
  update(input: AiRecommendationRecord): Promise<AiRecommendationRecord>;
}

export class InMemoryAiRecommendationRepository
  implements AiRecommendationRepository
{
  private readonly recommendations: AiRecommendationRecord[];

  constructor(seed: AiRecommendationRecord[]) {
    this.recommendations = seed.map(cloneRecommendation);
  }

  async listByProjectId(projectId: string): Promise<AiRecommendationRecord[]> {
    return this.recommendations
      .filter((recommendation) => recommendation.projectId === projectId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map(cloneRecommendation);
  }

  async findById(id: string): Promise<AiRecommendationRecord | null> {
    const found = this.recommendations.find(
      (recommendation) => recommendation.id === id,
    );
    return found ? cloneRecommendation(found) : null;
  }

  async create(
    input: Omit<AiRecommendationRecord, "id">,
  ): Promise<AiRecommendationRecord> {
    const created = cloneRecommendation({
      id: `ai-recommendation-${String(this.recommendations.length + 1).padStart(3, "0")}`,
      ...input,
    });
    this.recommendations.push(created);
    return cloneRecommendation(created);
  }

  async update(input: AiRecommendationRecord): Promise<AiRecommendationRecord> {
    const index = this.recommendations.findIndex(
      (recommendation) => recommendation.id === input.id,
    );
    if (index === -1) {
      this.recommendations.push(cloneRecommendation(input));
      return cloneRecommendation(input);
    }

    this.recommendations[index] = cloneRecommendation(input);
    return cloneRecommendation(this.recommendations[index]);
  }
}

export class DbAiRecommendationRepository
  implements AiRecommendationRepository
{
  constructor(private readonly db: ApiDatabase) {}

  async listByProjectId(projectId: string): Promise<AiRecommendationRecord[]> {
    const records = await this.db.query.aiRecommendations.findMany({
      where: (table, { eq }) => eq(table.projectId, projectId),
      orderBy: (table) => [desc(table.createdAt), desc(table.id)],
    });

    return records.map(toRecord);
  }

  async findById(id: string): Promise<AiRecommendationRecord | null> {
    const record = await this.db.query.aiRecommendations.findFirst({
      where: (table, { eq }) => eq(table.id, id),
    });
    return record ? toRecord(record) : null;
  }

  async create(
    input: Omit<AiRecommendationRecord, "id">,
  ): Promise<AiRecommendationRecord> {
    const [created] = await this.db
      .insert(aiRecommendations)
      .values({
        id: randomUUID(),
        projectId: input.projectId,
        stageCode: input.stageCode ?? null,
        disciplineCode: input.disciplineCode ?? null,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        recommendationType: input.recommendationType,
        inputPayload: input.inputPayload,
        outputPayload: input.outputPayload,
        status: input.status,
        createdBy: input.createdBy,
        handledBy: input.handledBy ?? null,
        handledAt: input.handledAt ? new Date(input.handledAt) : null,
        statusReason: input.statusReason ?? null,
        createdAt: new Date(input.createdAt),
        updatedAt: new Date(input.updatedAt),
      })
      .returning();

    return toRecord(created);
  }

  async update(input: AiRecommendationRecord): Promise<AiRecommendationRecord> {
    const [updated] = await this.db
      .update(aiRecommendations)
      .set({
        outputPayload: input.outputPayload,
        status: input.status,
        handledBy: input.handledBy ?? null,
        handledAt: input.handledAt ? new Date(input.handledAt) : null,
        statusReason: input.statusReason ?? null,
        updatedAt: new Date(input.updatedAt),
      })
      .where(eq(aiRecommendations.id, input.id))
      .returning();

    return toRecord(updated);
  }
}

function cloneRecommendation(
  recommendation: AiRecommendationRecord,
): AiRecommendationRecord {
  return {
    ...recommendation,
    inputPayload: { ...recommendation.inputPayload },
    outputPayload: { ...recommendation.outputPayload },
  };
}

function toRecord(record: typeof aiRecommendations.$inferSelect): AiRecommendationRecord {
  return {
    id: record.id,
    projectId: record.projectId,
    stageCode: record.stageCode ?? null,
    disciplineCode: record.disciplineCode ?? null,
    resourceType: record.resourceType,
    resourceId: record.resourceId,
    recommendationType: record.recommendationType as AiRecommendationType,
    inputPayload:
      record.inputPayload && typeof record.inputPayload === "object"
        ? (record.inputPayload as Record<string, unknown>)
        : {},
    outputPayload:
      record.outputPayload && typeof record.outputPayload === "object"
        ? (record.outputPayload as Record<string, unknown>)
        : {},
    status: record.status as AiRecommendationStatus,
    createdBy: record.createdBy,
    handledBy: record.handledBy ?? null,
    handledAt: record.handledAt?.toISOString() ?? null,
    statusReason: record.statusReason ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
