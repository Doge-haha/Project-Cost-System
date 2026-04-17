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
import {
  InMemoryPriceItemRepository,
  type PriceItemRecord,
} from "../src/modules/pricing/price-item-repository.js";
import {
  InMemoryFeeTemplateRepository,
  type FeeTemplateRecord,
} from "../src/modules/fee/fee-template-repository.js";
import {
  InMemoryFeeRuleRepository,
  type FeeRuleRecord,
} from "../src/modules/fee/fee-rule-repository.js";

const jwtSecret = "pricing-engine-test-secret";

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
];

const members: ProjectMemberRecord[] = [
  {
    id: "member-001",
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
    parentId: null,
    itemCode: "A.2",
    itemName: "空白清单项",
    quantity: 50,
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
    quantity: 40,
    laborFee: 20,
    materialFee: 10,
    machineFee: 5,
    contentFactor: 1,
    sourceMode: "manual",
  },
  {
    id: "quota-line-002",
    billItemId: "bill-item-001",
    sourceStandardSetCode: "js-2013-building",
    sourceQuotaId: "quota-source-002",
    sourceSequence: 2,
    chapterCode: "02",
    quotaCode: "010101002",
    quotaName: "机械挖土方",
    unit: "m3",
    quantity: 60,
    laborFee: 15,
    materialFee: 8,
    machineFee: 25,
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
];

const priceItems: PriceItemRecord[] = [
  {
    id: "price-item-001",
    priceVersionId: "price-version-001",
    quotaCode: "010101001",
    laborUnitPrice: 4,
    materialUnitPrice: 6,
    machineUnitPrice: 2,
    totalUnitPrice: 12,
  },
  {
    id: "price-item-002",
    priceVersionId: "price-version-001",
    quotaCode: "010101002",
    laborUnitPrice: 3,
    materialUnitPrice: 2,
    machineUnitPrice: 5,
    totalUnitPrice: 10,
  },
];

const feeTemplates: FeeTemplateRecord[] = [
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

const feeRules: FeeRuleRecord[] = [
  {
    id: "fee-rule-001",
    feeTemplateId: "fee-template-001",
    disciplineCode: "building",
    feeType: "management_fee",
    feeRate: 0.08,
  },
  {
    id: "fee-rule-002",
    feeTemplateId: "fee-template-001",
    disciplineCode: null,
    feeType: "tax",
    feeRate: 0.03,
  },
];

function createPricingApp(overrides?: {
  priceItems?: PriceItemRecord[];
  projectDefaults?: {
    defaultPriceVersionId?: string | null;
    defaultFeeTemplateId?: string | null;
  };
}) {
  return createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(
      projects.map((project) => ({
        ...project,
        defaultPriceVersionId:
          overrides?.projectDefaults?.defaultPriceVersionId ??
          project.defaultPriceVersionId,
        defaultFeeTemplateId:
          overrides?.projectDefaults?.defaultFeeTemplateId ??
          project.defaultFeeTemplateId,
      })),
    ),
    projectStageRepository: new InMemoryProjectStageRepository(stages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      disciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(members),
    billVersionRepository: new InMemoryBillVersionRepository(billVersions),
    billItemRepository: new InMemoryBillItemRepository(billItems),
    quotaLineRepository: new InMemoryQuotaLineRepository(quotaLines),
    priceVersionRepository: new InMemoryPriceVersionRepository(priceVersions),
    priceItemRepository: new InMemoryPriceItemRepository(
      overrides?.priceItems ?? priceItems,
    ),
    feeTemplateRepository: new InMemoryFeeTemplateRepository(feeTemplates),
    feeRuleRepository: new InMemoryFeeRuleRepository(feeRules),
  });
}

test("GET /v1/price-versions/:id/items returns price items and supports quotaCode filter", async () => {
  const app = createPricingApp();
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
    url: "/v1/price-versions/price-version-001/items?quotaCode=010101001",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    items: [priceItems[0]],
  });

  await app.close();
});

test("POST /v1/engine/calculate calculates system and final price from quota lines and price items", async () => {
  const app = createPricingApp();
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
    url: "/v1/engine/calculate",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      billItemId: "bill-item-001",
      priceVersionId: "price-version-001",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    billItemId: "bill-item-001",
    systemUnitPrice: 10.8,
    finalUnitPrice: 10.8,
    systemAmount: 1080,
    finalAmount: 1080,
    matchedPriceItemCount: 2,
    appliedFeeRate: 0,
    calculatedAt: response.json().calculatedAt,
  });

  await app.close();
});

test("POST /v1/engine/calculate applies fee template rules to final price", async () => {
  const app = createPricingApp();
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
    url: "/v1/engine/calculate",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      billItemId: "bill-item-001",
      priceVersionId: "price-version-001",
      feeTemplateId: "fee-template-001",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    billItemId: "bill-item-001",
    systemUnitPrice: 10.8,
    finalUnitPrice: 11.988,
    systemAmount: 1080,
    finalAmount: 1198.8,
    matchedPriceItemCount: 2,
    appliedFeeRate: 0.11,
    calculatedAt: response.json().calculatedAt,
  });

  await app.close();
});

test("POST /v1/engine/calculate uses project default pricing config and bill item list reflects the persisted calculation result", async () => {
  const app = createPricingApp({
    projectDefaults: {
      defaultPriceVersionId: "price-version-001",
      defaultFeeTemplateId: "fee-template-001",
    },
  });
  const token = await signAccessToken(
    {
      sub: "engineer-001",
      roleCodes: ["cost_engineer"],
      displayName: "Cost Engineer",
    },
    jwtSecret,
  );

  const calculateResponse = await app.inject({
    method: "POST",
    url: "/v1/engine/calculate",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      billItemId: "bill-item-001",
    },
  });

  assert.equal(calculateResponse.statusCode, 200);
  assert.equal(calculateResponse.json().appliedFeeRate, 0.11);

  const listResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/bill-versions/bill-version-001/items",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(listResponse.statusCode, 200);
  assert.deepEqual(listResponse.json(), {
    items: [
      {
        ...billItems[0],
        systemUnitPrice: 10.8,
        manualUnitPrice: null,
        finalUnitPrice: 11.988,
        systemAmount: 1080,
        finalAmount: 1198.8,
        calculatedAt: calculateResponse.json().calculatedAt,
      },
      billItems[1],
    ],
  });

  await app.close();
});

test("POST /v1/engine/calculate rejects when quota lines cannot be matched to price items", async () => {
  const app = createPricingApp({
    priceItems: [priceItems[0]],
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
    url: "/v1/engine/calculate",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      billItemId: "bill-item-001",
      priceVersionId: "price-version-001",
    },
  });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "Some quota lines could not be matched to the selected price version",
      details: [
        {
          quotaCode: "010101002",
          quotaLineId: "quota-line-002",
        },
      ],
    },
  });

  await app.close();
});

test("POST /v1/projects/:id/bill-versions/:versionId/recalculate recalculates eligible bill items and skips empty ones", async () => {
  const app = createPricingApp({
    projectDefaults: {
      defaultPriceVersionId: "price-version-001",
      defaultFeeTemplateId: "fee-template-001",
    },
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
    url: "/v1/projects/project-001/bill-versions/bill-version-001/recalculate",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {},
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().billVersionId, "bill-version-001");
  assert.equal(response.json().recalculatedCount, 1);
  assert.equal(response.json().skippedCount, 1);
  assert.equal(response.json().items[0].billItemId, "bill-item-001");

  const listResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/bill-versions/bill-version-001/items",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.json().items[0].finalAmount, 1198.8);
  assert.equal(listResponse.json().items[1].finalAmount ?? null, null);

  await app.close();
});

test("PUT /v1/projects/:id/bill-versions/:versionId/items/:itemId/manual-pricing overrides final values without replacing system values", async () => {
  const app = createPricingApp({
    projectDefaults: {
      defaultPriceVersionId: "price-version-001",
      defaultFeeTemplateId: "fee-template-001",
    },
  });
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
    url: "/v1/engine/calculate",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      billItemId: "bill-item-001",
    },
  });

  const response = await app.inject({
    method: "PUT",
    url: "/v1/projects/project-001/bill-versions/bill-version-001/items/bill-item-001/manual-pricing",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      manualUnitPrice: 12.5,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().systemUnitPrice, 10.8);
  assert.equal(response.json().manualUnitPrice, 12.5);
  assert.equal(response.json().finalUnitPrice, 12.5);
  assert.equal(response.json().systemAmount, 1080);
  assert.equal(response.json().finalAmount, 1250);

  await app.close();
});

test("GET /v1/reports/summary aggregates project totals using system and final amounts", async () => {
  const app = createPricingApp({
    projectDefaults: {
      defaultPriceVersionId: "price-version-001",
      defaultFeeTemplateId: "fee-template-001",
    },
  });
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
    url: "/v1/engine/calculate",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      billItemId: "bill-item-001",
    },
  });

  await app.inject({
    method: "PUT",
    url: "/v1/projects/project-001/bill-versions/bill-version-001/items/bill-item-001/manual-pricing",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      manualUnitPrice: 12.5,
    },
  });

  const response = await app.inject({
    method: "GET",
    url: "/v1/reports/summary?projectId=project-001&stageCode=estimate&disciplineCode=building",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    projectId: "project-001",
    stageCode: "estimate",
    disciplineCode: "building",
    itemCount: 2,
    totalSystemAmount: 1080,
    totalFinalAmount: 1250,
    varianceAmount: 170,
    varianceRate: 0.157407,
  });

  await app.close();
});

test("POST /v1/projects/:id/recalculate recalculates all authorized versions in scope", async () => {
  const app = createPricingApp({
    projectDefaults: {
      defaultPriceVersionId: "price-version-001",
      defaultFeeTemplateId: "fee-template-001",
    },
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
    url: "/v1/projects/project-001/recalculate",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      stageCode: "estimate",
      disciplineCode: "building",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().projectId, "project-001");
  assert.equal(response.json().versionCount, 1);
  assert.equal(response.json().recalculatedCount, 1);
  assert.equal(response.json().skippedCount, 1);
  assert.equal(response.json().versions[0].billVersionId, "bill-version-001");

  await app.close();
});

test("GET /v1/reports/summary/details returns variance detail items sorted by absolute variance", async () => {
  const app = createPricingApp({
    projectDefaults: {
      defaultPriceVersionId: "price-version-001",
      defaultFeeTemplateId: "fee-template-001",
    },
  });
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
    url: "/v1/engine/calculate",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      billItemId: "bill-item-001",
    },
  });

  await app.inject({
    method: "PUT",
    url: "/v1/projects/project-001/bill-versions/bill-version-001/items/bill-item-001/manual-pricing",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      manualUnitPrice: 12.5,
    },
  });

  const response = await app.inject({
    method: "GET",
    url: "/v1/reports/summary/details?projectId=project-001&stageCode=estimate&disciplineCode=building&limit=1",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().projectId, "project-001");
  assert.equal(response.json().totalCount, 2);
  assert.equal(response.json().items.length, 1);
  assert.deepEqual(response.json().items[0], {
    billVersionId: "bill-version-001",
    versionName: "估算版 V1",
    versionNo: 1,
    stageCode: "estimate",
    disciplineCode: "building",
    itemId: "bill-item-001",
    itemCode: "A.1",
    itemName: "土石方工程",
    systemAmount: 1080,
    finalAmount: 1250,
    varianceAmount: 170,
    varianceRate: 0.157407,
  });

  await app.close();
});

test("POST /v1/reports/export creates a completed summary export task and GET /v1/reports/export/:taskId returns it", async () => {
  const app = createPricingApp({
    projectDefaults: {
      defaultPriceVersionId: "price-version-001",
      defaultFeeTemplateId: "fee-template-001",
    },
  });
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
    url: "/v1/engine/calculate",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      billItemId: "bill-item-001",
    },
  });

  const createResponse = await app.inject({
    method: "POST",
    url: "/v1/reports/export",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      projectId: "project-001",
      reportType: "summary",
      stageCode: "estimate",
      disciplineCode: "building",
    },
  });

  assert.equal(createResponse.statusCode, 202);
  assert.equal(createResponse.json().status, "completed");
  assert.equal(createResponse.json().reportType, "summary");

  const taskId = createResponse.json().id as string;
  const queryResponse = await app.inject({
    method: "GET",
    url: `/v1/reports/export/${taskId}`,
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(queryResponse.statusCode, 200);
  assert.equal(queryResponse.json().id, taskId);
  assert.equal(queryResponse.json().resultPreview.projectId, "project-001");
  assert.equal(queryResponse.json().resultPreview.totalSystemAmount, 1080);

  const downloadResponse = await app.inject({
    method: "GET",
    url: `/v1/reports/export/${taskId}/download`,
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(downloadResponse.statusCode, 200);
  assert.match(
    downloadResponse.headers["content-disposition"] ?? "",
    /attachment; filename="summary-/,
  );
  assert.match(downloadResponse.body, /"projectId": "project-001"/);

  const auditResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/audit-logs?resourceType=report_export_task&action=export",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(auditResponse.statusCode, 200);
  assert.equal(auditResponse.json().items.length, 1);
  assert.equal(auditResponse.json().items[0].resourceId, taskId);

  await app.close();
});
