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
import { InMemoryAuditLogRepository } from "../src/modules/audit/audit-log-repository.js";
import { InMemoryAiRecommendationRepository } from "../src/modules/ai/ai-recommendation-repository.js";
import {
  InMemoryBillVersionRepository,
  type BillVersionRecord,
} from "../src/modules/bill/bill-version-repository.js";
import {
  InMemoryBillItemRepository,
  type BillItemRecord,
} from "../src/modules/bill/bill-item-repository.js";
import { InMemoryQuotaLineRepository } from "../src/modules/quota/quota-line-repository.js";

const jwtSecret = "ai-recommendation-test-secret";

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
    defaultStandardSetCode: "JS-2014",
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
  {
    id: "member-002",
    projectId: "project-001",
    userId: "reviewer-001",
    displayName: "Reviewer User",
    roleCode: "reviewer",
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
    itemCode: "A-001",
    itemName: "土方工程",
    quantity: 10,
    unit: "m3",
    sortNo: 1,
  },
];

function createRecommendationApp(input?: { billItems?: BillItemRecord[] }) {
  return createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(projects),
    projectStageRepository: new InMemoryProjectStageRepository(stages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      disciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(members),
    billVersionRepository: new InMemoryBillVersionRepository(billVersions),
    billItemRepository: new InMemoryBillItemRepository(input?.billItems ?? billItems),
    quotaLineRepository: new InMemoryQuotaLineRepository([]),
    auditLogRepository: new InMemoryAuditLogRepository([]),
    aiRecommendationRepository: new InMemoryAiRecommendationRepository([]),
});
}

async function createToken(userId: string, roleCode: string) {
  return signAccessToken(
    {
      sub: userId,
      displayName: userId,
      roleCodes: [roleCode],
    },
    jwtSecret,
  );
}

test("POST /v1/ai/bill-recommendations creates generated recommendation and audit log", async () => {
  const app = createRecommendationApp();
  const token = await createToken("engineer-001", "cost_engineer");

  const response = await app.inject({
    method: "POST",
    url: "/v1/ai/bill-recommendations",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      projectId: "project-001",
      stageCode: "estimate",
      disciplineCode: "building",
      resourceType: "bill_version",
      resourceId: "bill-version-001",
      inputPayload: {
        source: "manual_context",
      },
      outputPayload: {
        items: [
          {
            itemCode: "A-001",
            itemName: "土方工程",
          },
        ],
        reason: "相似项目常见缺项",
      },
    },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().recommendationType, "bill_recommendation");
  assert.equal(response.json().status, "generated");

  const listResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/ai/bill-recommendations?status=generated",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.json().summary.totalCount, 1);
  assert.equal(listResponse.json().items[0].resourceId, "bill-version-001");

  const auditResponse = await app.inject({
    method: "GET",
    url: `/v1/projects/project-001/audit-logs?resourceType=ai_recommendation&resourceId=${response.json().id}&action=generated`,
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  assert.equal(auditResponse.statusCode, 200);
  assert.equal(auditResponse.json().items.length, 1);

  await app.close();
});

test("POST /v1/ai/bill-recommendations expires older generated recommendations for the same resource", async () => {
  const app = createRecommendationApp();
  const token = await createToken("engineer-001", "cost_engineer");

  const firstResponse = await app.inject({
    method: "POST",
    url: "/v1/ai/bill-recommendations",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      projectId: "project-001",
      stageCode: "estimate",
      disciplineCode: "building",
      resourceType: "bill_version",
      resourceId: "bill-version-001",
      outputPayload: {
        itemCode: "A-002",
        itemName: "回填土",
      },
    },
  });
  assert.equal(firstResponse.statusCode, 201);

  const secondResponse = await app.inject({
    method: "POST",
    url: "/v1/ai/bill-recommendations",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      projectId: "project-001",
      stageCode: "estimate",
      disciplineCode: "building",
      resourceType: "bill_version",
      resourceId: "bill-version-001",
      outputPayload: {
        itemCode: "A-003",
        itemName: "余方弃置",
      },
    },
  });
  assert.equal(secondResponse.statusCode, 201);

  const expiredResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/ai/bill-recommendations?status=expired",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  assert.equal(expiredResponse.statusCode, 200);
  assert.equal(expiredResponse.json().items.length, 1);
  assert.equal(expiredResponse.json().items[0].id, firstResponse.json().id);
  assert.equal(
    expiredResponse.json().items[0].statusReason,
    "superseded_by_new_recommendation",
  );

  const generatedResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/ai/bill-recommendations?status=generated",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  assert.equal(generatedResponse.statusCode, 200);
  assert.equal(generatedResponse.json().items.length, 1);
  assert.equal(generatedResponse.json().items[0].id, secondResponse.json().id);

  await app.close();
});

test("POST /v1/ai/variance-warnings generates threshold-based warnings from summary details", async () => {
  const app = createRecommendationApp({
    billItems: [
      {
        ...billItems[0],
        systemAmount: 100,
        finalAmount: 140,
        systemUnitPrice: 10,
        finalUnitPrice: 14,
      },
      {
        id: "bill-item-002",
        billVersionId: "bill-version-001",
        parentId: null,
        itemCode: "A-002",
        itemName: "回填土",
        quantity: 5,
        unit: "m3",
        sortNo: 2,
        systemAmount: 100,
        finalAmount: 105,
        systemUnitPrice: 20,
        finalUnitPrice: 21,
      },
    ],
  });
  const token = await createToken("engineer-001", "cost_engineer");

  const response = await app.inject({
    method: "POST",
    url: "/v1/ai/variance-warnings",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      projectId: "project-001",
      stageCode: "estimate",
      disciplineCode: "building",
      billVersionId: "bill-version-001",
      thresholdRate: 0.2,
      thresholdAmount: 30,
    },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().items.length, 1);
  assert.equal(response.json().summary.typeCounts.variance_warning, 1);
  assert.equal(response.json().items[0].resourceType, "bill_item");
  assert.equal(response.json().items[0].resourceId, "bill-item-001");
  assert.equal(response.json().items[0].outputPayload.varianceAmount, 40);
  assert.equal(response.json().items[0].outputPayload.thresholdRate, 0.2);

  const listResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/ai/variance-warnings?status=generated",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.json().items.length, 1);

  await app.close();
});

test("POST /v1/ai/recommendations/:id/accept creates a formal bill item for bill recommendations", async () => {
  const app = createRecommendationApp();
  const token = await createToken("engineer-001", "cost_engineer");

  const createdResponse = await app.inject({
    method: "POST",
    url: "/v1/ai/bill-recommendations",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      projectId: "project-001",
      stageCode: "estimate",
      disciplineCode: "building",
      resourceType: "bill_version",
      resourceId: "bill-version-001",
      outputPayload: {
        parentId: null,
        itemCode: "A-002",
        itemName: "回填土",
        quantity: 6,
        unit: "m3",
        sortNo: 2,
        reason: "相似项目常见缺项",
      },
    },
  });
  assert.equal(createdResponse.statusCode, 201);

  const acceptResponse = await app.inject({
    method: "POST",
    url: `/v1/ai/recommendations/${createdResponse.json().id}/accept`,
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      reason: "确认新增清单",
    },
  });

  assert.equal(acceptResponse.statusCode, 200);
  assert.equal(acceptResponse.json().status, "accepted");
  assert.equal(
    acceptResponse.json().outputPayload.acceptedBillItemId,
    "bill-item-002",
  );

  const billItemsResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/bill-versions/bill-version-001/items",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  assert.equal(billItemsResponse.statusCode, 200);
  assert.equal(billItemsResponse.json().items.length, 2);
  assert.equal(billItemsResponse.json().items[1].itemCode, "A-002");

  const knowledgeResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/knowledge-entries?sourceType=ai_recommendation&sourceAction=accepted",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  assert.equal(knowledgeResponse.statusCode, 200);
  assert.equal(knowledgeResponse.json().items.length, 1);
  assert.equal(
    knowledgeResponse.json().items[0].metadata.recommendationId,
    createdResponse.json().id,
  );
  assert.equal(knowledgeResponse.json().items[0].sourceAction, "accepted");

  const memoryResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/memory-entries?subjectType=user&subjectId=engineer-001",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  assert.equal(memoryResponse.statusCode, 200);
  assert.equal(memoryResponse.json().items.length, 1);
  assert.match(
    memoryResponse.json().items[0].memoryKey,
    /ai_recommendation:accepted$/,
  );

  const feedbackAuditResponse = await app.inject({
    method: "GET",
    url: `/v1/projects/project-001/audit-logs?resourceType=ai_recommendation&resourceId=${createdResponse.json().id}&action=feedback_persisted`,
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  assert.equal(feedbackAuditResponse.statusCode, 200);
  assert.equal(feedbackAuditResponse.json().items.length, 1);
  assert.equal(
    feedbackAuditResponse.json().items[0].afterPayload.knowledgeEntryId,
    "knowledge-entry-001",
  );

  await app.close();
});

test("POST /v1/ai/recommendations/:id/accept transitions generated recommendation and blocks reviewers", async () => {
  const app = createRecommendationApp();
  const engineerToken = await createToken("engineer-001", "cost_engineer");
  const reviewerToken = await createToken("reviewer-001", "reviewer");

  const createdResponse = await app.inject({
    method: "POST",
    url: "/v1/ai/quota-recommendations",
    headers: {
      authorization: `Bearer ${engineerToken}`,
    },
    payload: {
      projectId: "project-001",
      stageCode: "estimate",
      disciplineCode: "building",
      resourceType: "bill_item",
      resourceId: "bill-item-001",
      outputPayload: {
        billVersionId: "bill-version-001",
        sourceStandardSetCode: "JS-2014",
        sourceQuotaId: "quota-001",
        sourceSequence: 1,
        chapterCode: "01",
        quotaCode: "010101",
        quotaName: "挖土方",
        unit: "m3",
        quantity: 10,
        laborFee: 1,
        materialFee: 2,
        machineFee: 3,
        contentFactor: 1,
        reason: "清单名称匹配",
      },
    },
  });
  assert.equal(createdResponse.statusCode, 201);

  const reviewerResponse = await app.inject({
    method: "POST",
    url: `/v1/ai/recommendations/${createdResponse.json().id}/accept`,
    headers: {
      authorization: `Bearer ${reviewerToken}`,
    },
    payload: {
      reason: "reviewer should not accept",
    },
  });
  assert.equal(reviewerResponse.statusCode, 403);

  const acceptResponse = await app.inject({
    method: "POST",
    url: `/v1/ai/recommendations/${createdResponse.json().id}/accept`,
    headers: {
      authorization: `Bearer ${engineerToken}`,
    },
    payload: {
      reason: "确认套用",
    },
  });

  assert.equal(acceptResponse.statusCode, 200);
  assert.equal(acceptResponse.json().status, "accepted");
  assert.equal(acceptResponse.json().handledBy, "engineer-001");
  assert.equal(acceptResponse.json().statusReason, "确认套用");
  assert.equal(
    acceptResponse.json().outputPayload.acceptedQuotaLineId,
    "quota-line-001",
  );

  const quotaLineResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/bill-versions/bill-version-001/items/bill-item-001/quota-lines",
    headers: {
      authorization: `Bearer ${engineerToken}`,
    },
  });
  assert.equal(quotaLineResponse.statusCode, 200);
  assert.equal(quotaLineResponse.json().items.length, 1);
  assert.equal(quotaLineResponse.json().items[0].sourceMode, "ai");

  const repeatResponse = await app.inject({
    method: "POST",
    url: `/v1/ai/recommendations/${createdResponse.json().id}/ignore`,
    headers: {
      authorization: `Bearer ${engineerToken}`,
    },
    payload: {
      reason: "重复处理",
    },
  });
  assert.equal(repeatResponse.statusCode, 409);

  await app.close();
});
