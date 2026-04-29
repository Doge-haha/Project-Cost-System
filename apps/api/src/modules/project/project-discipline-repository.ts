import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import type { ApiDatabase } from "../../infrastructure/database/database-client.js";
import { projectDisciplines } from "../../infrastructure/database/schema.js";

export type ProjectDisciplineRecord = {
  id: string;
  projectId: string;
  disciplineCode: string;
  disciplineName: string;
  defaultStandardSetCode: string | null;
  status: "enabled" | "disabled";
  sortOrder?: number;
};

export interface ProjectDisciplineRepository {
  listByProjectId(projectId: string): Promise<ProjectDisciplineRecord[]>;
  replaceByProjectId(
    projectId: string,
    disciplines: Array<
      Omit<ProjectDisciplineRecord, "id" | "projectId"> & { id?: string }
    >,
  ): Promise<ProjectDisciplineRecord[]>;
}

export class InMemoryProjectDisciplineRepository
  implements ProjectDisciplineRepository
{
  private readonly disciplines: ProjectDisciplineRecord[];

  constructor(seed: ProjectDisciplineRecord[]) {
    this.disciplines = seed.map((discipline) => ({ ...discipline }));
  }

  async listByProjectId(projectId: string): Promise<ProjectDisciplineRecord[]> {
    return this.disciplines
      .filter((discipline) => discipline.projectId === projectId)
      .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
  }

  async replaceByProjectId(
    projectId: string,
    disciplines: Array<
      Omit<ProjectDisciplineRecord, "id" | "projectId"> & { id?: string }
    >,
  ): Promise<ProjectDisciplineRecord[]> {
    const retained = this.disciplines.filter(
      (discipline) => discipline.projectId !== projectId,
    );
    const created = disciplines
      .map((discipline) => ({
        id: discipline.id ?? randomUUID(),
        projectId,
        disciplineCode: discipline.disciplineCode,
        disciplineName: discipline.disciplineName,
        defaultStandardSetCode: discipline.defaultStandardSetCode ?? null,
        status: discipline.status,
        sortOrder: discipline.sortOrder ?? 0,
      }))
      .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));

    this.disciplines.length = 0;
    this.disciplines.push(...retained, ...created);

    return created;
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
      sortOrder: record.sortOrder,
    }));
  }

  async replaceByProjectId(
    projectId: string,
    disciplines: Array<
      Omit<ProjectDisciplineRecord, "id" | "projectId"> & { id?: string }
    >,
  ): Promise<ProjectDisciplineRecord[]> {
    await this.db
      .delete(projectDisciplines)
      .where(eq(projectDisciplines.projectId, projectId));

    if (disciplines.length === 0) {
      return [];
    }

    const created = await this.db
      .insert(projectDisciplines)
      .values(
        disciplines.map((discipline) => ({
          id: discipline.id ?? randomUUID(),
          projectId,
          disciplineCode: discipline.disciplineCode,
          disciplineName: discipline.disciplineName,
          defaultStandardSetCode: discipline.defaultStandardSetCode ?? null,
          status: discipline.status,
          sortOrder: discipline.sortOrder ?? 0,
        })),
      )
      .returning();

    return created
      .map((record) => ({
        id: record.id,
        projectId: record.projectId,
        disciplineCode: record.disciplineCode,
        disciplineName: record.disciplineName,
        defaultStandardSetCode: record.defaultStandardSetCode ?? null,
        status: record.status as ProjectDisciplineRecord["status"],
        sortOrder: record.sortOrder,
      }))
      .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
  }
}
