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
}

export class InMemoryProjectStageRepository implements ProjectStageRepository {
  constructor(private readonly stages: ProjectStageRecord[]) {}

  async listByProjectId(projectId: string): Promise<ProjectStageRecord[]> {
    return this.stages
      .filter((stage) => stage.projectId === projectId)
      .sort((left, right) => left.sequenceNo - right.sequenceNo);
  }
}
