import { randomUUID } from "node:crypto";

import type { ApiDatabase } from "../../infrastructure/database/database-client.js";
import { skillDefinitions } from "../../infrastructure/database/schema.js";

export type SkillDefinitionRecord = {
  id: string;
  skillCode: string;
  skillName: string;
  description: string;
  status: string;
  runtimeConfig: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export interface SkillDefinitionRepository {
  list(): Promise<SkillDefinitionRecord[]>;
  create(
    input: Omit<SkillDefinitionRecord, "id">,
  ): Promise<SkillDefinitionRecord>;
}

export class InMemorySkillDefinitionRepository
  implements SkillDefinitionRepository
{
  private readonly definitions: SkillDefinitionRecord[];

  constructor(seed: SkillDefinitionRecord[]) {
    this.definitions = seed.map((definition) => ({
      ...definition,
      runtimeConfig: { ...definition.runtimeConfig },
    }));
  }

  async list(): Promise<SkillDefinitionRecord[]> {
    return this.definitions
      .slice()
      .sort((left, right) => left.skillCode.localeCompare(right.skillCode));
  }

  async create(
    input: Omit<SkillDefinitionRecord, "id">,
  ): Promise<SkillDefinitionRecord> {
    const created: SkillDefinitionRecord = {
      id: `skill-definition-${String(this.definitions.length + 1).padStart(3, "0")}`,
      ...input,
      runtimeConfig: { ...input.runtimeConfig },
    };

    this.definitions.push(created);
    return created;
  }
}

export class DbSkillDefinitionRepository implements SkillDefinitionRepository {
  constructor(private readonly db: ApiDatabase) {}

  async list(): Promise<SkillDefinitionRecord[]> {
    const records = await this.db.query.skillDefinitions.findMany({
      orderBy: (table, { asc }) => [asc(table.skillCode), asc(table.id)],
    });

    return records.map((record) => ({
      id: record.id,
      skillCode: record.skillCode,
      skillName: record.skillName,
      description: record.description,
      status: record.status,
      runtimeConfig:
        record.runtimeConfig && typeof record.runtimeConfig === "object"
          ? (record.runtimeConfig as Record<string, unknown>)
          : {},
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    }));
  }

  async create(
    input: Omit<SkillDefinitionRecord, "id">,
  ): Promise<SkillDefinitionRecord> {
    const [created] = await this.db
      .insert(skillDefinitions)
      .values({
        id: randomUUID(),
        skillCode: input.skillCode,
        skillName: input.skillName,
        description: input.description,
        status: input.status,
        runtimeConfig: input.runtimeConfig,
        createdAt: new Date(input.createdAt),
        updatedAt: new Date(input.updatedAt),
      })
      .returning();

    return {
      id: created.id,
      skillCode: created.skillCode,
      skillName: created.skillName,
      description: created.description,
      status: created.status,
      runtimeConfig:
        created.runtimeConfig && typeof created.runtimeConfig === "object"
          ? (created.runtimeConfig as Record<string, unknown>)
          : {},
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }
}
