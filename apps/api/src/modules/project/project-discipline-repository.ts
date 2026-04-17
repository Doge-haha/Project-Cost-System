export type ProjectDisciplineRecord = {
  id: string;
  projectId: string;
  disciplineCode: string;
  disciplineName: string;
  defaultStandardSetCode: string | null;
  status: "enabled" | "disabled";
};

export interface ProjectDisciplineRepository {
  listByProjectId(projectId: string): Promise<ProjectDisciplineRecord[]>;
}

export class InMemoryProjectDisciplineRepository
  implements ProjectDisciplineRepository
{
  constructor(private readonly disciplines: ProjectDisciplineRecord[]) {}

  async listByProjectId(projectId: string): Promise<ProjectDisciplineRecord[]> {
    return this.disciplines.filter(
      (discipline) => discipline.projectId === projectId,
    );
  }
}
