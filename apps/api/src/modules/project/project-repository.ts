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

    target.defaultPriceVersionId =
      input.defaultPriceVersionId ?? target.defaultPriceVersionId ?? null;
    target.defaultFeeTemplateId =
      input.defaultFeeTemplateId ?? target.defaultFeeTemplateId ?? null;

    return target;
  }
}
