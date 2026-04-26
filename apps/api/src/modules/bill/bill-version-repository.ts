import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import type { ApiDatabase } from "../../infrastructure/database/database-client.js";
import { billVersions } from "../../infrastructure/database/schema.js";

export type BillVersionRecord = {
  id: string;
  projectId: string;
  stageCode: string;
  disciplineCode: string;
  versionNo: number;
  versionName: string;
  versionStatus: "editable" | "submitted" | "approved" | "locked" | "rejected";
  sourceVersionId: string | null;
};

export interface BillVersionRepository {
  listByProjectId(projectId: string): Promise<BillVersionRecord[]>;
  listByContext(input: {
    projectId: string;
    stageCode: string;
    disciplineCode: string;
  }): Promise<BillVersionRecord[]>;
  findById(versionId: string): Promise<BillVersionRecord | null>;
  create(input: {
    projectId: string;
    stageCode: string;
    disciplineCode: string;
    versionName: string;
    sourceVersionId?: string | null;
  }): Promise<BillVersionRecord>;
  updateStatus(input: {
    versionId: string;
    versionStatus: BillVersionRecord["versionStatus"];
  }): Promise<BillVersionRecord>;
}

export class InMemoryBillVersionRepository implements BillVersionRepository {
  private readonly versions: BillVersionRecord[];

  constructor(seed: BillVersionRecord[]) {
    this.versions = seed.map((version) => ({ ...version }));
  }

  async listByProjectId(projectId: string): Promise<BillVersionRecord[]> {
    return this.versions.filter((version) => version.projectId === projectId);
  }

  async listByContext(input: {
    projectId: string;
    stageCode: string;
    disciplineCode: string;
  }): Promise<BillVersionRecord[]> {
    return this.versions.filter(
      (version) =>
        version.projectId === input.projectId &&
        version.stageCode === input.stageCode &&
        version.disciplineCode === input.disciplineCode,
    );
  }

  async findById(versionId: string): Promise<BillVersionRecord | null> {
    return this.versions.find((version) => version.id === versionId) ?? null;
  }

  async create(input: {
    projectId: string;
    stageCode: string;
    disciplineCode: string;
    versionName: string;
    sourceVersionId?: string | null;
  }): Promise<BillVersionRecord> {
    const currentVersions = this.versions.filter(
      (version) =>
        version.projectId === input.projectId &&
        version.stageCode === input.stageCode &&
        version.disciplineCode === input.disciplineCode,
    );

    const nextVersionNo =
      currentVersions.reduce(
        (maxVersionNo, current) => Math.max(maxVersionNo, current.versionNo),
        0,
      ) + 1;

    const created: BillVersionRecord = {
      id: `bill-version-${String(this.versions.length + 1).padStart(3, "0")}`,
      projectId: input.projectId,
      stageCode: input.stageCode,
      disciplineCode: input.disciplineCode,
      versionNo: nextVersionNo,
      versionName: input.versionName,
      versionStatus: "editable",
      sourceVersionId: input.sourceVersionId ?? null,
    };

    this.versions.push(created);
    return created;
  }

  async updateStatus(input: {
    versionId: string;
    versionStatus: BillVersionRecord["versionStatus"];
  }): Promise<BillVersionRecord> {
    const target = this.versions.find((version) => version.id === input.versionId);
    if (!target) {
      throw new Error("Bill version not found");
    }

    target.versionStatus = input.versionStatus;
    return target;
  }
}

export class DbBillVersionRepository implements BillVersionRepository {
  constructor(private readonly db: ApiDatabase) {}

  async listByProjectId(projectId: string): Promise<BillVersionRecord[]> {
    const records = await this.db.query.billVersions.findMany({
      where: (table, { eq: isEqual }) => isEqual(table.projectId, projectId),
      orderBy: (table, { asc }) => [
        asc(table.stageCode),
        asc(table.disciplineCode),
        asc(table.versionNo),
      ],
    });

    return records.map(mapBillVersionRecord);
  }

  async listByContext(input: {
    projectId: string;
    stageCode: string;
    disciplineCode: string;
  }): Promise<BillVersionRecord[]> {
    const records = await this.db.query.billVersions.findMany({
      where: (table, { and: andAlso, eq: isEqual }) =>
        andAlso(
          isEqual(table.projectId, input.projectId),
          isEqual(table.stageCode, input.stageCode),
          isEqual(table.disciplineCode, input.disciplineCode),
        ),
      orderBy: (table, { asc }) => [asc(table.versionNo)],
    });

    return records.map(mapBillVersionRecord);
  }

  async findById(versionId: string): Promise<BillVersionRecord | null> {
    const record = await this.db.query.billVersions.findFirst({
      where: (table, { eq: isEqual }) => isEqual(table.id, versionId),
    });

    return record ? mapBillVersionRecord(record) : null;
  }

  async create(input: {
    projectId: string;
    stageCode: string;
    disciplineCode: string;
    versionName: string;
    sourceVersionId?: string | null;
  }): Promise<BillVersionRecord> {
    const [aggregate] = await this.db
      .select({
        maxVersionNo: sql<number>`coalesce(max(${billVersions.versionNo}), 0)`,
      })
      .from(billVersions)
      .where(
        and(
          eq(billVersions.projectId, input.projectId),
          eq(billVersions.stageCode, input.stageCode),
          eq(billVersions.disciplineCode, input.disciplineCode),
        ),
      );

    const [created] = await this.db
      .insert(billVersions)
      .values({
        id: randomUUID(),
        projectId: input.projectId,
        stageCode: input.stageCode,
        disciplineCode: input.disciplineCode,
        versionNo: Number(aggregate?.maxVersionNo ?? 0) + 1,
        versionName: input.versionName,
        versionStatus: "editable",
        sourceVersionId: input.sourceVersionId ?? null,
      })
      .returning();

    return mapBillVersionRecord(created);
  }

  async updateStatus(input: {
    versionId: string;
    versionStatus: BillVersionRecord["versionStatus"];
  }): Promise<BillVersionRecord> {
    const [updated] = await this.db
      .update(billVersions)
      .set({
        versionStatus: input.versionStatus,
      })
      .where(eq(billVersions.id, input.versionId))
      .returning();

    if (!updated) {
      throw new Error("Bill version not found");
    }

    return mapBillVersionRecord(updated);
  }
}

function mapBillVersionRecord(
  record: typeof billVersions.$inferSelect,
): BillVersionRecord {
  return {
    id: record.id,
    projectId: record.projectId,
    stageCode: record.stageCode,
    disciplineCode: record.disciplineCode,
    versionNo: record.versionNo,
    versionName: record.versionName,
    versionStatus: record.versionStatus as BillVersionRecord["versionStatus"],
    sourceVersionId: record.sourceVersionId ?? null,
  };
}
