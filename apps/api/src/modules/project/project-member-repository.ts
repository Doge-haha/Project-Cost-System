import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";

import type { ApiDatabase } from "../../infrastructure/database/database-client.js";
import {
  projectMembers,
  projectMemberScopes,
} from "../../infrastructure/database/schema.js";

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
  listByUserId(userId: string): Promise<ProjectMemberRecord[]>;
  replaceByProjectId(
    projectId: string,
    members: Array<Omit<ProjectMemberRecord, "id" | "projectId"> & { id?: string }>,
  ): Promise<ProjectMemberRecord[]>;
}

export class InMemoryProjectMemberRepository
  implements ProjectMemberRepository
{
  constructor(private readonly members: ProjectMemberRecord[]) {}

  async listByProjectId(projectId: string): Promise<ProjectMemberRecord[]> {
    return this.members.filter((member) => member.projectId === projectId);
  }

  async listByUserId(userId: string): Promise<ProjectMemberRecord[]> {
    return this.members.filter((member) => member.userId === userId);
  }

  async replaceByProjectId(
    projectId: string,
    members: Array<Omit<ProjectMemberRecord, "id" | "projectId"> & { id?: string }>,
  ): Promise<ProjectMemberRecord[]> {
    const retained = this.members.filter((member) => member.projectId !== projectId);
    const created = members.map((member) => ({
      id: member.id ?? randomUUID(),
      projectId,
      userId: member.userId,
      displayName: member.displayName,
      roleCode: member.roleCode,
      scopes: member.scopes.map((scope) => ({
        scopeType: scope.scopeType,
        scopeValue: scope.scopeValue,
      })),
    }));

    this.members.length = 0;
    this.members.push(...retained, ...created);

    return created;
  }
}

export class DbProjectMemberRepository implements ProjectMemberRepository {
  constructor(private readonly db: ApiDatabase) {}

  async listByProjectId(projectId: string): Promise<ProjectMemberRecord[]> {
    const members = await this.db.query.projectMembers.findMany({
      where: (table, { eq }) => eq(table.projectId, projectId),
      orderBy: (table, { asc }) => [asc(table.displayName), asc(table.id)],
    });
    if (members.length === 0) {
      return [];
    }

    const scopes = await this.db.query.projectMemberScopes.findMany({
      where: (table, { inArray }) =>
        inArray(
          table.memberId,
          members.map((member) => member.id),
        ),
      orderBy: (table, { asc }) => [asc(table.scopeType), asc(table.scopeValue)],
    });

    const scopesByMemberId = new Map<string, ProjectMemberScopeRecord[]>();
    for (const scope of scopes) {
      const items = scopesByMemberId.get(scope.memberId) ?? [];
      items.push({
        scopeType: scope.scopeType as ProjectMemberScopeRecord["scopeType"],
        scopeValue: scope.scopeValue,
      });
      scopesByMemberId.set(scope.memberId, items);
    }

    return members.map((member) => mapProjectMember(member, scopesByMemberId));
  }

  async listByUserId(userId: string): Promise<ProjectMemberRecord[]> {
    const members = await this.db.query.projectMembers.findMany({
      where: (table, { eq: isEqual }) => isEqual(table.userId, userId),
      orderBy: (table, { asc }) => [
        asc(table.projectId),
        asc(table.displayName),
        asc(table.id),
      ],
    });
    if (members.length === 0) {
      return [];
    }

    const scopes = await this.db.query.projectMemberScopes.findMany({
      where: (table, { inArray: isInArray }) =>
        isInArray(
          table.memberId,
          members.map((member) => member.id),
        ),
      orderBy: (table, { asc }) => [asc(table.scopeType), asc(table.scopeValue)],
    });

    const scopesByMemberId = new Map<string, ProjectMemberScopeRecord[]>();
    for (const scope of scopes) {
      const items = scopesByMemberId.get(scope.memberId) ?? [];
      items.push({
        scopeType: scope.scopeType as ProjectMemberScopeRecord["scopeType"],
        scopeValue: scope.scopeValue,
      });
      scopesByMemberId.set(scope.memberId, items);
    }

    return members.map((member) => mapProjectMember(member, scopesByMemberId));
  }

  async replaceByProjectId(
    projectId: string,
    members: Array<Omit<ProjectMemberRecord, "id" | "projectId"> & { id?: string }>,
  ): Promise<ProjectMemberRecord[]> {
    const existingMembers = await this.db.query.projectMembers.findMany({
      where: (table, { eq: isEqual }) => isEqual(table.projectId, projectId),
    });

    if (existingMembers.length > 0) {
      await this.db
        .delete(projectMemberScopes)
        .where(
          inArray(
            projectMemberScopes.memberId,
            existingMembers.map((member) => member.id),
          ),
        );
    }

    await this.db.delete(projectMembers).where(eq(projectMembers.projectId, projectId));

    if (members.length === 0) {
      return [];
    }

    const memberRows = members.map((member) => ({
      id: member.id ?? randomUUID(),
      projectId,
      userId: member.userId,
      displayName: member.displayName,
      roleCode: member.roleCode,
    }));
    const createdMembers = await this.db
      .insert(projectMembers)
      .values(memberRows)
      .returning();

    const scopeRows = createdMembers.flatMap((member, index) =>
      members[index]!.scopes.map((scope) => ({
        id: randomUUID(),
        memberId: member.id,
        scopeType: scope.scopeType,
        scopeValue: scope.scopeValue,
      })),
    );

    if (scopeRows.length > 0) {
      await this.db.insert(projectMemberScopes).values(scopeRows);
    }

    return createdMembers.map((member, index) => ({
      id: member.id,
      projectId: member.projectId,
      userId: member.userId,
      displayName: member.displayName,
      roleCode: member.roleCode,
      scopes: members[index]!.scopes.map((scope) => ({
        scopeType: scope.scopeType,
        scopeValue: scope.scopeValue,
      })),
    }));
  }
}

function mapProjectMember(
  member: typeof projectMembers.$inferSelect,
  scopesByMemberId: Map<string, ProjectMemberScopeRecord[]>,
): ProjectMemberRecord {
  return {
    id: member.id,
    projectId: member.projectId,
    userId: member.userId,
    displayName: member.displayName,
    roleCode: member.roleCode,
    scopes: scopesByMemberId.get(member.id) ?? [],
  };
}
