import { createApp as createApiApp } from "../../../api/src/app/create-app.js";
import type { CreateAppOptions } from "../../../api/src/app/create-app-options.js";
import { signAccessToken } from "../../../api/src/shared/auth/jwt.js";
import {
  InMemoryProjectRepository,
  type ProjectRecord,
} from "../../../api/src/modules/project/project-repository.js";
import {
  InMemoryProjectStageRepository,
  type ProjectStageRecord,
} from "../../../api/src/modules/project/project-stage-repository.js";
import {
  InMemoryProjectDisciplineRepository,
  type ProjectDisciplineRecord,
} from "../../../api/src/modules/project/project-discipline-repository.js";
import {
  InMemoryProjectMemberRepository,
  type ProjectMemberRecord,
} from "../../../api/src/modules/project/project-member-repository.js";

export const gatewayTestJwtSecret = "mcp-gateway-e2e-secret";

export const gatewayTestProject: ProjectRecord = {
  id: "project-001",
  code: "PRJ-001",
  name: "新点 SaaS 计价一期",
  status: "draft",
};

export const gatewayTestStage: ProjectStageRecord = {
  id: "stage-001",
  projectId: "project-001",
  stageCode: "estimate",
  stageName: "投资估算",
  status: "draft",
  sequenceNo: 1,
};

export const gatewayTestDiscipline: ProjectDisciplineRecord = {
  id: "discipline-001",
  projectId: "project-001",
  disciplineCode: "building",
  disciplineName: "建筑工程",
  defaultStandardSetCode: "js-2013-building",
  status: "enabled",
};

export const gatewayTestOwner: ProjectMemberRecord = {
  id: "member-001",
  projectId: "project-001",
  userId: "user-001",
  displayName: "Owner User",
  roleCode: "project_owner",
  scopes: [
    {
      scopeType: "project",
      scopeValue: "project-001",
    },
  ],
};

export function createGatewayTestApiApp(input: {
  appOptions?: Partial<CreateAppOptions>;
}) {
  return createApiApp({
    jwtSecret: gatewayTestJwtSecret,
    projectRepository: new InMemoryProjectRepository([gatewayTestProject]),
    projectStageRepository: new InMemoryProjectStageRepository([gatewayTestStage]),
    projectDisciplineRepository:
      new InMemoryProjectDisciplineRepository([gatewayTestDiscipline]),
    projectMemberRepository: new InMemoryProjectMemberRepository([gatewayTestOwner]),
    ...(input.appOptions ?? {}),
  });
}

export async function createGatewayTestToken() {
  return signAccessToken(
    {
      sub: gatewayTestOwner.userId,
      displayName: gatewayTestOwner.displayName,
      roleCodes: [gatewayTestOwner.roleCode],
    },
    gatewayTestJwtSecret,
  );
}

export async function createGatewayTestTokenForUser(input: {
  sub: string;
  displayName: string;
  roleCodes: string[];
}) {
  return signAccessToken(input, gatewayTestJwtSecret);
}
