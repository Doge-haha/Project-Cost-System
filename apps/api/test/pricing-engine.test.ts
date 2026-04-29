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
import {
  InMemoryBackgroundJobRepository,
  type BackgroundJobRecord,
} from "../src/modules/jobs/background-job-repository.js";
import type { BackgroundJobSink } from "../src/modules/jobs/background-job-sink.js";

class RecordingBackgroundJobSink {
  readonly jobs: BackgroundJobRecord[] = [];

  async enqueue(job: BackgroundJobRecord): Promise<void> {
    this.jobs.push(structuredClone(job));
  }
}

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
  {
    id: "bill-version-002",
    projectId: "project-001",
    stageCode: "estimate",
    disciplineCode: "building",
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
  {
    id: "bill-item-003",
    billVersionId: "bill-version-002",
    parentId: null,
    itemCode: "A.1",
    itemName: "土石方工程",
    quantity: 100,
    unit: "m3",
    sortNo: 1,
    systemAmount: 1200,
    finalAmount: 1320,
  },
  {
    id: "bill-item-004",
    billVersionId: "bill-version-002",
    parentId: null,
    itemCode: "A.3",
    itemName: "新增清单项",
    quantity: 20,
    unit: "m2",
    sortNo: 2,
    systemAmount: 240,
    finalAmount: 300,
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
  disciplines?: ProjectDisciplineRecord[];
  members?: ProjectMemberRecord[];
  billVersions?: BillVersionRecord[];
  billItems?: BillItemRecord[];
  quotaLines?: QuotaLineRecord[];
  priceItems?: PriceItemRecord[];
  priceVersions?: PriceVersionRecord[];
  feeTemplates?: FeeTemplateRecord[];
  projectDefaults?: {
    defaultPriceVersionId?: string | null;
    defaultFeeTemplateId?: string | null;
  };
  backgroundJobs?: BackgroundJobRecord[];
  backgroundJobSink?: BackgroundJobSink;
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
      overrides?.disciplines ?? disciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(
      overrides?.members ?? members,
    ),
    billVersionRepository: new InMemoryBillVersionRepository(
      overrides?.billVersions ?? billVersions,
    ),
    billItemRepository: new InMemoryBillItemRepository(
      overrides?.billItems ?? billItems,
    ),
    quotaLineRepository: new InMemoryQuotaLineRepository(
      overrides?.quotaLines ?? quotaLines,
    ),
    priceVersionRepository: new InMemoryPriceVersionRepository(
      overrides?.priceVersions ?? priceVersions,
    ),
    priceItemRepository: new InMemoryPriceItemRepository(
      overrides?.priceItems ?? priceItems,
    ),
    feeTemplateRepository: new InMemoryFeeTemplateRepository(
      overrides?.feeTemplates ?? feeTemplates,
    ),
    feeRuleRepository: new InMemoryFeeRuleRepository(feeRules),
    backgroundJobRepository: new InMemoryBackgroundJobRepository(
      overrides?.backgroundJobs ?? [],
    ),
    backgroundJobSink: overrides?.backgroundJobSink,
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

test("POST /v1/engine/calculate rejects inactive price versions", async () => {
  const app = createPricingApp({
    priceVersions: [
      {
        ...priceVersions[0],
        id: "price-version-002",
        status: "inactive",
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
    method: "POST",
    url: "/v1/engine/calculate",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      billItemId: "bill-item-001",
      priceVersionId: "price-version-002",
    },
  });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "Price version must be active before calculation",
    },
  });

  await app.close();
});

test("POST /v1/engine/calculate rejects incomplete input with validation details", async () => {
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
      priceVersionId: "",
    },
  });

  assert.equal(response.statusCode, 422);
  assert.equal(response.json().error.code, "VALIDATION_ERROR");
  assert.equal(response.json().error.message, "Request validation failed");
  assert.deepEqual(
    response.json().error.details.map((detail: { field: string }) => detail.field),
    ["billItemId", "priceVersionId"],
  );

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

test("POST /v1/engine/calculate prefers discipline-specific fee rules over generic rules of the same fee type", async () => {
  const app = createApp({
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
    priceItemRepository: new InMemoryPriceItemRepository(priceItems),
    feeTemplateRepository: new InMemoryFeeTemplateRepository(feeTemplates),
    feeRuleRepository: new InMemoryFeeRuleRepository([
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
        feeType: "management_fee",
        feeRate: 0.05,
      },
      {
        id: "fee-rule-003",
        feeTemplateId: "fee-template-001",
        disciplineCode: null,
        feeType: "tax",
        feeRate: 0.03,
      },
    ]),
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
      feeTemplateId: "fee-template-001",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().appliedFeeRate, 0.11);
  assert.equal(response.json().finalAmount, 1198.8);

  await app.close();
});

test("POST /v1/engine/calculate applies by_discipline and none allocation modes", async () => {
  const byDisciplineApp = createPricingApp({
    feeTemplates: [
      {
        ...feeTemplates[0],
        allocationMode: "by_discipline",
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

  const byDisciplineResponse = await byDisciplineApp.inject({
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

  assert.equal(byDisciplineResponse.statusCode, 200);
  assert.equal(byDisciplineResponse.json().appliedFeeRate, 0.08);
  assert.equal(byDisciplineResponse.json().finalAmount, 1166.4);

  await byDisciplineApp.close();

  const noAllocationApp = createPricingApp({
    feeTemplates: [
      {
        ...feeTemplates[0],
        allocationMode: "none",
      },
    ],
  });

  const noAllocationResponse = await noAllocationApp.inject({
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

  assert.equal(noAllocationResponse.statusCode, 200);
  assert.equal(noAllocationResponse.json().appliedFeeRate, 0);
  assert.equal(noAllocationResponse.json().finalAmount, 1080);

  await noAllocationApp.close();
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
  assert.deepEqual(response.json().skippedSummary, [
    {
      reason: "missing_quota_lines",
      label: "缺少定额明细",
      count: 1,
    },
  ]);
  assert.equal(response.json().totalSystemAmount, 1080);
  assert.equal(response.json().totalFinalAmount, 1198.8);
  assert.deepEqual(response.json().skippedItems, [
    {
      billItemId: "bill-item-002",
      reason: "missing_quota_lines",
      label: "缺少定额明细",
      details: {
        quotaLineCount: 0,
      },
    },
  ]);
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

test("POST /v1/projects/:id/bill-versions/:versionId/recalculate skips bill items with invalid quantity", async () => {
  const app = createPricingApp({
    billItems: [
      ...billItems,
      {
        id: "bill-item-005",
        billVersionId: "bill-version-001",
        parentId: null,
        itemCode: "A.4",
        itemName: "异常工程量清单项",
        quantity: 0,
        unit: "m2",
        sortNo: 3,
      },
    ],
    quotaLines: [
      ...quotaLines,
      {
        id: "quota-line-003",
        billItemId: "bill-item-005",
        sourceStandardSetCode: "js-2013-building",
        sourceQuotaId: "quota-source-003",
        sourceSequence: 3,
        chapterCode: "03",
        quotaCode: "010101001",
        quotaName: "人工挖土方",
        unit: "m2",
        quantity: 10,
        laborFee: 20,
        materialFee: 10,
        machineFee: 5,
        contentFactor: 1,
        sourceMode: "manual",
      },
    ],
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
  assert.equal(response.json().recalculatedCount, 1);
  assert.equal(response.json().skippedCount, 2);
  assert.deepEqual(response.json().skippedSummary, [
    {
      reason: "missing_quota_lines",
      label: "缺少定额明细",
      count: 1,
    },
    {
      reason: "invalid_quantity",
      label: "工程量不合法",
      count: 1,
    },
  ]);
  assert.equal(response.json().totalSystemAmount, 1080);
  assert.equal(response.json().totalFinalAmount, 1198.8);
  assert.deepEqual(response.json().skippedItems, [
    {
      billItemId: "bill-item-002",
      reason: "missing_quota_lines",
      label: "缺少定额明细",
      details: {
        quotaLineCount: 0,
      },
    },
    {
      billItemId: "bill-item-005",
      reason: "invalid_quantity",
      label: "工程量不合法",
      details: {
        quantity: 0,
      },
    },
  ]);

  await app.close();
});

test("POST /v1/projects/:id/bill-versions/:versionId/recalculate skips bill items with unmatched price items", async () => {
  const app = createPricingApp({
    priceItems: [priceItems[0]],
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
  assert.equal(response.json().recalculatedCount, 0);
  assert.equal(response.json().skippedCount, 2);
  assert.deepEqual(response.json().skippedSummary, [
    {
      reason: "unmatched_price_items",
      label: "价目匹配失败",
      count: 1,
    },
    {
      reason: "missing_quota_lines",
      label: "缺少定额明细",
      count: 1,
    },
  ]);
  assert.equal(response.json().totalSystemAmount, 0);
  assert.equal(response.json().totalFinalAmount, 0);
  assert.deepEqual(response.json().skippedItems, [
    {
      billItemId: "bill-item-001",
      reason: "unmatched_price_items",
      label: "价目匹配失败",
      details: {
        unmatchedQuotaCodes: ["010101002"],
      },
    },
    {
      billItemId: "bill-item-002",
      reason: "missing_quota_lines",
      label: "缺少定额明细",
      details: {
        quotaLineCount: 0,
      },
    },
  ]);

  await app.close();
});

test("POST /v1/projects/:id/bill-versions/:versionId/recalculate rejects when price version discipline does not match the bill version", async () => {
  const app = createPricingApp({
    priceVersions: [
      ...priceVersions,
      {
        id: "price-version-002",
        versionCode: "JS-2024-PLUMBING",
        versionName: "江苏 2024 安装价目",
        regionCode: "JS",
        disciplineCode: "plumbing",
        status: "active",
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
    method: "POST",
    url: "/v1/projects/project-001/bill-versions/bill-version-001/recalculate",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      priceVersionId: "price-version-002",
    },
  });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "Price version discipline does not match the requested recalculation scope",
    },
  });

  await app.close();
});

test("POST /v1/projects/:id/bill-versions/:versionId/recalculate rejects inactive price versions", async () => {
  const app = createPricingApp({
    priceVersions: [
      ...priceVersions,
      {
        id: "price-version-002",
        versionCode: "JS-2024-BUILDING-INACTIVE",
        versionName: "江苏 2024 建筑价目（停用）",
        regionCode: "JS",
        disciplineCode: "building",
        status: "inactive",
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
    method: "POST",
    url: "/v1/projects/project-001/bill-versions/bill-version-001/recalculate",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      priceVersionId: "price-version-002",
    },
  });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "Price version must be active before calculation",
    },
  });

  await app.close();
});

test("POST /v1/projects/:id/bill-versions/:versionId/recalculate rejects when fee template stage scope does not match the bill version", async () => {
  const app = createPricingApp({
    feeTemplates: [
      ...feeTemplates,
      {
        id: "fee-template-002",
        templateName: "江苏建筑预算取费",
        projectType: "building",
        regionCode: "JS",
        stageScope: ["budget"],
        taxMode: "general",
        allocationMode: "proportional",
        status: "active",
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
    method: "POST",
    url: "/v1/projects/project-001/bill-versions/bill-version-001/recalculate",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      feeTemplateId: "fee-template-002",
    },
  });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "Fee template does not apply to the requested recalculation scope",
    },
  });

  await app.close();
});

test("POST /v1/projects/:id/bill-versions/:versionId/recalculate rejects inactive fee templates", async () => {
  const app = createPricingApp({
    feeTemplates: [
      ...feeTemplates,
      {
        id: "fee-template-003",
        templateName: "江苏建筑取费（停用）",
        projectType: "building",
        regionCode: "JS",
        stageScope: ["estimate"],
        taxMode: "general",
        allocationMode: "proportional",
        status: "inactive",
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
    method: "POST",
    url: "/v1/projects/project-001/bill-versions/bill-version-001/recalculate",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      feeTemplateId: "fee-template-003",
    },
  });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "Fee template must be active before calculation",
    },
  });

  await app.close();
});

test("POST /v1/projects/:id/bill-versions/:versionId/recalculate rejects inactive default price versions", async () => {
  const app = createPricingApp({
    priceVersions: [
      {
        ...priceVersions[0],
        status: "inactive",
      },
    ],
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

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "Price version must be active before calculation",
    },
  });

  await app.close();
});

test("POST /v1/projects/:id/bill-versions/:versionId/recalculate rejects inactive default fee templates", async () => {
  const app = createPricingApp({
    feeTemplates: [
      {
        ...feeTemplates[0],
        status: "inactive",
      },
    ],
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

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "Fee template must be active before calculation",
    },
  });

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
      reason: "市场询价调整",
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

test("PUT /v1/projects/:id/bill-versions/:versionId/items/:itemId/manual-pricing requires a reason", async () => {
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

  assert.equal(response.statusCode, 422);
  assert.equal(response.json().error.code, "VALIDATION_ERROR");

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
      reason: "市场询价调整",
    },
  });

  const response = await app.inject({
    method: "GET",
    url: "/v1/reports/summary?projectId=project-001&billVersionId=bill-version-001&stageCode=estimate&disciplineCode=building",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    projectId: "project-001",
    billVersionId: "bill-version-001",
    stageCode: "estimate",
    disciplineCode: "building",
    unitCode: null,
    versionCount: 1,
    itemCount: 2,
    totalSystemAmount: 1080,
    totalFinalAmount: 1250,
    varianceAmount: 170,
    varianceRate: 0.157407,
  });

  await app.close();
});

test("GET /v1/reports/summary and /details support tax excluded mode", async () => {
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

  const summaryResponse = await app.inject({
    method: "GET",
    url: "/v1/reports/summary?projectId=project-001&billVersionId=bill-version-001&taxMode=tax_excluded",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(summaryResponse.statusCode, 200);
  assert.equal(summaryResponse.json().taxMode, "tax_excluded");
  assert.equal(summaryResponse.json().totalSystemAmount, 1080);
  assert.equal(summaryResponse.json().totalFinalAmount, 1166.4);
  assert.equal(summaryResponse.json().totalTaxAmount, 32.4);
  assert.equal(summaryResponse.json().varianceAmount, 86.4);
  assert.equal(summaryResponse.json().varianceRate, 0.08);

  const detailsResponse = await app.inject({
    method: "GET",
    url: "/v1/reports/summary/details?projectId=project-001&billVersionId=bill-version-001&taxMode=tax_excluded&limit=1",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(detailsResponse.statusCode, 200);
  assert.equal(detailsResponse.json().taxMode, "tax_excluded");
  assert.equal(detailsResponse.json().items[0].systemAmount, 1080);
  assert.equal(detailsResponse.json().items[0].finalAmount, 1166.4);
  assert.equal(detailsResponse.json().items[0].taxAmount, 32.4);
  assert.equal(detailsResponse.json().items[0].varianceAmount, 86.4);
  assert.equal(detailsResponse.json().items[0].varianceRate, 0.08);

  await app.close();
});

test("POST /v1/projects/:id/recalculate recalculates all authorized versions in scope", async () => {
  const backgroundJobSink = new RecordingBackgroundJobSink();
  const app = createPricingApp({
    projectDefaults: {
      defaultPriceVersionId: "price-version-001",
      defaultFeeTemplateId: "fee-template-001",
    },
    backgroundJobSink,
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

  assert.equal(response.statusCode, 202);
  assert.equal(response.json().jobType, "project_recalculate");
  assert.equal(response.json().status, "queued");
  assert.equal(response.json().projectId, "project-001");
  assert.equal(backgroundJobSink.jobs.length, 1);
  assert.equal(backgroundJobSink.jobs[0]?.id, response.json().id);
  assert.equal(backgroundJobSink.jobs[0]?.jobType, "project_recalculate");
  assert.equal(backgroundJobSink.jobs[0]?.status, "queued");
  assert.equal(backgroundJobSink.jobs[0]?.requestedBy, "engineer-001");
  assert.equal(backgroundJobSink.jobs[0]?.projectId, "project-001");
  assert.equal(
    backgroundJobSink.jobs[0]?.payload.projectId,
    "project-001",
  );
  assert.equal(backgroundJobSink.jobs[0]?.payload.stageCode, "estimate");
  assert.equal(backgroundJobSink.jobs[0]?.payload.disciplineCode, "building");
  assert.equal(backgroundJobSink.jobs[0]?.result, null);
  assert.equal(backgroundJobSink.jobs[0]?.errorMessage, null);
  assert.equal(backgroundJobSink.jobs[0]?.completedAt, null);
  assert.equal(
    backgroundJobSink.jobs[0]?.createdAt,
    response.json().createdAt,
  );

  const jobResponse = await app.inject({
    method: "GET",
    url: `/v1/jobs/${response.json().id}`,
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(jobResponse.statusCode, 200);
  assert.equal(jobResponse.json().id, response.json().id);
  assert.equal(jobResponse.json().status, "queued");

  const jobsListResponse = await app.inject({
    method: "GET",
    url: "/v1/jobs?projectId=project-001&jobType=project_recalculate&status=queued",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(jobsListResponse.statusCode, 200);
  assert.equal(jobsListResponse.json().items.length, 1);
  assert.equal(jobsListResponse.json().items[0].id, response.json().id);

  await app.close();
});

test("POST /v1/projects/:id/recalculate rejects when no bill versions match the requested scope", async () => {
  const backgroundJobSink = new RecordingBackgroundJobSink();
  const app = createPricingApp({
    projectDefaults: {
      defaultPriceVersionId: "price-version-001",
      defaultFeeTemplateId: "fee-template-001",
    },
    backgroundJobSink,
  });
  const adminToken = await signAccessToken(
    {
      sub: "ops-001",
      roleCodes: ["system_admin"],
      displayName: "Ops Admin",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/recalculate",
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
    payload: {
      stageCode: "budget",
      disciplineCode: "plumbing",
    },
  });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "No bill versions matched the requested recalculation scope",
    },
  });
  assert.equal(backgroundJobSink.jobs.length, 0);

  await app.close();
});

test("POST /v1/projects/:id/recalculate rejects when price version discipline does not match the target scope", async () => {
  const backgroundJobSink = new RecordingBackgroundJobSink();
  const app = createPricingApp({
    priceVersions: [
      ...priceVersions,
      {
        id: "price-version-002",
        versionCode: "JS-2024-PLUMBING",
        versionName: "江苏 2024 安装价目",
        regionCode: "JS",
        disciplineCode: "plumbing",
        status: "active",
      },
    ],
    backgroundJobSink,
  });
  const adminToken = await signAccessToken(
    {
      sub: "ops-001",
      roleCodes: ["system_admin"],
      displayName: "Ops Admin",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/recalculate",
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
    payload: {
      stageCode: "estimate",
      disciplineCode: "building",
      priceVersionId: "price-version-002",
    },
  });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "Price version discipline does not match the requested recalculation scope",
    },
  });
  assert.equal(backgroundJobSink.jobs.length, 0);

  await app.close();
});

test("POST /v1/projects/:id/recalculate rejects inactive price versions", async () => {
  const backgroundJobSink = new RecordingBackgroundJobSink();
  const app = createPricingApp({
    priceVersions: [
      ...priceVersions,
      {
        id: "price-version-002",
        versionCode: "JS-2024-BUILDING-INACTIVE",
        versionName: "江苏 2024 建筑价目（停用）",
        regionCode: "JS",
        disciplineCode: "building",
        status: "inactive",
      },
    ],
    backgroundJobSink,
  });
  const adminToken = await signAccessToken(
    {
      sub: "ops-001",
      roleCodes: ["system_admin"],
      displayName: "Ops Admin",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/recalculate",
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
    payload: {
      stageCode: "estimate",
      disciplineCode: "building",
      priceVersionId: "price-version-002",
    },
  });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "Price version must be active before calculation",
    },
  });
  assert.equal(backgroundJobSink.jobs.length, 0);

  await app.close();
});

test("POST /v1/projects/:id/recalculate rejects when fee template stage scope does not match the target scope", async () => {
  const backgroundJobSink = new RecordingBackgroundJobSink();
  const app = createPricingApp({
    feeTemplates: [
      ...feeTemplates,
      {
        id: "fee-template-002",
        templateName: "江苏建筑预算取费",
        projectType: "building",
        regionCode: "JS",
        stageScope: ["budget"],
        taxMode: "general",
        allocationMode: "proportional",
        status: "active",
      },
    ],
    backgroundJobSink,
  });
  const adminToken = await signAccessToken(
    {
      sub: "ops-001",
      roleCodes: ["system_admin"],
      displayName: "Ops Admin",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/recalculate",
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
    payload: {
      stageCode: "estimate",
      disciplineCode: "building",
      feeTemplateId: "fee-template-002",
    },
  });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "Fee template does not apply to the requested recalculation scope",
    },
  });
  assert.equal(backgroundJobSink.jobs.length, 0);

  await app.close();
});

test("POST /v1/projects/:id/recalculate rejects inactive fee templates", async () => {
  const backgroundJobSink = new RecordingBackgroundJobSink();
  const app = createPricingApp({
    feeTemplates: [
      ...feeTemplates,
      {
        id: "fee-template-003",
        templateName: "江苏建筑取费（停用）",
        projectType: "building",
        regionCode: "JS",
        stageScope: ["estimate"],
        taxMode: "general",
        allocationMode: "proportional",
        status: "inactive",
      },
    ],
    backgroundJobSink,
  });
  const adminToken = await signAccessToken(
    {
      sub: "ops-001",
      roleCodes: ["system_admin"],
      displayName: "Ops Admin",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/recalculate",
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
    payload: {
      stageCode: "estimate",
      disciplineCode: "building",
      feeTemplateId: "fee-template-003",
    },
  });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "Fee template must be active before calculation",
    },
  });
  assert.equal(backgroundJobSink.jobs.length, 0);

  await app.close();
});

test("POST /v1/projects/:id/recalculate rejects inactive default price versions", async () => {
  const backgroundJobSink = new RecordingBackgroundJobSink();
  const app = createPricingApp({
    priceVersions: [
      {
        ...priceVersions[0],
        status: "inactive",
      },
    ],
    projectDefaults: {
      defaultPriceVersionId: "price-version-001",
      defaultFeeTemplateId: "fee-template-001",
    },
    backgroundJobSink,
  });
  const adminToken = await signAccessToken(
    {
      sub: "ops-001",
      roleCodes: ["system_admin"],
      displayName: "Ops Admin",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/recalculate",
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
    payload: {
      stageCode: "estimate",
      disciplineCode: "building",
    },
  });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "Price version must be active before calculation",
    },
  });
  assert.equal(backgroundJobSink.jobs.length, 0);

  await app.close();
});

test("POST /v1/projects/:id/recalculate rejects inactive default fee templates", async () => {
  const backgroundJobSink = new RecordingBackgroundJobSink();
  const app = createPricingApp({
    feeTemplates: [
      {
        ...feeTemplates[0],
        status: "inactive",
      },
    ],
    projectDefaults: {
      defaultPriceVersionId: "price-version-001",
      defaultFeeTemplateId: "fee-template-001",
    },
    backgroundJobSink,
  });
  const adminToken = await signAccessToken(
    {
      sub: "ops-001",
      roleCodes: ["system_admin"],
      displayName: "Ops Admin",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/recalculate",
    headers: {
      authorization: `Bearer ${adminToken}`,
    },
    payload: {
      stageCode: "estimate",
      disciplineCode: "building",
    },
  });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "Fee template must be active before calculation",
    },
  });
  assert.equal(backgroundJobSink.jobs.length, 0);

  await app.close();
});

test("POST /v1/jobs/:jobId/process processes a queued project recalculate job for system admins", async () => {
  const backgroundJobSink = new RecordingBackgroundJobSink();
  const app = createPricingApp({
    projectDefaults: {
      defaultPriceVersionId: "price-version-001",
      defaultFeeTemplateId: "fee-template-001",
    },
    backgroundJobSink,
  });
  const engineerToken = await signAccessToken(
    {
      sub: "engineer-001",
      roleCodes: ["cost_engineer"],
      displayName: "Cost Engineer",
    },
    jwtSecret,
  );
  const operatorToken = await signAccessToken(
    {
      sub: "ops-001",
      roleCodes: ["system_admin"],
      displayName: "Ops Admin",
    },
    jwtSecret,
  );

  const queueResponse = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/recalculate",
    headers: {
      authorization: `Bearer ${engineerToken}`,
    },
    payload: {
      stageCode: "estimate",
      disciplineCode: "building",
    },
  });

  assert.equal(queueResponse.statusCode, 202);

  const processResponse = await app.inject({
    method: "POST",
    url: `/v1/jobs/${queueResponse.json().id}/process`,
    headers: {
      authorization: `Bearer ${operatorToken}`,
    },
  });

  assert.equal(processResponse.statusCode, 200);
  assert.equal(processResponse.json().status, "completed");
  assert.equal(processResponse.json().result.projectId, "project-001");
  assert.equal(processResponse.json().result.versionCount, 2);
  assert.equal(processResponse.json().result.recalculatedCount, 1);
  assert.equal(processResponse.json().result.skippedCount, 3);
  assert.deepEqual(processResponse.json().result.skippedSummary, [
    {
      reason: "missing_quota_lines",
      label: "缺少定额明细",
      count: 3,
    },
  ]);
  assert.equal(processResponse.json().result.totalSystemAmount, 1080);
  assert.equal(processResponse.json().result.totalFinalAmount, 1198.8);
  assert.deepEqual(processResponse.json().result.skippedItems, [
    {
      billVersionId: "bill-version-001",
      billItemId: "bill-item-002",
      reason: "missing_quota_lines",
      label: "缺少定额明细",
      details: {
        quotaLineCount: 0,
      },
    },
    {
      billVersionId: "bill-version-002",
      billItemId: "bill-item-003",
      reason: "missing_quota_lines",
      label: "缺少定额明细",
      details: {
        quotaLineCount: 0,
      },
    },
    {
      billVersionId: "bill-version-002",
      billItemId: "bill-item-004",
      reason: "missing_quota_lines",
      label: "缺少定额明细",
      details: {
        quotaLineCount: 0,
      },
    },
  ]);

  const jobResponse = await app.inject({
    method: "GET",
    url: `/v1/jobs/${queueResponse.json().id}`,
    headers: {
      authorization: `Bearer ${engineerToken}`,
    },
  });

  assert.equal(jobResponse.statusCode, 200);
  assert.equal(jobResponse.json().status, "completed");
  assert.equal(jobResponse.json().result.recalculatedCount, 1);

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
      reason: "市场询价调整",
    },
  });

  const response = await app.inject({
    method: "GET",
    url: "/v1/reports/summary/details?projectId=project-001&billVersionId=bill-version-001&stageCode=estimate&disciplineCode=building&limit=1",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().projectId, "project-001");
  assert.equal(response.json().billVersionId, "bill-version-001");
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
    varianceShare: 1,
  });

  await app.close();
});

test("GET /v1/reports/summary and /details support billVersionId filtering", async () => {
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

  const summaryResponse = await app.inject({
    method: "GET",
    url: "/v1/reports/summary?projectId=project-001&billVersionId=bill-version-001",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(summaryResponse.statusCode, 200);
  assert.equal(summaryResponse.json().billVersionId, "bill-version-001");
  assert.equal(summaryResponse.json().versionCount, 1);

  const detailResponse = await app.inject({
    method: "GET",
    url: "/v1/reports/summary/details?projectId=project-001&billVersionId=bill-version-001",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(detailResponse.statusCode, 200);
  assert.equal(detailResponse.json().billVersionId, "bill-version-001");
  assert.equal(
    detailResponse
      .json()
      .items.every((item: { billVersionId: string }) => item.billVersionId === "bill-version-001"),
    true,
  );

  await app.close();
});

test("GET /v1/reports/summary and /details support unitCode filtering", async () => {
  const app = createPricingApp();
  const token = await signAccessToken(
    {
      sub: "engineer-001",
      roleCodes: ["cost_engineer"],
      displayName: "Cost Engineer",
    },
    jwtSecret,
  );

  const summaryResponse = await app.inject({
    method: "GET",
    url: "/v1/reports/summary?projectId=project-001&stageCode=estimate&disciplineCode=building&unitCode=m2",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(summaryResponse.statusCode, 200);
  assert.deepEqual(summaryResponse.json(), {
    projectId: "project-001",
    billVersionId: null,
    stageCode: "estimate",
    disciplineCode: "building",
    unitCode: "m2",
    versionCount: 2,
    itemCount: 1,
    totalSystemAmount: 240,
    totalFinalAmount: 300,
    varianceAmount: 60,
    varianceRate: 0.25,
  });

  const detailResponse = await app.inject({
    method: "GET",
    url: "/v1/reports/summary/details?projectId=project-001&stageCode=estimate&disciplineCode=building&unitCode=m2",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(detailResponse.statusCode, 200);
  assert.equal(detailResponse.json().unitCode, "m2");
  assert.equal(detailResponse.json().totalCount, 1);
  assert.equal(detailResponse.json().items[0].itemId, "bill-item-004");

  await app.close();
});

test("GET /v1/reports/variance-breakdown groups variance by discipline and unit", async () => {
  const app = createPricingApp({
    disciplines: [
      ...disciplines,
      {
        id: "discipline-002",
        projectId: "project-001",
        disciplineCode: "install",
        disciplineName: "安装工程",
        defaultStandardSetCode: "js-2013-install",
        status: "enabled",
      },
    ],
    members: [
      {
        ...members[0],
        scopes: [
          { scopeType: "stage", scopeValue: "estimate" },
          { scopeType: "discipline", scopeValue: "building" },
          { scopeType: "discipline", scopeValue: "install" },
        ],
      },
    ],
    billVersions: [
      ...billVersions,
      {
        id: "bill-version-003",
        projectId: "project-001",
        stageCode: "estimate",
        disciplineCode: "install",
        versionNo: 1,
        versionName: "安装版 V1",
        versionStatus: "editable",
        sourceVersionId: null,
      },
    ],
    billItems: [
      ...billItems,
      {
        id: "bill-item-005",
        billVersionId: "bill-version-003",
        parentId: null,
        itemCode: "I.1",
        itemName: "安装清单项",
        quantity: 1,
        unit: "set",
        sortNo: 1,
        systemAmount: 500,
        finalAmount: 650,
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

  const disciplineResponse = await app.inject({
    method: "GET",
    url: "/v1/reports/variance-breakdown?projectId=project-001&groupBy=discipline",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(disciplineResponse.statusCode, 200);
  assert.deepEqual(disciplineResponse.json(), {
    projectId: "project-001",
    groupBy: "discipline",
    billVersionId: null,
    stageCode: null,
    disciplineCode: null,
    unitCode: null,
    totalCount: 2,
    items: [
      {
        groupKey: "building",
        groupLabel: "building",
        versionCount: 2,
        itemCount: 4,
        totalSystemAmount: 1440,
        totalFinalAmount: 1620,
        varianceAmount: 180,
        varianceRate: 0.125,
        varianceShare: 0.545455,
      },
      {
        groupKey: "install",
        groupLabel: "install",
        versionCount: 1,
        itemCount: 1,
        totalSystemAmount: 500,
        totalFinalAmount: 650,
        varianceAmount: 150,
        varianceRate: 0.3,
        varianceShare: 0.454545,
      },
    ],
  });

  const unitResponse = await app.inject({
    method: "GET",
    url: "/v1/reports/variance-breakdown?projectId=project-001&groupBy=unit",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(unitResponse.statusCode, 200);
  assert.equal(unitResponse.json().groupBy, "unit");
  assert.deepEqual(
    unitResponse.json().items.map((item: { groupKey: string }) => item.groupKey),
    ["set", "m3", "m2"],
  );

  await app.close();
});

test("GET /v1/reports/version-compare compares two bill versions by item code", async () => {
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
    method: "GET",
    url: "/v1/reports/version-compare?projectId=project-001&baseBillVersionId=bill-version-001&targetBillVersionId=bill-version-002",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().baseBillVersionId, "bill-version-001");
  assert.equal(response.json().targetBillVersionId, "bill-version-002");
  assert.equal(response.json().itemCount, 3);
  assert.deepEqual(response.json().items[0], {
    itemCode: "A.1",
    itemNameBase: "土石方工程",
    itemNameTarget: "土石方工程",
    baseSystemAmount: 1080,
    targetSystemAmount: 1200,
    baseFinalAmount: 1198.8,
    targetFinalAmount: 1320,
    systemVarianceAmount: 120,
    finalVarianceAmount: 121.2,
  });

  await app.close();
});

test("POST /v1/reports/export queues a summary export task that completes when the background job is processed", async () => {
  const backgroundJobSink = new RecordingBackgroundJobSink();
  const app = createPricingApp({
    projectDefaults: {
      defaultPriceVersionId: "price-version-001",
      defaultFeeTemplateId: "fee-template-001",
    },
    backgroundJobSink,
  });
  const token = await signAccessToken(
    {
      sub: "engineer-001",
      roleCodes: ["cost_engineer"],
      displayName: "Cost Engineer",
    },
    jwtSecret,
  );
  const operatorToken = await signAccessToken(
    {
      sub: "ops-001",
      roleCodes: ["system_admin"],
      displayName: "Ops Admin",
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
      reportTemplateId: "tpl-standard-summary-v1",
      outputFormat: "pdf",
    },
  });

  assert.equal(createResponse.statusCode, 202);
  assert.equal(createResponse.json().job.jobType, "report_export");
  assert.equal(createResponse.json().job.status, "queued");
  assert.equal(createResponse.json().result.status, "queued");
  assert.equal(createResponse.json().result.reportType, "summary");
  assert.equal(
    createResponse.json().result.reportTemplateId,
    "tpl-standard-summary-v1",
  );
  assert.equal(createResponse.json().result.outputFormat, "pdf");
  assert.equal(backgroundJobSink.jobs.length, 1);
  assert.equal(
    backgroundJobSink.jobs[0]?.payload.reportTemplateId,
    "tpl-standard-summary-v1",
  );
  assert.equal(backgroundJobSink.jobs[0]?.payload.outputFormat, "pdf");

  const taskId = createResponse.json().result.id as string;
  const queryResponse = await app.inject({
    method: "GET",
    url: `/v1/reports/export/${taskId}`,
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(queryResponse.statusCode, 200);
  assert.equal(queryResponse.json().id, taskId);
  assert.equal(queryResponse.json().status, "queued");
  assert.equal(queryResponse.json().reportTemplateId, "tpl-standard-summary-v1");
  assert.equal(queryResponse.json().outputFormat, "pdf");
  assert.equal(queryResponse.json().resultPreview, null);

  const processResponse = await app.inject({
    method: "POST",
    url: `/v1/jobs/${createResponse.json().job.id}/process`,
    headers: {
      authorization: `Bearer ${operatorToken}`,
    },
  });

  assert.equal(processResponse.statusCode, 200);
  assert.equal(processResponse.json().status, "completed");
  assert.equal(processResponse.json().result.taskId, taskId);

  const jobResponse = await app.inject({
    method: "GET",
    url: `/v1/jobs/${createResponse.json().job.id}`,
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(jobResponse.statusCode, 200);
  assert.equal(jobResponse.json().id, createResponse.json().job.id);
  assert.equal(jobResponse.json().status, "completed");

  const completedTaskResponse = await app.inject({
    method: "GET",
    url: `/v1/reports/export/${taskId}`,
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(completedTaskResponse.statusCode, 200);
  assert.equal(completedTaskResponse.json().status, "completed");
  assert.equal(
    completedTaskResponse.json().reportTemplateId,
    "tpl-standard-summary-v1",
  );
  assert.equal(completedTaskResponse.json().outputFormat, "pdf");
  assert.equal(completedTaskResponse.json().isDownloadReady, true);
  assert.equal(completedTaskResponse.json().isTerminal, true);
  assert.equal(completedTaskResponse.json().hasFailed, false);
  assert.equal(completedTaskResponse.json().resultPreview.projectId, "project-001");
  assert.equal(completedTaskResponse.json().resultPreview.totalSystemAmount, 2520);
  assert.equal(
    completedTaskResponse.json().downloadFileName,
    `summary-${taskId}.json`,
  );
  assert.equal(
    completedTaskResponse.json().downloadContentType,
    "application/json; charset=utf-8",
  );
  assert.equal(
    completedTaskResponse.json().downloadContentLength,
    Buffer.byteLength(
      JSON.stringify(completedTaskResponse.json().resultPreview, null, 2),
      "utf8",
    ),
  );

  const jobsListResponse = await app.inject({
    method: "GET",
    url: "/v1/jobs?projectId=project-001&jobType=report_export&status=completed&requestedBy=engineer-001",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(jobsListResponse.statusCode, 200);
  assert.equal(jobsListResponse.json().items.length, 1);
  assert.equal(jobsListResponse.json().items[0].id, createResponse.json().job.id);
  assert.equal(jobsListResponse.json().summary.totalCount, 1);
  assert.equal(jobsListResponse.json().summary.statusCounts.completed, 1);
  assert.equal(jobsListResponse.json().summary.jobTypeCounts.report_export, 1);

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
  assert.equal(
    Number.parseInt(downloadResponse.headers["content-length"] ?? "0", 10),
    Buffer.byteLength(downloadResponse.body, "utf8"),
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

  const createAuditResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/audit-logs?resourceType=report_export_task&action=created",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(createAuditResponse.statusCode, 200);
  assert.equal(createAuditResponse.json().items.length, 1);
  assert.equal(createAuditResponse.json().items[0].resourceId, taskId);
  assert.equal(createAuditResponse.json().items[0].afterPayload.status, "queued");
  assert.equal(
    createAuditResponse.json().items[0].afterPayload.reportTemplateId,
    "tpl-standard-summary-v1",
  );
  assert.equal(
    createAuditResponse.json().items[0].afterPayload.outputFormat,
    "pdf",
  );
  assert.equal(
    createAuditResponse.json().items[0].afterPayload.disciplineCode,
    "building",
  );

  const backgroundAuditResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/audit-logs?resourceType=background_job&action=completed",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(backgroundAuditResponse.statusCode, 200);
  assert.equal(backgroundAuditResponse.json().items.length, 1);
  assert.equal(
    backgroundAuditResponse.json().items[0].resourceId,
    createResponse.json().job.id,
  );

  await app.close();
});

test("POST /v1/reports/export queues a stage bill export task with scoped details", async () => {
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
  const operatorToken = await signAccessToken(
    {
      sub: "ops-001",
      roleCodes: ["system_admin"],
      displayName: "Ops Admin",
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
      reportType: "stage_bill",
      stageCode: "estimate",
      disciplineCode: "building",
      reportTemplateId: "tpl-standard-stage-bill-v1",
      outputFormat: "excel",
    },
  });

  assert.equal(createResponse.statusCode, 202);
  assert.equal(createResponse.json().result.reportType, "stage_bill");
  assert.equal(
    createResponse.json().result.reportTemplateId,
    "tpl-standard-stage-bill-v1",
  );
  assert.equal(createResponse.json().result.outputFormat, "excel");

  const processResponse = await app.inject({
    method: "POST",
    url: `/v1/jobs/${createResponse.json().job.id}/process`,
    headers: {
      authorization: `Bearer ${operatorToken}`,
    },
  });

  assert.equal(processResponse.statusCode, 200);
  assert.equal(processResponse.json().status, "completed");

  const taskId = createResponse.json().result.id as string;
  const completedTaskResponse = await app.inject({
    method: "GET",
    url: `/v1/reports/export/${taskId}`,
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(completedTaskResponse.statusCode, 200);
  assert.equal(completedTaskResponse.json().status, "completed");
  assert.equal(completedTaskResponse.json().resultPreview.reportType, "stage_bill");
  assert.equal(completedTaskResponse.json().resultPreview.stageCode, "estimate");
  assert.equal(completedTaskResponse.json().resultPreview.disciplineCode, "building");
  assert.ok(completedTaskResponse.json().resultPreview.items.length > 0);
  assert.equal(
    completedTaskResponse.json().resultPreview.items[0].stageCode,
    "estimate",
  );
  assert.equal(
    completedTaskResponse.json().downloadFileName,
    `stage_bill-${taskId}.json`,
  );

  await app.close();
});

test("POST /v1/reports/export rejects roles without report export permission", async () => {
  const app = createPricingApp({
    projectDefaults: {
      defaultPriceVersionId: "price-version-001",
      defaultFeeTemplateId: "fee-template-001",
    },
  });
  const reviewerToken = await signAccessToken(
    {
      sub: "reviewer-001",
      roleCodes: ["reviewer"],
      displayName: "Reviewer",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "POST",
    url: "/v1/reports/export",
    headers: {
      authorization: `Bearer ${reviewerToken}`,
    },
    payload: {
      projectId: "project-001",
      reportType: "summary",
      stageCode: "estimate",
      disciplineCode: "building",
    },
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error.code, "FORBIDDEN");
  assert.equal(
    response.json().error.message,
    "You do not have permission to export reports",
  );

  await app.close();
});

test("GET /v1/jobs and GET /v1/projects/:id/audit-logs reject non-members", async () => {
  const app = createPricingApp({
    projectDefaults: {
      defaultPriceVersionId: "price-version-001",
      defaultFeeTemplateId: "fee-template-001",
    },
  });
  const ownerToken = await signAccessToken(
    {
      sub: "engineer-001",
      roleCodes: ["cost_engineer"],
      displayName: "Cost Engineer",
    },
    jwtSecret,
  );
  const outsiderToken = await signAccessToken(
    {
      sub: "outsider-001",
      roleCodes: ["cost_engineer"],
      displayName: "Outsider",
    },
    jwtSecret,
  );

  const exportResponse = await app.inject({
    method: "POST",
    url: "/v1/reports/export",
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
    payload: {
      projectId: "project-001",
      reportType: "summary",
      stageCode: "estimate",
      disciplineCode: "building",
    },
  });

  const jobsResponse = await app.inject({
    method: "GET",
    url: "/v1/jobs?projectId=project-001",
    headers: {
      authorization: `Bearer ${outsiderToken}`,
    },
  });

  assert.equal(jobsResponse.statusCode, 403);
  assert.equal(jobsResponse.json().error.code, "FORBIDDEN");

  const auditResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/audit-logs?resourceType=background_job&resourceId=" +
      exportResponse.json().job.id,
    headers: {
      authorization: `Bearer ${outsiderToken}`,
    },
  });

  assert.equal(auditResponse.statusCode, 403);
  assert.equal(auditResponse.json().error.code, "FORBIDDEN");

  await app.close();
});

test("GET /v1/jobs supports requestedBy, createdAt range, and limit filtering", async () => {
  const app = createPricingApp({
    backgroundJobs: [
      {
        id: "background-job-001",
        jobType: "report_export",
        status: "completed",
        requestedBy: "engineer-001",
        projectId: "project-001",
        payload: {
          projectId: "project-001",
          reportType: "summary",
        },
        result: { exported: true },
        errorMessage: null,
        createdAt: "2026-04-18T10:00:00.000Z",
        completedAt: "2026-04-18T10:01:00.000Z",
      },
      {
        id: "background-job-002",
        jobType: "project_recalculate",
        status: "failed",
        requestedBy: "engineer-001",
        projectId: "project-001",
        payload: {
          projectId: "project-001",
        },
        result: null,
        errorMessage: "failed",
        createdAt: "2026-04-18T10:30:00.000Z",
        completedAt: "2026-04-18T10:31:00.000Z",
      },
      {
        id: "background-job-003",
        jobType: "report_export",
        status: "queued",
        requestedBy: "owner-001",
        projectId: "project-001",
        payload: {
          projectId: "project-001",
          reportType: "summary",
        },
        result: null,
        errorMessage: null,
        createdAt: "2026-04-18T11:00:00.000Z",
        completedAt: null,
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
    url: "/v1/jobs?projectId=project-001&requestedBy=engineer-001&createdFrom=2026-04-18T10:15:00.000Z&createdTo=2026-04-18T10:59:59.000Z&limit=1",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().items.length, 1);
  assert.equal(response.json().items[0].id, "background-job-002");
  assert.equal(response.json().summary.totalCount, 1);
  assert.equal(response.json().summary.statusCounts.failed, 1);
  assert.equal(response.json().summary.jobTypeCounts.project_recalculate, 1);

  await app.close();
});

test("GET /v1/jobs supports completedAt range filtering", async () => {
  const app = createPricingApp({
    backgroundJobs: [
      {
        id: "background-job-001",
        jobType: "report_export",
        status: "completed",
        requestedBy: "engineer-001",
        projectId: "project-001",
        payload: {
          projectId: "project-001",
          reportType: "summary",
        },
        result: { exported: true },
        errorMessage: null,
        createdAt: "2026-04-18T10:00:00.000Z",
        completedAt: "2026-04-18T10:05:00.000Z",
      },
      {
        id: "background-job-002",
        jobType: "project_recalculate",
        status: "failed",
        requestedBy: "engineer-001",
        projectId: "project-001",
        payload: {
          projectId: "project-001",
        },
        result: null,
        errorMessage: "failed",
        createdAt: "2026-04-18T10:30:00.000Z",
        completedAt: "2026-04-18T10:31:00.000Z",
      },
      {
        id: "background-job-003",
        jobType: "report_export",
        status: "queued",
        requestedBy: "engineer-001",
        projectId: "project-001",
        payload: {
          projectId: "project-001",
          reportType: "summary",
        },
        result: null,
        errorMessage: null,
        createdAt: "2026-04-18T10:40:00.000Z",
        completedAt: null,
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
    url: "/v1/jobs?projectId=project-001&requestedBy=engineer-001&completedFrom=2026-04-18T10:30:00.000Z&completedTo=2026-04-18T10:32:00.000Z",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().items.length, 1);
  assert.equal(response.json().items[0].id, "background-job-002");
  assert.equal(response.json().summary.totalCount, 1);
  assert.equal(response.json().summary.statusCounts.failed, 1);

  await app.close();
});

test("calculation flows write bill item and project audit logs", async () => {
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

  const recalculateResponse = await app.inject({
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

  assert.equal(recalculateResponse.statusCode, 202);

  const calculateAuditResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/audit-logs?resourceType=bill_item&resourceId=bill-item-001&action=calculate",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(calculateAuditResponse.statusCode, 200);
  assert.ok(calculateAuditResponse.json().items.length >= 1);

  const projectRecalculateAuditResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/audit-logs?resourceType=background_job&action=queued",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(projectRecalculateAuditResponse.statusCode, 200);
  assert.ok(projectRecalculateAuditResponse.json().items.length >= 1);

  const manualPricingResponse = await app.inject({
    method: "PUT",
    url: "/v1/projects/project-001/bill-versions/bill-version-001/items/bill-item-001/manual-pricing",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      manualUnitPrice: 12.5,
      reason: "市场询价调整",
    },
  });

  assert.equal(manualPricingResponse.statusCode, 200);

  const manualPricingAuditResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/audit-logs?resourceType=bill_item&resourceId=bill-item-001&action=manual_pricing",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(manualPricingAuditResponse.statusCode, 200);
  assert.equal(manualPricingAuditResponse.json().items[0].afterPayload.reason, "市场询价调整");

  await app.close();
});
