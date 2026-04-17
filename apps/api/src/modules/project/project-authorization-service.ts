import type { ProjectDisciplineRecord } from "./project-discipline-repository.js";
import type { ProjectMemberRecord } from "./project-member-repository.js";
import type { ProjectStageRecord } from "./project-stage-repository.js";

export type AuthorizationContext = {
  projectId: string;
  stageCode?: string;
  disciplineCode?: string;
};

export type AuthorizationInput = AuthorizationContext & {
  userId: string;
};

type RolePolicy = {
  canEdit: boolean;
  bypassScopeChecks?: boolean;
};

const ROLE_POLICIES: Record<string, RolePolicy> = {
  system_admin: {
    canEdit: true,
    bypassScopeChecks: true,
  },
  project_owner: {
    canEdit: true,
    bypassScopeChecks: true,
  },
  cost_engineer: {
    canEdit: true,
  },
  reviewer: {
    canEdit: false,
  },
};

export class ProjectAuthorizationService {
  constructor(
    private readonly input: {
      stages: ProjectStageRecord[];
      disciplines: ProjectDisciplineRecord[];
      members: ProjectMemberRecord[];
    },
  ) {}

  canViewContext(input: AuthorizationInput): boolean {
    return this.evaluate(input, "view");
  }

  canEditContext(input: AuthorizationInput): boolean {
    return this.evaluate(input, "edit");
  }

  canManageProject(input: { projectId: string; userId: string }): boolean {
    const member = this.input.members.find(
      (candidate) =>
        candidate.projectId === input.projectId && candidate.userId === input.userId,
    );

    if (!member) {
      return false;
    }

    const policy = ROLE_POLICIES[member.roleCode];
    return Boolean(policy?.bypassScopeChecks);
  }

  private evaluate(
    input: AuthorizationInput,
    action: "view" | "edit",
  ): boolean {
    const member = this.input.members.find(
      (candidate) =>
        candidate.projectId === input.projectId && candidate.userId === input.userId,
    );

    if (!member) {
      return false;
    }

    if (!this.isKnownContext(input)) {
      return false;
    }

    const policy = ROLE_POLICIES[member.roleCode];
    if (!policy) {
      return false;
    }

    if (action === "edit" && !policy.canEdit) {
      return false;
    }

    if (policy.bypassScopeChecks) {
      return true;
    }

    return this.matchesScopes(member, input);
  }

  private isKnownContext(input: AuthorizationContext): boolean {
    if (input.stageCode) {
      const knownStage = this.input.stages.some(
        (stage) =>
          stage.projectId === input.projectId && stage.stageCode === input.stageCode,
      );
      if (!knownStage) {
        return false;
      }
    }

    if (input.disciplineCode) {
      const knownDiscipline = this.input.disciplines.some(
        (discipline) =>
          discipline.projectId === input.projectId &&
          discipline.disciplineCode === input.disciplineCode,
      );
      if (!knownDiscipline) {
        return false;
      }
    }

    return true;
  }

  private matchesScopes(
    member: ProjectMemberRecord,
    input: AuthorizationContext,
  ): boolean {
    const scopeChecks = [
      input.stageCode
        ? member.scopes.some(
            (scope) =>
              scope.scopeType === "stage" && scope.scopeValue === input.stageCode,
          )
        : true,
      input.disciplineCode
        ? member.scopes.some(
            (scope) =>
              scope.scopeType === "discipline" &&
              scope.scopeValue === input.disciplineCode,
          )
        : true,
    ];

    return scopeChecks.every(Boolean);
  }
}
