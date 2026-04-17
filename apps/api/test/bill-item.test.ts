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
  InMemoryBillVersionRepository,
  type BillVersionRecord,
} from "../src/modules/bill/bill-version-repository.js";
import {
  InMemoryBillItemRepository,
  type BillItemRecord,
} from "../src/modules/bill/bill-item-repository.js";
import {
  InMemoryBillWorkItemRepository,
  type BillWorkItemRecord,
} from "../src/modules/bill/bill-work-item-repository.js";

const jwtSecret = "bill-item-test-secret";

const projects: ProjectRecord[] = [
  {
    id: "project-001",
    code: "PRJ-001",
    name: "新点 SaaS 计价一期",
    status: "draft",
  },
];

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
];

const billVersions: BillVersionRecord[] = [
  {
    id: "bill-version-001",
    projectId: "project-001",
    stageCode: "estimate",
    disciplineCode: "building",
    versionNo: 1,
    versionName: "估算版 V1",
    versionStatus: "editable",
    sourceVersionId: null,
  },
  {
    id: "bill-version-002",
    projectId: "project-001",
    stageCode: "estimate",
    disciplineCode: "installation",
    versionNo: 2,
    versionName: "估算版 V2",
    versionStatus: "editable",
    sourceVersionId: "bill-version-001",
  },
];

const billItems: BillItemRecord[] = [
  {
    id: "bill-item-001",
    billVersionId: "bill-version-001",
    parentId: null,
    itemCode: "A.1",
    itemName: "土石方工程",
    quantity: 100,
    unit: "m3",
    sortNo: 1,
  },
];
const billWorkItems: BillWorkItemRecord[] = [
  {
    id: "work-item-001",
    billItemId: "bill-item-001",
    workContent: "机械挖土方",
    sortNo: 1,
  },
];

function createBillItemApp() {
  return createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(projects),
    projectStageRepository: new InMemoryProjectStageRepository(stages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      disciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(members),
    billVersionRepository: new InMemoryBillVersionRepository(billVersions),
    billItemRepository: new InMemoryBillItemRepository(billItems),
    billWorkItemRepository: new InMemoryBillWorkItemRepository(billWorkItems),
  });
}

test("GET /v1/projects/:id/bill-versions/:versionId/items returns the version items", async () => {
  const app = createBillItemApp();
  const token = await signAccessToken(
    {
      sub: "engineer-001",
      roleCodes: ["cost_engineer"],
      displayName: "Cost Engineer",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/bill-versions/bill-version-001/items",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    items: billItems,
  });

  await app.close();
});

test("GET /v1/projects/:id/bill-versions/:versionId/items/:itemId/work-items returns work items for the bill item", async () => {
  const app = createBillItemApp();
  const token = await signAccessToken(
    {
      sub: "engineer-001",
      roleCodes: ["cost_engineer"],
      displayName: "Cost Engineer",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/bill-versions/bill-version-001/items/bill-item-001/work-items",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    items: billWorkItems,
  });

  await app.close();
});

test("POST /v1/projects/:id/bill-versions/:versionId/items/:itemId/work-items creates a work item", async () => {
  const app = createBillItemApp();
  const token = await signAccessToken(
    {
      sub: "engineer-001",
      roleCodes: ["cost_engineer"],
      displayName: "Cost Engineer",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/bill-versions/bill-version-001/items/bill-item-001/work-items",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      workContent: "人工清底",
      sortNo: 2,
    },
  });

  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.json(), {
    id: "work-item-002",
    billItemId: "bill-item-001",
    workContent: "人工清底",
    sortNo: 2,
  });

  await app.close();
});

test("POST /v1/projects/:id/bill-versions/:versionId/items/:itemId/work-items rejects cross-version bill items", async () => {
  const app = createBillItemApp();
  const token = await signAccessToken(
    {
      sub: "owner-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/bill-versions/bill-version-002/items/bill-item-001/work-items",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      workContent: "跨版本工作内容",
      sortNo: 1,
    },
  });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "Bill item must belong to the target bill version",
    },
  });

  await app.close();
});

test("POST /v1/projects/:id/bill-versions/:versionId/items creates a child item within the same version", async () => {
  const app = createBillItemApp();
  const token = await signAccessToken(
    {
      sub: "engineer-001",
      roleCodes: ["cost_engineer"],
      displayName: "Cost Engineer",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/bill-versions/bill-version-001/items",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      parentId: "bill-item-001",
      itemCode: "A.1.1",
      itemName: "机械挖土方",
      quantity: 50,
      unit: "m3",
      sortNo: 2,
    },
  });

  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.json(), {
    id: "bill-item-002",
    billVersionId: "bill-version-001",
    parentId: "bill-item-001",
    itemCode: "A.1.1",
    itemName: "机械挖土方",
    quantity: 50,
    unit: "m3",
    sortNo: 2,
  });

  await app.close();
});

test("POST /v1/projects/:id/bill-versions/:versionId/items rejects parent items from another version", async () => {
  const app = createBillItemApp();
  const token = await signAccessToken(
    {
      sub: "owner-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/bill-versions/bill-version-002/items",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      parentId: "bill-item-001",
      itemCode: "B.1",
      itemName: "跨版本子项",
      quantity: 10,
      unit: "m2",
      sortNo: 1,
    },
  });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "Parent item must belong to the same bill version",
    },
  });

  await app.close();
});

test("GET /v1/projects/:id/bill-versions/:versionId/items rejects access outside scope", async () => {
  const app = createBillItemApp();
  const token = await signAccessToken(
    {
      sub: "engineer-001",
      roleCodes: ["cost_engineer"],
      displayName: "Cost Engineer",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/bill-versions/bill-version-002/items",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.json(), {
    error: {
      code: "FORBIDDEN",
      message: "You do not have permission to access this resource",
    },
  });

  await app.close();
});

test("POST /v1/projects/:id/bill-versions/:versionId/items rejects writes when the version is submitted", async () => {
  const app = createBillItemApp();
  const token = await signAccessToken(
    {
      sub: "owner-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/bill-versions/bill-version-001/submit",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  const response = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/bill-versions/bill-version-001/items",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      parentId: null,
      itemCode: "A.2",
      itemName: "提交后新增",
      quantity: 8,
      unit: "m3",
      sortNo: 3,
    },
  });

  assert.equal(response.statusCode, 423);
  assert.deepEqual(response.json(), {
    error: {
      code: "RESOURCE_LOCKED",
      message: "Bill version is not editable in its current status",
    },
  });

  await app.close();
});

test("PUT /v1/projects/:id/bill-versions/:versionId/items/:itemId updates an item within the same version", async () => {
  const app = createBillItemApp();
  const token = await signAccessToken(
    {
      sub: "engineer-001",
      roleCodes: ["cost_engineer"],
      displayName: "Cost Engineer",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "PUT",
    url: "/v1/projects/project-001/bill-versions/bill-version-001/items/bill-item-001",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      parentId: null,
      itemCode: "A.1",
      itemName: "土石方工程-更新",
      quantity: 120,
      unit: "m3",
      sortNo: 1,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    id: "bill-item-001",
    billVersionId: "bill-version-001",
    parentId: null,
    itemCode: "A.1",
    itemName: "土石方工程-更新",
    quantity: 120,
    unit: "m3",
    sortNo: 1,
    systemUnitPrice: null,
    manualUnitPrice: null,
    finalUnitPrice: null,
    systemAmount: null,
    finalAmount: null,
    calculatedAt: null,
  });

  await app.close();
});

test("PUT /v1/projects/:id/bill-versions/:versionId/items/:itemId rejects cross-version item updates", async () => {
  const app = createBillItemApp();
  const token = await signAccessToken(
    {
      sub: "owner-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "PUT",
    url: "/v1/projects/project-001/bill-versions/bill-version-002/items/bill-item-001",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      parentId: null,
      itemCode: "A.1",
      itemName: "跨版本更新",
      quantity: 120,
      unit: "m3",
      sortNo: 1,
    },
  });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "Bill item must belong to the target bill version",
    },
  });

  await app.close();
});

test("PUT /v1/projects/:id/bill-versions/:versionId/items/:itemId rejects writes when the version is submitted", async () => {
  const app = createBillItemApp();
  const token = await signAccessToken(
    {
      sub: "owner-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/bill-versions/bill-version-001/submit",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  const response = await app.inject({
    method: "PUT",
    url: "/v1/projects/project-001/bill-versions/bill-version-001/items/bill-item-001",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      parentId: null,
      itemCode: "A.1",
      itemName: "提交后更新",
      quantity: 120,
      unit: "m3",
      sortNo: 1,
    },
  });

  assert.equal(response.statusCode, 423);
  assert.deepEqual(response.json(), {
    error: {
      code: "RESOURCE_LOCKED",
      message: "Bill version is not editable in its current status",
    },
  });

  await app.close();
});
