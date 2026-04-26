import test from "node:test";
import assert from "node:assert/strict";

import {
  ProjectAuthorizationService,
  type AuthorizationContext,
} from "../src/modules/project/project-authorization-service.js";
import type { ProjectDisciplineRecord } from "../src/modules/project/project-discipline-repository.js";
import type { ProjectMemberRecord } from "../src/modules/project/project-member-repository.js";
import type { ProjectStageRecord } from "../src/modules/project/project-stage-repository.js";

const stages: ProjectStageRecord[] = [
  {
    id: "stage-001",
    projectId: "project-001",
    stageCode: "estimate",
    stageName: "投资估算",
    status: "draft",
    sequenceNo: 1,
  },
  {
    id: "stage-002",
    projectId: "project-001",
    stageCode: "budget",
    stageName: "施工图预算",
    status: "draft",
    sequenceNo: 2,
  },
];

const disciplines: ProjectDisciplineRecord[] = [
  {
    id: "discipline-001",
    projectId: "project-001",
    disciplineCode: "building",
    disciplineName: "建筑工程",
    defaultStandardSetCode: "js-2013-building",
    status: "enabled",
  },
  {
    id: "discipline-002",
    projectId: "project-001",
    disciplineCode: "installation",
    disciplineName: "安装工程",
    defaultStandardSetCode: "js-2013-installation",
    status: "enabled",
  },
];

const members: ProjectMemberRecord[] = [
  {
    id: "member-001",
    projectId: "project-001",
    userId: "owner-001",
    displayName: "Owner User",
    roleCode: "project_owner",
    scopes: [{ scopeType: "project", scopeValue: "project-001" }],
  },
  {
    id: "member-002",
    projectId: "project-001",
    userId: "engineer-001",
    displayName: "Cost Engineer",
    roleCode: "cost_engineer",
    scopes: [
      { scopeType: "stage", scopeValue: "estimate" },
      { scopeType: "discipline", scopeValue: "building" },
    ],
  },
  {
    id: "member-003",
    projectId: "project-001",
    userId: "reviewer-001",
    displayName: "Reviewer User",
    roleCode: "reviewer",
    scopes: [{ scopeType: "stage", scopeValue: "estimate" }],
  },
];

const scopedContext: AuthorizationContext = {
  projectId: "project-001",
  stageCode: "estimate",
  disciplineCode: "building",
};

test("project owner can view and edit any context in the project", () => {
  const service = new ProjectAuthorizationService({
    stages,
    disciplines,
    members,
  });

  assert.equal(
    service.canViewContext({
      ...scopedContext,
      userId: "owner-001",
    }),
    true,
  );
  assert.equal(
    service.canEditContext({
      ...scopedContext,
      userId: "owner-001",
    }),
    true,
  );
});

test("cost engineer can view and edit only within authorized stage and discipline scopes", () => {
  const service = new ProjectAuthorizationService({
    stages,
    disciplines,
    members,
  });

  assert.equal(
    service.canViewContext({
      ...scopedContext,
      userId: "engineer-001",
    }),
    true,
  );
  assert.equal(
    service.canEditContext({
      ...scopedContext,
      userId: "engineer-001",
    }),
    true,
  );
  assert.equal(
    service.canEditContext({
      projectId: "project-001",
      stageCode: "budget",
      disciplineCode: "building",
      userId: "engineer-001",
    }),
    false,
  );
  assert.equal(
    service.canEditContext({
      projectId: "project-001",
      stageCode: "estimate",
      disciplineCode: "installation",
      userId: "engineer-001",
    }),
    false,
  );
});

test("reviewer can view within scope but cannot edit", () => {
  const service = new ProjectAuthorizationService({
    stages,
    disciplines,
    members,
  });

  assert.equal(
    service.canViewContext({
      projectId: "project-001",
      stageCode: "estimate",
      userId: "reviewer-001",
    }),
    true,
  );
  assert.equal(
    service.canEditContext({
      projectId: "project-001",
      stageCode: "estimate",
      userId: "reviewer-001",
    }),
    false,
  );
});

test("unknown stages and disciplines are rejected before authorization succeeds", () => {
  const service = new ProjectAuthorizationService({
    stages,
    disciplines,
    members,
  });

  assert.equal(
    service.canViewContext({
      projectId: "project-001",
      stageCode: "unknown-stage",
      userId: "owner-001",
    }),
    false,
  );
  assert.equal(
    service.canViewContext({
      projectId: "project-001",
      disciplineCode: "unknown-discipline",
      userId: "owner-001",
    }),
    false,
  );
});

test("unknown role codes fail explicitly instead of silently denying access", () => {
  const service = new ProjectAuthorizationService({
    stages,
    disciplines,
    members: [
      ...members,
      {
        id: "member-004",
        projectId: "project-001",
        userId: "broken-001",
        displayName: "Broken Role User",
        roleCode: "mystery_role",
        scopes: [{ scopeType: "project", scopeValue: "project-001" }],
      },
    ],
  });

  assert.throws(
    () =>
      service.canViewContext({
        projectId: "project-001",
        userId: "broken-001",
      }),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "INVALID_ROLE_CODE",
  );
});
