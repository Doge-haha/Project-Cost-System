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

const jwtSecret = "bill-version-test-secret";

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
    id: "bill-version-010",
    projectId: "project-001",
    stageCode: "estimate",
    disciplineCode: "building",
    versionNo: 10,
    versionName: "空版本",
    versionStatus: "editable",
    sourceVersionId: null,
  },
  {
    id: "bill-version-011",
    projectId: "project-001",
    stageCode: "estimate",
    disciplineCode: "building",
    versionNo: 11,
    versionName: "重复编码版本",
    versionStatus: "editable",
    sourceVersionId: null,
  },
  {
    id: "bill-version-012",
    projectId: "project-001",
    stageCode: "estimate",
    disciplineCode: "building",
    versionNo: 12,
    versionName: "已通过版本",
    versionStatus: "approved",
    sourceVersionId: null,
  },
  {
    id: "bill-version-013",
    projectId: "project-001",
    stageCode: "estimate",
    disciplineCode: "building",
    versionNo: 13,
    versionName: "已锁定版本",
    versionStatus: "locked",
    sourceVersionId: null,
  },
  {
    id: "bill-version-014",
    projectId: "project-001",
    stageCode: "budget",
    disciplineCode: "building",
    versionNo: 1,
    versionName: "预算版 V1",
    versionStatus: "editable",
    sourceVersionId: null,
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
  {
    id: "bill-item-002",
    billVersionId: "bill-version-001",
    parentId: "bill-item-001",
    itemCode: "A.1.1",
    itemName: "机械挖土方",
    quantity: 80,
    unit: "m3",
    sortNo: 2,
  },
  {
    id: "bill-item-010",
    billVersionId: "bill-version-011",
    parentId: null,
    itemCode: "DUP-1",
    itemName: "重复编码一",
    quantity: 10,
    unit: "m2",
    sortNo: 1,
  },
  {
    id: "bill-item-011",
    billVersionId: "bill-version-011",
    parentId: null,
    itemCode: "DUP-1",
    itemName: "重复编码二",
    quantity: 12,
    unit: "m2",
    sortNo: 2,
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

function createBillVersionApp() {
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

test("GET /v1/projects/:id/bill-versions returns scoped versions", async () => {
  const app = createBillVersionApp();
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
    url: "/v1/projects/project-001/bill-versions?stageCode=estimate&disciplineCode=building",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    items: billVersions.filter(
      (version) =>
        version.stageCode === "estimate" && version.disciplineCode === "building",
    ),
  });

  await app.close();
});

test("GET /v1/projects/:id/bill-versions/:versionId returns version detail", async () => {
  const app = createBillVersionApp();
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
    url: "/v1/projects/project-001/bill-versions/bill-version-001",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), billVersions[0]);

  await app.close();
});

test("GET /v1/projects/:id/bill-versions/:versionId rejects requests outside scope", async () => {
  const app = createBillVersionApp();
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
    url: "/v1/projects/project-001/bill-versions/bill-version-014",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 403);

  await app.close();
});

test("GET /v1/projects/:id/bill-versions/:versionId/validation-summary reports EMPTY_VERSION for empty versions", async () => {
  const app = createBillVersionApp();
  const token = await signAccessToken(
    {
      sub: "owner-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/bill-versions/bill-version-010/validation-summary",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    passed: false,
    errorCount: 1,
    warningCount: 0,
    issues: [
      {
        code: "EMPTY_VERSION",
        severity: "error",
        message: "Bill version must contain at least one item before submission",
      },
    ],
  });

  await app.close();
});

test("GET /v1/projects/:id/bill-versions/:versionId/validation-summary reports duplicate item codes", async () => {
  const app = createBillVersionApp();
  const token = await signAccessToken(
    {
      sub: "owner-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/bill-versions/bill-version-011/validation-summary",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    passed: false,
    errorCount: 1,
    warningCount: 0,
    issues: [
      {
        code: "DUPLICATE_ITEM_CODE",
        severity: "error",
        message: "Duplicate bill item code detected",
        itemCode: "DUP-1",
      },
    ],
  });

  await app.close();
});

test("GET /v1/projects/:id/bill-versions/:versionId/validation-summary reports missing work items as warnings", async () => {
  const app = createBillVersionApp();
  const token = await signAccessToken(
    {
      sub: "owner-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/bill-versions/bill-version-001/validation-summary",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    passed: true,
    errorCount: 0,
    warningCount: 1,
    issues: [
      {
        code: "MISSING_WORK_ITEMS",
        severity: "warning",
        message: "Bill item has no work items",
        itemCode: "A.1.1",
      },
    ],
  });

  await app.close();
});

test("POST /v1/projects/:id/bill-versions/:versionId/submit submits a valid version", async () => {
  const app = createBillVersionApp();
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
    url: "/v1/projects/project-001/bill-versions/bill-version-001/submit",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    id: "bill-version-001",
    projectId: "project-001",
    stageCode: "estimate",
    disciplineCode: "building",
    versionNo: 1,
    versionName: "估算版 V1",
    versionStatus: "submitted",
    sourceVersionId: null,
  });

  const stagesResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/stages",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(stagesResponse.statusCode, 200);
  assert.equal(stagesResponse.json().items[0].status, "submitted");

  await app.close();
});

test("POST /v1/projects/:id/bill-versions/:versionId/submit rejects invalid versions with structured issues", async () => {
  const app = createBillVersionApp();
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
    url: "/v1/projects/project-001/bill-versions/bill-version-010/submit",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "Bill version cannot be submitted",
      details: [
        {
          code: "EMPTY_VERSION",
          severity: "error",
          message: "Bill version must contain at least one item before submission",
        },
      ],
    },
  });

  await app.close();
});

test("POST /v1/projects/:id/bill-versions/:versionId/withdraw restores a submitted version to editable", async () => {
  const app = createBillVersionApp();
  const token = await signAccessToken(
    {
      sub: "engineer-001",
      roleCodes: ["cost_engineer"],
      displayName: "Cost Engineer",
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
    url: "/v1/projects/project-001/bill-versions/bill-version-001/withdraw",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    id: "bill-version-001",
    projectId: "project-001",
    stageCode: "estimate",
    disciplineCode: "building",
    versionNo: 1,
    versionName: "估算版 V1",
    versionStatus: "editable",
    sourceVersionId: null,
  });

  const stagesResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/stages",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(stagesResponse.statusCode, 200);
  assert.equal(stagesResponse.json().items[0].status, "active");

  await app.close();
});

test("POST /v1/projects/:id/bill-versions/:versionId/lock locks an approved version", async () => {
  const app = createBillVersionApp();
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
    url: "/v1/projects/project-001/bill-versions/bill-version-012/lock",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().versionStatus, "locked");

  const stagesResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/stages",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(stagesResponse.statusCode, 200);
  assert.equal(stagesResponse.json().items[0].status, "locked");

  const auditResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/audit-logs?resourceType=bill_version&resourceId=bill-version-012&action=lock",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(auditResponse.statusCode, 200);
  assert.equal(auditResponse.json().items.length, 1);

  await app.close();
});

test("POST /v1/projects/:id/bill-versions/:versionId/unlock reopens a locked version with a reason", async () => {
  const app = createBillVersionApp();
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
    url: "/v1/projects/project-001/bill-versions/bill-version-013/unlock",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      reason: "补充审计调整",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().versionStatus, "editable");

  const stagesResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/stages",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(stagesResponse.statusCode, 200);
  assert.equal(stagesResponse.json().items[0].status, "active");

  const auditResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/audit-logs?resourceType=bill_version&resourceId=bill-version-013&action=unlock",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(auditResponse.statusCode, 200);
  assert.equal(auditResponse.json().items[0].afterPayload.reason, "补充审计调整");

  await app.close();
});

test("POST /v1/projects/:id/bill-versions/:versionId/copy-from clones items and work items into a new version", async () => {
  const app = createBillVersionApp();
  const token = await signAccessToken(
    {
      sub: "engineer-001",
      roleCodes: ["cost_engineer"],
      displayName: "Cost Engineer",
    },
    jwtSecret,
  );

  const createResponse = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/bill-versions/bill-version-001/copy-from",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(createResponse.statusCode, 201);
  assert.deepEqual(createResponse.json(), {
    id: "bill-version-007",
    projectId: "project-001",
    stageCode: "estimate",
    disciplineCode: "building",
    versionNo: 14,
    versionName: "估算版 V1 - Copy",
    versionStatus: "editable",
    sourceVersionId: "bill-version-001",
    sourceStageId: "stage-001",
  });

  const itemsResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/bill-versions/bill-version-007/items",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(itemsResponse.statusCode, 200);
  assert.deepEqual(itemsResponse.json(), {
    items: [
      {
        id: "bill-item-005",
        billVersionId: "bill-version-007",
        parentId: null,
        itemCode: "A.1",
        itemName: "土石方工程",
        quantity: 100,
        unit: "m3",
        sortNo: 1,
      },
        {
          id: "bill-item-006",
          billVersionId: "bill-version-007",
          parentId: "bill-item-005",
          itemCode: "A.1.1",
          itemName: "机械挖土方",
          quantity: 80,
          unit: "m3",
          sortNo: 2,
          systemUnitPrice: null,
          manualUnitPrice: null,
          finalUnitPrice: null,
          systemAmount: null,
          finalAmount: null,
          calculatedAt: null,
        },
      ],
    });

  const workItemsResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/bill-versions/bill-version-007/items/bill-item-005/work-items",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(workItemsResponse.statusCode, 200);
  assert.deepEqual(workItemsResponse.json(), {
    items: [
      {
        id: "work-item-002",
        billItemId: "bill-item-005",
        workContent: "机械挖土方",
        sortNo: 1,
      },
    ],
  });

  await app.close();
});

test("GET /v1/projects/:id/bill-versions/:versionId/source-chain returns the copied version lineage", async () => {
  const app = createBillVersionApp();
  const token = await signAccessToken(
    {
      sub: "engineer-001",
      roleCodes: ["cost_engineer"],
      displayName: "Cost Engineer",
    },
    jwtSecret,
  );

  const copyResponse = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/bill-versions/bill-version-001/copy-from",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  const chainResponse = await app.inject({
    method: "GET",
    url: `/v1/projects/project-001/bill-versions/${copyResponse.json().id}/source-chain`,
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(chainResponse.statusCode, 200);
  assert.equal(chainResponse.json().items.length, 2);
  assert.equal(chainResponse.json().items[0].id, copyResponse.json().id);
  assert.equal(chainResponse.json().items[1].id, "bill-version-001");

  await app.close();
});

test("GET /v1/projects/:id/bill-versions rejects requests outside scope", async () => {
  const app = createBillVersionApp();
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
    url: "/v1/projects/project-001/bill-versions?stageCode=budget&disciplineCode=building",
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

test("POST /v1/projects/:id/bill-versions creates a new version for an authorized context", async () => {
  const app = createBillVersionApp();
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
    url: "/v1/projects/project-001/bill-versions",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      stageCode: "estimate",
      disciplineCode: "building",
      versionName: "估算版 V2",
    },
  });

  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.json(), {
    id: "bill-version-007",
    projectId: "project-001",
    stageCode: "estimate",
    disciplineCode: "building",
    versionNo: 14,
    versionName: "估算版 V2",
    versionStatus: "editable",
    sourceVersionId: null,
  });

  await app.close();
});

test("POST /v1/projects/:id/bill-versions rejects unauthorized create attempts", async () => {
  const app = createBillVersionApp();
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
    url: "/v1/projects/project-001/bill-versions",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      stageCode: "estimate",
      disciplineCode: "installation",
      versionName: "越权创建",
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

test("POST /v1/projects/:id/bill-versions validates required payload fields", async () => {
  const app = createBillVersionApp();
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
    url: "/v1/projects/project-001/bill-versions",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      stageCode: "",
      disciplineCode: "building",
      versionName: "",
    },
  });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
      details: [
        {
          field: "stageCode",
          message: "Too small: expected string to have >=1 characters",
        },
        {
          field: "versionName",
          message: "Too small: expected string to have >=1 characters",
        },
      ],
    },
  });

  await app.close();
});

test("bill version mutations write audit logs", async () => {
  const app = createBillVersionApp();
  const ownerToken = await signAccessToken(
    {
      sub: "owner-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const createResponse = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/bill-versions",
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
    payload: {
      stageCode: "estimate",
      disciplineCode: "building",
      versionName: "审计测试版",
    },
  });

  assert.equal(createResponse.statusCode, 201);
  const createdVersionId = createResponse.json().id;

  const copyResponse = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/bill-versions/bill-version-001/copy-from",
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
  });

  assert.equal(copyResponse.statusCode, 201);

  const submitResponse = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/bill-versions/bill-version-001/submit",
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
  });

  assert.equal(submitResponse.statusCode, 200);

  const withdrawResponse = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/bill-versions/bill-version-001/withdraw",
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
  });

  assert.equal(withdrawResponse.statusCode, 200);

  const createAuditResponse = await app.inject({
    method: "GET",
    url: `/v1/projects/project-001/audit-logs?resourceType=bill_version&resourceId=${createdVersionId}&action=create`,
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
  });

  assert.equal(createAuditResponse.statusCode, 200);
  assert.equal(createAuditResponse.json().items.length, 1);

  const copyAuditResponse = await app.inject({
    method: "GET",
    url: `/v1/projects/project-001/audit-logs?resourceType=bill_version&resourceId=${copyResponse.json().id}&action=copy_from`,
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
  });

  assert.equal(copyAuditResponse.statusCode, 200);
  assert.equal(copyAuditResponse.json().items.length, 1);

  const submitAuditResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/audit-logs?resourceType=bill_version&resourceId=bill-version-001&action=submit",
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
  });

  assert.equal(submitAuditResponse.statusCode, 200);
  assert.equal(submitAuditResponse.json().items.length, 1);

  const withdrawAuditResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/audit-logs?resourceType=bill_version&resourceId=bill-version-001&action=withdraw",
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
  });

  assert.equal(withdrawAuditResponse.statusCode, 200);
  assert.equal(withdrawAuditResponse.json().items.length, 1);

  const stageAuditResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/audit-logs?resourceType=project_stage&action=update",
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
  });

  assert.equal(stageAuditResponse.statusCode, 200);
  const stageAuditStatuses = stageAuditResponse
    .json()
    .items.map((item: { afterPayload: { status: string } }) => item.afterPayload.status);
  assert.ok(stageAuditStatuses.includes("submitted"));
  assert.ok(stageAuditStatuses.includes("active"));
  assert.equal(
    stageAuditResponse.json().items[0].afterPayload.causeResourceType,
    "bill_version",
  );

  await app.close();
});
