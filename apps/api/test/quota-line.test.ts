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
  InMemoryReferenceQuotaRepository,
  type ReferenceQuotaRecord,
} from "../src/modules/quota/reference-quota-repository.js";
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
  {
    id: "bill-item-003",
    billVersionId: "bill-version-001",
    parentId: null,
    itemCode: "A.2",
    itemName: "混凝土工程",
    quantity: 20,
    unit: "m3",
    sortNo: 2,
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
  {
    id: "quota-line-002",
    billItemId: "bill-item-002",
    sourceStandardSetCode: "js-2013-installation",
    sourceQuotaId: "quota-source-101",
    sourceSequence: 1,
    chapterCode: "03",
    quotaCode: "030101001",
    quotaName: "安装定额",
    unit: "项",
    quantity: 10,
    laborFee: 30,
    materialFee: 40,
    machineFee: 50,
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

function createQuotaApp(overrides?: {
  billItems?: typeof billItems;
  quotaLines?: QuotaLineRecord[];
  referenceQuotas?: ReferenceQuotaRecord[];
}) {
  return createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(projects),
    projectStageRepository: new InMemoryProjectStageRepository(stages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      disciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(members),
    billVersionRepository: new InMemoryBillVersionRepository(billVersions),
    billItemRepository: new InMemoryBillItemRepository(
      overrides?.billItems ?? billItems,
    ),
    quotaLineRepository: new InMemoryQuotaLineRepository(
      overrides?.quotaLines ?? quotaLines,
    ),
    referenceQuotaRepository: new InMemoryReferenceQuotaRepository(
      overrides?.referenceQuotas ?? [],
    ),
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
  assert.deepEqual(response.json(), { items: [quotaLines[0]] });

  await app.close();
});

test("GET /v1/projects/:id/quota-lines returns quota lines within member scope", async () => {
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
    url: "/v1/projects/project-001/quota-lines",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    items: [
      {
        ...quotaLines[0],
        billVersionId: "bill-version-001",
        stageCode: "estimate",
        disciplineCode: "building",
        billItemCode: "A.1",
        billItemName: "土石方工程",
      },
    ],
  });

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
    id: "quota-line-003",
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

  const auditResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/audit-logs?resourceType=quota_line&resourceId=quota-line-003&action=create",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(auditResponse.statusCode, 200);
  assert.equal(auditResponse.json().items.length, 1);
  assert.equal(auditResponse.json().items[0].afterPayload.quotaCode, "010101002");
  assert.equal(auditResponse.json().items[0].afterPayload.quantity, 80);

  await app.close();
});

test("POST /v1/projects/:id/quota-lines/batch-create creates multiple quota lines", async () => {
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
    url: "/v1/projects/project-001/quota-lines/batch-create",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      items: [
        {
          billVersionId: "bill-version-001",
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
        },
        {
          billVersionId: "bill-version-002",
          billItemId: "bill-item-002",
          sourceStandardSetCode: "js-2013-installation",
          sourceQuotaId: "quota-source-102",
          sourceSequence: 2,
          chapterCode: "03",
          quotaCode: "030101002",
          quotaName: "安装新增定额",
          unit: "项",
          quantity: 5,
          laborFee: 10,
          materialFee: 20,
          machineFee: 30,
          contentFactor: 1,
          sourceMode: "manual",
        },
      ],
    },
  });

  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.json(), {
    items: [
      {
        id: "quota-line-003",
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
      },
      {
        id: "quota-line-004",
        billItemId: "bill-item-002",
        sourceStandardSetCode: "js-2013-installation",
        sourceQuotaId: "quota-source-102",
        sourceSequence: 2,
        chapterCode: "03",
        quotaCode: "030101002",
        quotaName: "安装新增定额",
        unit: "项",
        quantity: 5,
        laborFee: 10,
        materialFee: 20,
        machineFee: 30,
        contentFactor: 1,
        sourceMode: "manual",
      },
    ],
  });

  await app.close();
});

test("POST /v1/projects/:id/quota-lines/validate reports visible bill items without quota lines", async () => {
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
    url: "/v1/projects/project-001/quota-lines/validate",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    passed: false,
    issueCount: 1,
    issues: [
      {
        code: "MISSING_QUOTA_LINES",
        severity: "warning",
        message: "Bill item has no quota lines",
        billVersionId: "bill-version-001",
        billItemId: "bill-item-003",
        billItemCode: "A.2",
        billItemName: "混凝土工程",
      },
    ],
  });

  await app.close();
});

test("POST /v1/projects/:id/quota-lines/validate reports bill item and quota amount mismatch", async () => {
  const app = createQuotaApp({
    billItems: [
      {
        ...billItems[0],
        systemAmount: 17001,
      },
      billItems[1],
    ],
  });
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
    url: "/v1/projects/project-001/quota-lines/validate",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    passed: false,
    issueCount: 1,
    issues: [
      {
        code: "AMOUNT_MISMATCH",
        severity: "warning",
        message: "Bill item system amount does not match quota line amount total",
        billVersionId: "bill-version-001",
        billItemId: "bill-item-001",
        billItemCode: "A.1",
        billItemName: "土石方工程",
        billItemSystemAmount: 17001,
        quotaLineAmountTotal: 20000,
        varianceAmount: -2999,
      },
    ],
  });

  await app.close();
});

test("POST /v1/projects/:id/quota-lines/validate reports quota unit mismatch", async () => {
  const app = createQuotaApp();
  const token = await signAccessToken(
    {
      sub: "engineer-001",
      roleCodes: ["cost_engineer"],
      displayName: "Cost Engineer",
    },
    jwtSecret,
  );

  const updateResponse = await app.inject({
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
      quotaName: "人工挖土方",
      unit: "m2",
      quantity: 100,
      laborFee: 120,
      materialFee: 50,
      machineFee: 30,
      contentFactor: 1,
      sourceMode: "manual",
    },
  });

  assert.equal(updateResponse.statusCode, 200);

  const response = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/quota-lines/validate",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    passed: false,
    issueCount: 2,
    issues: [
      {
        code: "UNIT_MISMATCH",
        severity: "warning",
        message: "Quota line unit does not match bill item unit",
        billVersionId: "bill-version-001",
        billItemId: "bill-item-001",
        billItemCode: "A.1",
        billItemName: "土石方工程",
        quotaLineId: "quota-line-001",
        quotaCode: "010101001",
        billItemUnit: "m3",
        quotaUnit: "m2",
      },
      {
        code: "MISSING_QUOTA_LINES",
        severity: "warning",
        message: "Bill item has no quota lines",
        billVersionId: "bill-version-001",
        billItemId: "bill-item-003",
        billItemCode: "A.2",
        billItemName: "混凝土工程",
      },
    ],
  });

  await app.close();
});

test("GET /v1/projects/:id/quota-lines/source-chain returns visible quota source context", async () => {
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
    url: "/v1/projects/project-001/quota-lines/source-chain",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    items: [
      {
        quotaLineId: "quota-line-001",
        billVersionId: "bill-version-001",
        billVersionName: "估算版 V1",
        stageCode: "estimate",
        disciplineCode: "building",
        billItemId: "bill-item-001",
        billItemCode: "A.1",
        billItemName: "土石方工程",
        sourceMode: "manual",
        sourceStandardSetCode: "js-2013-building",
        sourceQuotaId: "quota-source-001",
        sourceSequence: 1,
        quotaCode: "010101001",
        quotaName: "人工挖土方",
      },
    ],
  });

  await app.close();
});

test("GET /v1/projects/:id/quota-lines/candidates uses discipline default standard set and filters candidates", async () => {
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
    url: "/v1/projects/project-001/quota-lines/candidates?disciplineCode=building&keyword=挖土&chapterCode=01",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    items: [
      {
        sourceStandardSetCode: "js-2013-building",
        sourceQuotaId: "quota-source-001",
        sourceSequence: 1,
        chapterCode: "01",
        quotaCode: "010101001",
        quotaName: "人工挖土方",
        unit: "m3",
        laborFee: 120,
        materialFee: 50,
        machineFee: 30,
        sourceMode: "manual",
        sourceDataset: "js-2013-building",
        sourceRegion: null,
        workContentSummary: null,
        resourceCompositionSummary: "人工费 120 / 材料费 50 / 机械费 30",
        matchReason: "关键字命中定额名称",
        matchScore: 0.9,
      },
    ],
  });

  await app.close();
});

test("GET /v1/projects/:id/quota-lines/candidates includes read-only reference quota knowledge", async () => {
  const app = createQuotaApp({
    quotaLines: [],
    referenceQuotas: [
      {
        id: "reference-quota-001",
        sourceDataset: "ZH_SHANGHAI.csv",
        sourceRegion: "上海",
        standardSetCode: "js-2013-building",
        disciplineCode: "building",
        sourceQuotaId: "ddc-sh-010101099",
        sourceSequence: 99,
        chapterCode: "01",
        quotaCode: "010101099",
        quotaName: "参考库人工挖土方",
        unit: "m3",
        laborFee: 88,
        materialFee: 12,
        machineFee: 36,
        workContentSummary: "挖土、装土、修边",
        resourceCompositionSummary: "人工费 88 / 材料费 12 / 机械费 36",
        searchText: "参考库人工挖土方 挖土 装土 修边",
        metadata: {
          categoryType: "建筑工程",
          rowType: "quota",
        },
      },
    ],
  });
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
    url: "/v1/projects/project-001/quota-lines/candidates?disciplineCode=building&keyword=修边&chapterCode=01",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    items: [
      {
        sourceStandardSetCode: "js-2013-building",
        sourceQuotaId: "ddc-sh-010101099",
        sourceSequence: 99,
        chapterCode: "01",
        quotaCode: "010101099",
        quotaName: "参考库人工挖土方",
        unit: "m3",
        laborFee: 88,
        materialFee: 12,
        machineFee: 36,
        sourceMode: "reference_knowledge",
        sourceDataset: "ZH_SHANGHAI.csv",
        sourceRegion: "上海",
        workContentSummary: "挖土、装土、修边",
        resourceCompositionSummary: "人工费 88 / 材料费 12 / 机械费 36",
        matchReason: "参考库关键字命中工作内容",
        matchScore: 0.82,
      },
    ],
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

test("POST /v1/projects/:id/bill-versions/:versionId/items/:itemId/quota-lines rejects unsupported source mode", async () => {
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
      sourceMode: "spreadsheet",
    },
  });

  assert.equal(response.statusCode, 422);
  assert.equal(response.json().error.code, "VALIDATION_ERROR");
  assert.deepEqual(
    response.json().error.details.map((detail: { field: string }) => detail.field),
    ["sourceMode"],
  );

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

  const auditResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/audit-logs?resourceType=quota_line&resourceId=quota-line-001&action=update",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(auditResponse.statusCode, 200);
  assert.equal(auditResponse.json().items.length, 1);
  assert.equal(auditResponse.json().items[0].beforePayload.quotaName, "人工挖土方");
  assert.equal(auditResponse.json().items[0].beforePayload.quantity, 100);
  assert.equal(auditResponse.json().items[0].afterPayload.quotaName, "人工挖土方-更新");
  assert.equal(auditResponse.json().items[0].afterPayload.quantity, 120);

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
