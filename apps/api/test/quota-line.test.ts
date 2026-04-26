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
  InMemoryQuotaLineRepository,
  type QuotaLineRecord,
} from "../src/modules/quota/quota-line-repository.js";
import {
  InMemoryPriceVersionRepository,
  type PriceVersionRecord,
} from "../src/modules/pricing/price-version-repository.js";

const jwtSecret = "quota-line-test-secret";

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
    versionName: "安装版 V1",
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
    billVersionId: "bill-version-002",
    parentId: null,
    itemCode: "B.1",
    itemName: "安装工程",
    quantity: 10,
    unit: "项",
    sortNo: 1,
  },
];

const quotaLines: QuotaLineRecord[] = [
  {
    id: "quota-line-001",
    billItemId: "bill-item-001",
    sourceStandardSetCode: "js-2013-building",
    sourceQuotaId: "quota-source-001",
    sourceSequence: 1,
    chapterCode: "01",
    quotaCode: "010101001",
    quotaName: "人工挖土方",
    unit: "m3",
    quantity: 100,
    laborFee: 120,
    materialFee: 50,
    machineFee: 30,
    contentFactor: 1,
    sourceMode: "manual",
  },
];

const priceVersions: PriceVersionRecord[] = [
  {
    id: "price-version-001",
    versionCode: "JS-2024-BUILDING",
    versionName: "江苏 2024 建筑价目",
    regionCode: "JS",
    disciplineCode: "building",
    status: "active",
  },
  {
    id: "price-version-002",
    versionCode: "JS-2024-INSTALLATION",
    versionName: "江苏 2024 安装价目",
    regionCode: "JS",
    disciplineCode: "installation",
    status: "active",
  },
];

function createQuotaApp() {
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
    quotaLineRepository: new InMemoryQuotaLineRepository(quotaLines),
    priceVersionRepository: new InMemoryPriceVersionRepository(priceVersions),
  });
}

test("GET /v1/projects/:id/bill-versions/:versionId/items/:itemId/quota-lines returns quota lines", async () => {
  const app = createQuotaApp();
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
    url: "/v1/projects/project-001/bill-versions/bill-version-001/items/bill-item-001/quota-lines",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { items: quotaLines });

  await app.close();
});

test("POST /v1/projects/:id/bill-versions/:versionId/items/:itemId/quota-lines creates a quota line", async () => {
  const app = createQuotaApp();
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
    url: "/v1/projects/project-001/bill-versions/bill-version-001/items/bill-item-001/quota-lines",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      sourceStandardSetCode: "js-2013-building",
      sourceQuotaId: "quota-source-002",
      sourceSequence: 2,
      chapterCode: "02",
      quotaCode: "010101002",
      quotaName: "机械挖土方",
      unit: "m3",
      quantity: 80,
      laborFee: 90,
      materialFee: 20,
      machineFee: 60,
      contentFactor: 1.2,
      sourceMode: "manual",
    },
  });

  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.json(), {
    id: "quota-line-002",
    billItemId: "bill-item-001",
    sourceStandardSetCode: "js-2013-building",
    sourceQuotaId: "quota-source-002",
    sourceSequence: 2,
    chapterCode: "02",
    quotaCode: "010101002",
    quotaName: "机械挖土方",
    unit: "m3",
    quantity: 80,
    laborFee: 90,
    materialFee: 20,
    machineFee: 60,
    contentFactor: 1.2,
    sourceMode: "manual",
  });

  await app.close();
});

test("POST /v1/projects/:id/bill-versions/:versionId/items/:itemId/quota-lines rejects cross-version bill items", async () => {
  const app = createQuotaApp();
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
    url: "/v1/projects/project-001/bill-versions/bill-version-001/items/bill-item-002/quota-lines",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      sourceStandardSetCode: "js-2013-building",
      sourceQuotaId: "quota-source-002",
      sourceSequence: 2,
      chapterCode: "02",
      quotaCode: "010101002",
      quotaName: "机械挖土方",
      unit: "m3",
      quantity: 80,
      laborFee: 90,
      materialFee: 20,
      machineFee: 60,
      contentFactor: 1.2,
      sourceMode: "manual",
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

test("POST /v1/projects/:id/bill-versions/:versionId/items/:itemId/quota-lines rejects duplicate source quota", async () => {
  const app = createQuotaApp();
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
    url: "/v1/projects/project-001/bill-versions/bill-version-001/items/bill-item-001/quota-lines",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      sourceStandardSetCode: "js-2013-building",
      sourceQuotaId: "quota-source-001",
      sourceSequence: 2,
      chapterCode: "02",
      quotaCode: "010101002",
      quotaName: "机械挖土方",
      unit: "m3",
      quantity: 80,
      laborFee: 90,
      materialFee: 20,
      machineFee: 60,
      contentFactor: 1.2,
      sourceMode: "manual",
    },
  });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "Duplicate quota source is not allowed for the same bill item",
    },
  });

  await app.close();
});

test("PUT /v1/projects/:id/quota-lines/:lineId updates a quota line", async () => {
  const app = createQuotaApp();
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
    url: "/v1/projects/project-001/quota-lines/quota-line-001",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      sourceStandardSetCode: "js-2013-building",
      sourceQuotaId: "quota-source-001",
      sourceSequence: 1,
      chapterCode: "01",
      quotaCode: "010101001",
      quotaName: "人工挖土方-更新",
      unit: "m3",
      quantity: 120,
      laborFee: 140,
      materialFee: 60,
      machineFee: 40,
      contentFactor: 1.1,
      sourceMode: "manual",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    id: "quota-line-001",
    billItemId: "bill-item-001",
    sourceStandardSetCode: "js-2013-building",
    sourceQuotaId: "quota-source-001",
    sourceSequence: 1,
    chapterCode: "01",
    quotaCode: "010101001",
    quotaName: "人工挖土方-更新",
    unit: "m3",
    quantity: 120,
    laborFee: 140,
    materialFee: 60,
    machineFee: 40,
    contentFactor: 1.1,
    sourceMode: "manual",
  });

  await app.close();
});

test("PUT /v1/projects/:id/quota-lines/:lineId rejects duplicate source quota", async () => {
  const app = createQuotaApp();
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
    url: "/v1/projects/project-001/bill-versions/bill-version-001/items/bill-item-001/quota-lines",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      sourceStandardSetCode: "js-2013-building",
      sourceQuotaId: "quota-source-002",
      sourceSequence: 2,
      chapterCode: "02",
      quotaCode: "010101002",
      quotaName: "机械挖土方",
      unit: "m3",
      quantity: 80,
      laborFee: 90,
      materialFee: 20,
      machineFee: 60,
      contentFactor: 1.2,
      sourceMode: "manual",
    },
  });

  assert.equal(createResponse.statusCode, 201);

  const response = await app.inject({
    method: "PUT",
    url: `/v1/projects/project-001/quota-lines/${createResponse.json().id}`,
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      sourceStandardSetCode: "js-2013-building",
      sourceQuotaId: "quota-source-001",
      sourceSequence: 2,
      chapterCode: "02",
      quotaCode: "010101002",
      quotaName: "机械挖土方",
      unit: "m3",
      quantity: 80,
      laborFee: 90,
      materialFee: 20,
      machineFee: 60,
      contentFactor: 1.2,
      sourceMode: "manual",
    },
  });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "Duplicate quota source is not allowed for the same bill item",
    },
  });

  await app.close();
});

test("DELETE /v1/projects/:id/quota-lines/:lineId deletes a quota line", async () => {
  const app = createQuotaApp();
  const token = await signAccessToken(
    {
      sub: "engineer-001",
      roleCodes: ["cost_engineer"],
      displayName: "Cost Engineer",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "DELETE",
    url: "/v1/projects/project-001/quota-lines/quota-line-001",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 204);

  const listResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/bill-versions/bill-version-001/items/bill-item-001/quota-lines",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.json().items.length, 0);

  const auditResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/audit-logs?resourceType=quota_line&resourceId=quota-line-001&action=delete",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(auditResponse.statusCode, 200);
  assert.equal(auditResponse.json().items.length, 1);

  await app.close();
});

test("GET /v1/price-versions filters by region and discipline", async () => {
  const app = createQuotaApp();
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
    url: "/v1/price-versions?regionCode=JS&disciplineCode=building",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    items: [priceVersions[0]],
  });

  await app.close();
});
