import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import type { ApiDatabase } from "../../infrastructure/database/database-client.js";
import { projectStages } from "../../infrastructure/database/schema.js";

export type ProjectStageRecord = {
  id: string;
  projectId: string;
  stageCode: string;
  stageName: string;
  status: "draft" | "active" | "submitted" | "approved" | "locked";
  sequenceNo: number;
};

export interface ProjectStageRepository {
  listByProjectId(projectId: string): Promise<ProjectStageRecord[]>;
  updateStatus(input: {
    projectId: string;
    stageCode: string;
    status: ProjectStageRecord["status"];
  }): Promise<ProjectStageRecord>;
  replaceByProjectId(
    projectId: string,
    stages: Array<Omit<ProjectStageRecord, "id" | "projectId"> & { id?: string }>,
  ): Promise<ProjectStageRecord[]>;
}

export class InMemoryProjectStageRepository implements ProjectStageRepository {
  private readonly stages: ProjectStageRecord[];

  constructor(seed: ProjectStageRecord[]) {
    this.stages = seed.map((stage) => ({ ...stage }));
  }

  async listByProjectId(projectId: string): Promise<ProjectStageRecord[]> {
    return this.stages
      .filter((stage) => stage.projectId === projectId)
      .sort((left, right) => left.sequenceNo - right.sequenceNo);
  }

  async updateStatus(input: {
    projectId: string;
    stageCode: string;
    status: ProjectStageRecord["status"];
  }): Promise<ProjectStageRecord> {
    const target = this.stages.find(
      (stage) =>
        stage.projectId === input.projectId && stage.stageCode === input.stageCode,
    );
    if (!target) {
      throw new Error("Project stage not found");
    }

    target.status = input.status;
    return { ...target };
  }

  async replaceByProjectId(
    projectId: string,
    stages: Array<Omit<ProjectStageRecord, "id" | "projectId"> & { id?: string }>,
  ): Promise<ProjectStageRecord[]> {
    const retained = this.stages.filter((stage) => stage.projectId !== projectId);
    const created = stages
      .map((stage) => ({
        id: stage.id ?? `stage-${String(retained.length + 1).padStart(3, "0")}-${stage.stageCode}`,
        projectId,
        stageCode: stage.stageCode,
        stageName: stage.stageName,
        status: stage.status,
        sequenceNo: stage.sequenceNo,
      }))
      .sort((left, right) => left.sequenceNo - right.sequenceNo);

    this.stages.length = 0;
    this.stages.push(...retained, ...created);

    return created;
  }
}

export class DbProjectStageRepository implements ProjectStageRepository {
  constructor(private readonly db: ApiDatabase) {}

  async listByProjectId(projectId: string): Promise<ProjectStageRecord[]> {
    const records = await this.db.query.projectStages.findMany({
      where: (table, { eq }) => eq(table.projectId, projectId),
      orderBy: (table, { asc }) => [asc(table.sequenceNo)],
    });

    return records.map((record) => ({
      id: record.id,
      projectId: record.projectId,
      stageCode: record.stageCode,
      stageName: record.stageName,
      status: record.status as ProjectStageRecord["status"],
      sequenceNo: record.sequenceNo,
    }));
  }

  async updateStatus(input: {
    projectId: string;
    stageCode: string;
    status: ProjectStageRecord["status"];
  }): Promise<ProjectStageRecord> {
    const [updated] = await this.db
      .update(projectStages)
      .set({ status: input.status })
      .where(
        and(
          eq(projectStages.projectId, input.projectId),
          eq(projectStages.stageCode, input.stageCode),
        ),
      )
      .returning();

    if (!updated) {
      throw new Error("Project stage not found");
    }

    return {
      id: updated.id,
      projectId: updated.projectId,
      stageCode: updated.stageCode,
      stageName: updated.stageName,
      status: updated.status as ProjectStageRecord["status"],
      sequenceNo: updated.sequenceNo,
    };
  }

  async replaceByProjectId(
    projectId: string,
    stages: Array<Omit<ProjectStageRecord, "id" | "projectId"> & { id?: string }>,
  ): Promise<ProjectStageRecord[]> {
    await this.db.delete(projectStages).where(eq(projectStages.projectId, projectId));

    if (stages.length === 0) {
      return [];
    }

    const created = await this.db
      .insert(projectStages)
      .values(
        stages.map((stage) => ({
          id: stage.id ?? randomUUID(),
          projectId,
          stageCode: stage.stageCode,
          stageName: stage.stageName,
          status: stage.status,
          sequenceNo: stage.sequenceNo,
        })),
      )
      .returning();

    return created
      .map((record) => ({
        id: record.id,
        projectId: record.projectId,
        stageCode: record.stageCode,
        stageName: record.stageName,
        status: record.status as ProjectStageRecord["status"],
        sequenceNo: record.sequenceNo,
      }))
      .sort((left, right) => left.sequenceNo - right.sequenceNo);
  }
}
