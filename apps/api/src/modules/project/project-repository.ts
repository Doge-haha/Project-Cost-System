import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import type { ApiDatabase } from "../../infrastructure/database/database-client.js";
import { projects } from "../../infrastructure/database/schema.js";

export type ProjectRecord = {
  id: string;
  code: string;
  name: string;
  status: "draft" | "active" | "archived";
  defaultPriceVersionId?: string | null;
  defaultFeeTemplateId?: string | null;
};

export interface ProjectRepository {
  listPage(input: {
    page: number;
    pageSize: number;
  }): Promise<{
    items: ProjectRecord[];
    total: number;
  }>;
  findById(projectId: string): Promise<ProjectRecord | null>;
  updateDefaults(
    projectId: string,
    input: {
      defaultPriceVersionId?: string | null;
      defaultFeeTemplateId?: string | null;
    },
  ): Promise<ProjectRecord>;
  create(input: Omit<ProjectRecord, "id"> & { id?: string }): Promise<ProjectRecord>;
}

export class InMemoryProjectRepository implements ProjectRepository {
  constructor(private readonly projects: ProjectRecord[]) {}

  async listPage(input: {
    page: number;
    pageSize: number;
  }): Promise<{
    items: ProjectRecord[];
    total: number;
  }> {
    const start = (input.page - 1) * input.pageSize;
    const end = start + input.pageSize;

    return {
      items: this.projects.slice(start, end),
      total: this.projects.length,
    };
  }

  async findById(projectId: string): Promise<ProjectRecord | null> {
    return this.projects.find((project) => project.id === projectId) ?? null;
  }

  async updateDefaults(
    projectId: string,
    input: {
      defaultPriceVersionId?: string | null;
      defaultFeeTemplateId?: string | null;
    },
  ): Promise<ProjectRecord> {
    const target = this.projects.find((project) => project.id === projectId);
    if (!target) {
      throw new Error("Project not found");
    }

    if ("defaultPriceVersionId" in input) {
      target.defaultPriceVersionId = input.defaultPriceVersionId ?? null;
    }
    if ("defaultFeeTemplateId" in input) {
      target.defaultFeeTemplateId = input.defaultFeeTemplateId ?? null;
    }

    return target;
  }

  async create(input: Omit<ProjectRecord, "id"> & { id?: string }): Promise<ProjectRecord> {
    const created: ProjectRecord = {
      id: input.id ?? randomUUID(),
      code: input.code,
      name: input.name,
      status: input.status,
      defaultPriceVersionId: input.defaultPriceVersionId ?? null,
      defaultFeeTemplateId: input.defaultFeeTemplateId ?? null,
    };

    this.projects.push(created);
    return created;
  }
}

export class DbProjectRepository implements ProjectRepository {
  constructor(private readonly db: ApiDatabase) {}

  async listPage(input: {
    page: number;
    pageSize: number;
  }): Promise<{
    items: ProjectRecord[];
    total: number;
  }> {
    const offset = (input.page - 1) * input.pageSize;
    const items = await this.db.query.projects.findMany({
      limit: input.pageSize,
      offset,
      orderBy: (table, { asc }) => [asc(table.code)],
    });
    const total = await this.db.$count(projects);

    return {
      items: items.map(mapProjectRecord),
      total,
    };
  }

  async findById(projectId: string): Promise<ProjectRecord | null> {
    const record = await this.db.query.projects.findFirst({
      where: (table, { eq: isEqual }) => isEqual(table.id, projectId),
    });

    return record ? mapProjectRecord(record) : null;
  }

  async updateDefaults(
    projectId: string,
    input: {
      defaultPriceVersionId?: string | null;
      defaultFeeTemplateId?: string | null;
    },
  ): Promise<ProjectRecord> {
    const updatePayload: Partial<typeof projects.$inferInsert> = {};
    if ("defaultPriceVersionId" in input) {
      updatePayload.defaultPriceVersionId = input.defaultPriceVersionId ?? null;
    }
    if ("defaultFeeTemplateId" in input) {
      updatePayload.defaultFeeTemplateId = input.defaultFeeTemplateId ?? null;
    }

    const [updated] =
      Object.keys(updatePayload).length > 0
        ? await this.db
            .update(projects)
            .set(updatePayload)
            .where(eq(projects.id, projectId))
            .returning()
        : [];

    if (!updated) {
      const existing = await this.findById(projectId);
      if (existing) {
        return existing;
      }
      throw new Error("Project not found");
    }

    return mapProjectRecord(updated);
  }

  async create(input: Omit<ProjectRecord, "id"> & { id?: string }): Promise<ProjectRecord> {
    const [created] = await this.db
      .insert(projects)
      .values({
        id: input.id ?? randomUUID(),
        code: input.code,
        name: input.name,
        status: input.status,
        defaultPriceVersionId: input.defaultPriceVersionId ?? null,
        defaultFeeTemplateId: input.defaultFeeTemplateId ?? null,
      })
      .returning();

    return mapProjectRecord(created);
  }
}

function mapProjectRecord(record: typeof projects.$inferSelect): ProjectRecord {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    status: record.status as ProjectRecord["status"],
    defaultPriceVersionId: record.defaultPriceVersionId ?? null,
    defaultFeeTemplateId: record.defaultFeeTemplateId ?? null,
  };
}
