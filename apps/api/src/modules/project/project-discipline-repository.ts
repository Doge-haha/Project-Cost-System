import type { ApiDatabase } from "../../infrastructure/database/database-client.js";

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

export class DbProjectDisciplineRepository implements ProjectDisciplineRepository {
  constructor(private readonly db: ApiDatabase) {}

  async listByProjectId(projectId: string): Promise<ProjectDisciplineRecord[]> {
    const records = await this.db.query.projectDisciplines.findMany({
      where: (table, { eq }) => eq(table.projectId, projectId),
      orderBy: (table, { asc }) => [asc(table.disciplineCode)],
    });

    return records.map((record) => ({
      id: record.id,
      projectId: record.projectId,
      disciplineCode: record.disciplineCode,
      disciplineName: record.disciplineName,
      defaultStandardSetCode: record.defaultStandardSetCode ?? null,
      status: record.status as ProjectDisciplineRecord["status"],
    }));
  }
}
