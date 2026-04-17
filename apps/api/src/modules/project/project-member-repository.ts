export type ProjectMemberScopeRecord = {
  scopeType: "project" | "stage" | "discipline" | "unit";
  scopeValue: string;
};

export type ProjectMemberRecord = {
  id: string;
  projectId: string;
  userId: string;
  displayName: string;
  roleCode: string;
  scopes: ProjectMemberScopeRecord[];
};

export interface ProjectMemberRepository {
  listByProjectId(projectId: string): Promise<ProjectMemberRecord[]>;
}

export class InMemoryProjectMemberRepository
  implements ProjectMemberRepository
{
  constructor(private readonly members: ProjectMemberRecord[]) {}

  async listByProjectId(projectId: string): Promise<ProjectMemberRecord[]> {
    return this.members.filter((member) => member.projectId === projectId);
  }
}
