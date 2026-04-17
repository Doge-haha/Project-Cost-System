import test from "node:test";
import assert from "node:assert/strict";

import { createApp } from "../src/app/create-app.js";
import { signAccessToken } from "../src/shared/auth/jwt.js";
import {
  InMemoryProjectRepository,
  type ProjectRecord,
} from "../src/modules/project/project-repository.js";
import {
  InMemoryProjectStageRepository,
  type ProjectStageRecord,
} from "../src/modules/project/project-stage-repository.js";
import {
  InMemoryProjectDisciplineRepository,
  type ProjectDisciplineRecord,
} from "../src/modules/project/project-discipline-repository.js";
import {
  InMemoryProjectMemberRepository,
  type ProjectMemberRecord,
} from "../src/modules/project/project-member-repository.js";
import {
  InMemoryPriceVersionRepository,
  type PriceVersionRecord,
} from "../src/modules/pricing/price-version-repository.js";
import {
  InMemoryFeeTemplateRepository,
  type FeeTemplateRecord,
} from "../src/modules/fee/fee-template-repository.js";

const jwtSecret = "test-secret-1234567890";
const seededProjects: ProjectRecord[] = [
  {
    id: "project-001",
    code: "PRJ-001",
    name: "新点 SaaS 计价一期",
    status: "draft",
  },
];
const seededStages: ProjectStageRecord[] = [
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
const seededDisciplines: ProjectDisciplineRecord[] = [
  {
    id: "discipline-001",
    projectId: "project-001",
    disciplineCode: "building",
    disciplineName: "建筑工程",
    defaultStandardSetCode: "js-2013-building",
    status: "enabled",
  },
];
const seededMembers: ProjectMemberRecord[] = [
  {
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
  },
  {
    id: "member-002",
    projectId: "project-001",
    userId: "user-002",
    displayName: "Cost Engineer",
    roleCode: "cost_engineer",
    scopes: [
      {
        scopeType: "stage",
        scopeValue: "estimate",
      },
      {
        scopeType: "discipline",
        scopeValue: "building",
      },
    ],
  },
];
const seededPriceVersions: PriceVersionRecord[] = [
  {
    id: "price-version-001",
    versionCode: "JS-2024-BUILDING",
    versionName: "江苏 2024 建筑价目",
    regionCode: "JS",
    disciplineCode: "building",
    status: "active",
  },
];
const seededFeeTemplates: FeeTemplateRecord[] = [
  {
    id: "fee-template-001",
    templateName: "江苏建筑默认取费",
    projectType: "building",
    regionCode: "JS",
    stageScope: ["estimate"],
    taxMode: "general",
    allocationMode: "proportional",
    status: "active",
  },
];

test("GET /health stays public", async () => {
  const app = createApp({ jwtSecret });

  const response = await app.inject({
    method: "GET",
    url: "/health",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    ok: true,
  });

  await app.close();
});

test("signAccessToken rejects insecure JWT secrets", async () => {
  await assert.rejects(
    () =>
      signAccessToken(
        {
          sub: "user-001",
          roleCodes: ["project_owner"],
          displayName: "Owner User",
        },
        "short-secret",
      ),
    /JWT secret must be at least 16 characters long/,
  );
});

test("GET /v1/projects/:id/stages returns the project's configured stages", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectStageRepository: new InMemoryProjectStageRepository(seededStages),
  });
  const token = await signAccessToken(
    {
      sub: "user-006",
      roleCodes: ["project_owner"],
      displayName: "Stage User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/stages",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    items: seededStages,
  });

  await app.close();
});

test("GET /v1/projects/:id/disciplines returns the project's enabled disciplines", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      seededDisciplines,
    ),
  });
  const token = await signAccessToken(
    {
      sub: "user-007",
      roleCodes: ["project_owner"],
      displayName: "Discipline User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/disciplines",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    items: seededDisciplines,
  });

  await app.close();
});

test("GET /v1/projects/:id/stages returns 404 when the project is missing", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectStageRepository: new InMemoryProjectStageRepository(seededStages),
  });
  const token = await signAccessToken(
    {
      sub: "user-008",
      roleCodes: ["project_owner"],
      displayName: "Missing Stage Project User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url: "/v1/projects/project-404/stages",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), {
    error: {
      code: "PROJECT_NOT_FOUND",
      message: "Project not found",
    },
  });

  await app.close();
});

test("GET /v1/projects/:id/members returns the project's member list with scopes", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
  });
  const token = await signAccessToken(
    {
      sub: "user-009",
      roleCodes: ["project_owner"],
      displayName: "Member User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/members",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    items: seededMembers,
  });

  await app.close();
});

test("PUT /v1/projects/:id/default-pricing-config updates project default price version and fee template", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectStageRepository: new InMemoryProjectStageRepository(seededStages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      seededDisciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
    priceVersionRepository: new InMemoryPriceVersionRepository(
      seededPriceVersions,
    ),
    feeTemplateRepository: new InMemoryFeeTemplateRepository(
      seededFeeTemplates,
    ),
  });
  const token = await signAccessToken(
    {
      sub: "user-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "PUT",
    url: "/v1/projects/project-001/default-pricing-config",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      defaultPriceVersionId: "price-version-001",
      defaultFeeTemplateId: "fee-template-001",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    ...seededProjects[0],
    defaultPriceVersionId: "price-version-001",
    defaultFeeTemplateId: "fee-template-001",
  });

  const auditResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/audit-logs?resourceType=project&resourceId=project-001",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(auditResponse.statusCode, 200);
  assert.equal(auditResponse.json().items.length, 1);
  assert.equal(auditResponse.json().items[0].action, "update_pricing_defaults");
  assert.deepEqual(auditResponse.json().items[0].beforePayload, {
    defaultPriceVersionId: null,
    defaultFeeTemplateId: null,
  });
  assert.deepEqual(auditResponse.json().items[0].afterPayload, {
    defaultPriceVersionId: "price-version-001",
    defaultFeeTemplateId: "fee-template-001",
  });

  await app.close();
});

test("PUT /v1/projects/:id/default-pricing-config rejects non-managers", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectStageRepository: new InMemoryProjectStageRepository(seededStages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      seededDisciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
    priceVersionRepository: new InMemoryPriceVersionRepository(
      seededPriceVersions,
    ),
    feeTemplateRepository: new InMemoryFeeTemplateRepository(
      seededFeeTemplates,
    ),
  });
  const token = await signAccessToken(
    {
      sub: "user-002",
      roleCodes: ["cost_engineer"],
      displayName: "Cost Engineer",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "PUT",
    url: "/v1/projects/project-001/default-pricing-config",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      defaultPriceVersionId: "price-version-001",
    },
  });

  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.json(), {
    error: {
      code: "FORBIDDEN",
      message: "You do not have permission to manage this project",
    },
  });

  await app.close();
});

test("GET /v1/me rejects requests without a bearer token", async () => {
  const app = createApp({ jwtSecret });

  const response = await app.inject({
    method: "GET",
    url: "/v1/me",
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), {
    error: {
      code: "UNAUTHENTICATED",
      message: "Missing bearer token",
    },
  });

  await app.close();
});

test("GET /v1/me returns the authenticated user from a verified JWT", async () => {
  const app = createApp({ jwtSecret });
  const token = await signAccessToken(
    {
      sub: "user-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url: "/v1/me",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    id: "user-001",
    displayName: "Owner User",
    roleCodes: ["project_owner"],
  });

  await app.close();
});

test("GET /v1/projects normalizes pagination when auth is valid", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
  });
  const token = await signAccessToken(
    {
      sub: "user-002",
      roleCodes: ["cost_engineer"],
      displayName: "Cost Engineer",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url: "/v1/projects?page=2&pageSize=20",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    items: [],
    pagination: {
      page: 2,
      pageSize: 20,
      total: 1,
    },
  });

  await app.close();
});

test("GET /v1/projects rejects invalid pagination with a structured validation error", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
  });
  const token = await signAccessToken(
    {
      sub: "user-003",
      roleCodes: ["cost_engineer"],
      displayName: "Bad Pagination User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url: "/v1/projects?page=0&pageSize=1000",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
      details: [
        {
          field: "page",
          message: "Too small: expected number to be >=1",
        },
        {
          field: "pageSize",
          message: "Too big: expected number to be <=200",
        },
      ],
    },
  });

  await app.close();
});

test("GET /v1/projects/:id returns the requested project", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
  });
  const token = await signAccessToken(
    {
      sub: "user-004",
      roleCodes: ["project_owner"],
      displayName: "Project Owner",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), seededProjects[0]);

  await app.close();
});

test("GET /v1/projects/:id returns a structured 404 when the project does not exist", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
  });
  const token = await signAccessToken(
    {
      sub: "user-005",
      roleCodes: ["project_owner"],
      displayName: "Missing Project User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url: "/v1/projects/project-404",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), {
    error: {
      code: "PROJECT_NOT_FOUND",
      message: "Project not found",
    },
  });

  await app.close();
});
