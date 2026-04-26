import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import type { ApiDatabase } from "../../infrastructure/database/database-client.js";
import { projectStages } from "../../infrastructure/database/schema.js";

export type ProjectStageRecord = {
  id: string;
  projectId: string;
  stageCode: string;
  stageName: string;
  status: "draft" | "active" | "submitted" | "locked";
  sequenceNo: number;
};

export interface ProjectStageRepository {
  listByProjectId(projectId: string): Promise<ProjectStageRecord[]>;
  replaceByProjectId(
    projectId: string,
    stages: Array<Omit<ProjectStageRecord, "id" | "projectId"> & { id?: string }>,
  ): Promise<ProjectStageRecord[]>;
}

export class InMemoryProjectStageRepository implements ProjectStageRepository {
  constructor(private readonly stages: ProjectStageRecord[]) {}

  async listByProjectId(projectId: string): Promise<ProjectStageRecord[]> {
    return this.stages
      .filter((stage) => stage.projectId === projectId)
      .sort((left, right) => left.sequenceNo - right.sequenceNo);
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
