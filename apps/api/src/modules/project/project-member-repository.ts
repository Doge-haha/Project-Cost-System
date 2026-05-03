import { randomUUID } from "node:crypto";

import { eq, inArray, sql } from "drizzle-orm";

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

const PROJECT_MEMBER_SCOPE_TYPES = new Set<ProjectMemberScopeRecord["scopeType"]>([
  "project",
  "stage",
  "discipline",
  "unit",
]);

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
    const members = await this.db.execute(sql`
      select
        id,
        project_id as "projectId",
        user_id as "userId",
        display_name as "displayName",
        role_code as "roleCode"
      from project_member
      where project_id = ${projectId}
      order by display_name asc, id asc
    `);
    return this.mapMembersWithScopes(members.rows as Record<string, unknown>[]);
  }

  async listByUserId(userId: string): Promise<ProjectMemberRecord[]> {
    const members = await this.db.execute(sql`
      select
        id,
        project_id as "projectId",
        user_id as "userId",
        display_name as "displayName",
        role_code as "roleCode"
      from project_member
      where user_id = ${userId}
      order by project_id asc, display_name asc, id asc
    `);
    return this.mapMembersWithScopes(members.rows as Record<string, unknown>[]);
  }

  async replaceByProjectId(
    projectId: string,
    members: Array<Omit<ProjectMemberRecord, "id" | "projectId"> & { id?: string }>,
  ): Promise<ProjectMemberRecord[]> {
    const existingMembers = await this.listByProjectId(projectId);

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
    await this.db.insert(projectMembers).values(memberRows);

    const scopeRows = memberRows.flatMap((member, index) =>
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

    return memberRows.map((member, index) => ({
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

  private async mapMembersWithScopes(
    members: Record<string, unknown>[],
  ): Promise<ProjectMemberRecord[]> {
    if (members.length === 0) {
      return [];
    }

    const memberIds = members.map((member) => readStringField(member, "id", "id"));
    const scopes = await this.db.execute(sql`
      select
        member_id as "memberId",
        scope_type as "scopeType",
        scope_value as "scopeValue"
      from project_member_scope
      where member_id in (${sql.join(memberIds.map((id) => sql`${id}`), sql`, `)})
      order by scope_type asc, scope_value asc
    `);
    const scopesByMemberId = new Map<string, ProjectMemberScopeRecord[]>();
    for (const scope of scopes.rows as Record<string, unknown>[]) {
      const memberId = readStringField(scope, "memberId", "member_id");
      const items = scopesByMemberId.get(memberId) ?? [];
      items.push({
        scopeType: readScopeTypeField(scope, "scopeType", "scope_type"),
        scopeValue: readStringField(scope, "scopeValue", "scope_value"),
      });
      scopesByMemberId.set(memberId, items);
    }

    return members.map((member) => mapProjectMember(member, scopesByMemberId));
  }
}

function mapProjectMember(
  member: Record<string, unknown>,
  scopesByMemberId: Map<string, ProjectMemberScopeRecord[]>,
): ProjectMemberRecord {
  const id = readStringField(member, "id", "id");

  return {
    id,
    projectId: readStringField(member, "projectId", "project_id"),
    userId: readStringField(member, "userId", "user_id"),
    displayName: readStringField(member, "displayName", "display_name"),
    roleCode: readStringField(member, "roleCode", "role_code"),
    scopes: scopesByMemberId.get(id) ?? [],
  };
}

function readStringField(
  record: Record<string, unknown>,
  camelKey: string,
  snakeKey: string,
): string {
  const value = record[camelKey] ?? record[snakeKey];
  if (typeof value !== "string") {
    throw new Error(`Project member field ${camelKey} is missing`);
  }
  return value;
}

function readScopeTypeField(
  record: Record<string, unknown>,
  camelKey: string,
  snakeKey: string,
): ProjectMemberScopeRecord["scopeType"] {
  const value = readStringField(record, camelKey, snakeKey);
  if (!PROJECT_MEMBER_SCOPE_TYPES.has(value as ProjectMemberScopeRecord["scopeType"])) {
    throw new Error(`Project member field ${camelKey} is invalid`);
  }
  return value as ProjectMemberScopeRecord["scopeType"];
}
