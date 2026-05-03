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
import {
  InMemoryQuotaLineRepository,
  type QuotaLineRecord,
} from "../src/modules/quota/quota-line-repository.js";
import { InMemoryBackgroundJobRepository } from "../src/modules/jobs/background-job-repository.js";
import { AiRuntimePreviewService } from "../src/modules/ai/ai-runtime-preview-service.js";

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

function createRecommendationApp(input?: {
  billItems?: BillItemRecord[];
  quotaLines?: QuotaLineRecord[];
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
    billItemRepository: new InMemoryBillItemRepository(input?.billItems ?? billItems),
    quotaLineRepository: new InMemoryQuotaLineRepository(input?.quotaLines ?? []),
    auditLogRepository: new InMemoryAuditLogRepository([]),
    aiRecommendationRepository: new InMemoryAiRecommendationRepository([]),
    backgroundJobRepository: new InMemoryBackgroundJobRepository([]),
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
  assert.match(response.json().inputPayload.aiAssistTraceId, /^ai-trace-/);
  assert.equal(response.json().inputPayload.aiProvider.provider, "manual");
  assert.equal(response.json().inputPayload.aiProvider.model, "manual_payload");
  assert.deepEqual(response.json().inputPayload.aiRequestSummary.payloadKeys, [
    "source",
  ]);
  assert.equal(
    response.json().outputPayload.aiAssistTraceId,
    response.json().inputPayload.aiAssistTraceId,
  );
  assert.deepEqual(response.json().outputPayload.aiResponseSummary.payloadKeys, [
    "items",
    "reason",
  ]);

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
  assert.equal(
    auditResponse.json().items[0].afterPayload.aiAssistTraceId,
    response.json().inputPayload.aiAssistTraceId,
  );

  await app.close();
});

test("POST /v1/ai/quota-recommendations preserves provided AI provider metadata", async () => {
  const app = createRecommendationApp();
  const token = await createToken("engineer-001", "cost_engineer");

  const response = await app.inject({
    method: "POST",
    url: "/v1/ai/quota-recommendations",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      projectId: "project-001",
      stageCode: "estimate",
      disciplineCode: "building",
      resourceType: "bill_item",
      resourceId: "bill-item-001",
      inputPayload: {
        aiProvider: {
          provider: "mock-provider",
          model: "mock-model-v1",
        },
        candidateCount: 3,
      },
      outputPayload: {
        quotaName: "挖土方",
        reason: "清单名称匹配",
      },
    },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().inputPayload.aiProvider.provider, "mock-provider");
  assert.equal(response.json().inputPayload.aiProvider.model, "mock-model-v1");
  assert.deepEqual(response.json().inputPayload.aiRequestSummary.payloadKeys, [
    "candidateCount",
  ]);

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

test("GET /v1/projects/:id/ai/recommendations filters by type and resource", async () => {
  const app = createRecommendationApp();
  const token = await createToken("engineer-001", "cost_engineer");

  const billResponse = await app.inject({
    method: "POST",
    url: "/v1/ai/bill-recommendations",
    headers: { authorization: `Bearer ${token}` },
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
  assert.equal(billResponse.statusCode, 201);

  const quotaResponse = await app.inject({
    method: "POST",
    url: "/v1/ai/quota-recommendations",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      projectId: "project-001",
      stageCode: "estimate",
      disciplineCode: "building",
      resourceType: "bill_item",
      resourceId: "bill-item-001",
      outputPayload: {
        quotaName: "挖土方",
      },
    },
  });
  assert.equal(quotaResponse.statusCode, 201);

  const listResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/ai/recommendations?recommendationType=quota_recommendation&resourceType=bill_item&resourceId=bill-item-001&limit=1",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.json().summary.totalCount, 1);
  assert.equal(listResponse.json().summary.typeCounts.quota_recommendation, 1);
  assert.deepEqual(
    listResponse.json().items.map((item: any) => item.id),
    [quotaResponse.json().id],
  );

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
  assert.equal(response.json().items.length, 3);
  assert.equal(response.json().summary.typeCounts.variance_warning, 3);
  const itemWarning = response
    .json()
    .items.find((item: any) => item.outputPayload.warningScope === "bill_item");
  const disciplineWarning = response
    .json()
    .items.find((item: any) => item.outputPayload.warningScope === "discipline");
  const unitWarning = response
    .json()
    .items.find((item: any) => item.outputPayload.warningScope === "unit");
  assert.equal(itemWarning.resourceType, "bill_item");
  assert.equal(itemWarning.resourceId, "bill-item-001");
  assert.equal(itemWarning.outputPayload.varianceAmount, 40);
  assert.equal(itemWarning.outputPayload.thresholdRate, 0.2);
  assert.equal(disciplineWarning.resourceType, "discipline");
  assert.equal(unitWarning.resourceType, "unit");

  const listResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/ai/variance-warnings?status=generated",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.json().items.length, 3);

  await app.close();
});

test("POST /v1/ai/recommendation-jobs queues and processes provider-backed recommendations", async () => {
  const backgroundJobRepository = new InMemoryBackgroundJobRepository([]);
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
    quotaLineRepository: new InMemoryQuotaLineRepository([]),
    auditLogRepository: new InMemoryAuditLogRepository([]),
    aiRecommendationRepository: new InMemoryAiRecommendationRepository([]),
    backgroundJobRepository,
    aiRuntimePreviewService: new AiRuntimePreviewService({
      pythonExecutable: "python3",
      cliPath: "/tmp/ai-runtime-cli.py",
      commandRunner: async (_command, _args, input) => {
        assert.match(input, /"task":"llm_chat"/);
        assert.match(input, /bill-version-001/);
        return {
          stdout: JSON.stringify({
            source: "llm_provider",
            result: {
              provider: {
                provider: "openai_compatible",
                model: "cost-model-v1",
              },
              content: JSON.stringify({
                recommendations: [
                  {
                    outputPayload: {
                      parentId: null,
                      itemCode: "A-002",
                      itemName: "回填土",
                      quantity: 6,
                      unit: "m3",
                      sortNo: 2,
                      reason: "历史清单匹配",
                    },
                  },
                ],
              }),
              telemetry: { durationMs: 25, retryCount: 1 },
            },
          }),
          stderr: "",
        };
      },
    }),
  });
  const token = await createToken("engineer-001", "cost_engineer");

  const queuedResponse = await app.inject({
    method: "POST",
    url: "/v1/ai/recommendation-jobs",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      projectId: "project-001",
      recommendationType: "bill_recommendation",
      resourceType: "bill_version",
      resourceId: "bill-version-001",
      stageCode: "estimate",
      disciplineCode: "building",
      provider: "openai_compatible",
      model: "cost-model-v1",
    },
  });
  assert.equal(queuedResponse.statusCode, 202);
  assert.equal(queuedResponse.json().job.jobType, "ai_recommendation");
  assert.equal(queuedResponse.json().job.status, "queued");

  const processResponse = await app.inject({
    method: "POST",
    url: `/v1/jobs/${queuedResponse.json().job.id}/process`,
    headers: {
      authorization: `Bearer ${await createToken("admin-001", "system_admin")}`,
    },
  });
  assert.equal(processResponse.statusCode, 200);
  assert.equal(processResponse.json().status, "completed");
  assert.equal(processResponse.json().result.createdCount, 1);
  assert.equal(processResponse.json().result.telemetry.durationMs, 25);
  assert.equal(processResponse.json().result.telemetry.retryCount, 1);
  assert.equal(
    processResponse.json().result.recommendations[0].inputPayload.aiProvider.model,
    "cost-model-v1",
  );

  await app.close();
});

test("provider-backed recommendation job stores failure summary for invalid schema", async () => {
  const backgroundJobRepository = new InMemoryBackgroundJobRepository([]);
  const auditLogRepository = new InMemoryAuditLogRepository([]);
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
    quotaLineRepository: new InMemoryQuotaLineRepository([]),
    auditLogRepository,
    aiRecommendationRepository: new InMemoryAiRecommendationRepository([]),
    backgroundJobRepository,
    aiRuntimePreviewService: new AiRuntimePreviewService({
      pythonExecutable: "python3",
      cliPath: "/tmp/ai-runtime-cli.py",
      commandRunner: async () => ({
        stdout: JSON.stringify({
          source: "llm_provider",
          result: {
            provider: {
              provider: "openai_compatible",
              model: "cost-model-v1",
            },
            content: JSON.stringify({
              recommendations: [{ outputPayload: { itemCode: "A-002" } }],
            }),
            telemetry: { durationMs: 12, retryCount: 0 },
          },
        }),
        stderr: "",
      }),
    }),
  });
  const token = await createToken("engineer-001", "cost_engineer");

  const queuedResponse = await app.inject({
    method: "POST",
    url: "/v1/ai/recommendation-jobs",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      projectId: "project-001",
      recommendationType: "bill_recommendation",
      resourceType: "bill_version",
      resourceId: "bill-version-001",
      stageCode: "estimate",
      disciplineCode: "building",
    },
  });
  assert.equal(queuedResponse.statusCode, 202);

  const processResponse = await app.inject({
    method: "POST",
    url: `/v1/jobs/${queuedResponse.json().job.id}/process`,
    headers: {
      authorization: `Bearer ${await createToken("admin-001", "system_admin")}`,
    },
  });
  assert.equal(processResponse.statusCode, 200);
  assert.equal(processResponse.json().status, "failed");
  assert.equal(
    processResponse.json().result.providerFailureSummary.code,
    "AI_PROVIDER_RESPONSE_INVALID",
  );
  assert.match(
    processResponse.json().errorMessage,
    /AI provider response is invalid/,
  );

  await app.close();
});

test("GET /v1/ai/provider-health returns provider config status", async () => {
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
    quotaLineRepository: new InMemoryQuotaLineRepository([]),
    auditLogRepository: new InMemoryAuditLogRepository([]),
    aiRecommendationRepository: new InMemoryAiRecommendationRepository([]),
    backgroundJobRepository: new InMemoryBackgroundJobRepository([]),
    aiRuntimePreviewService: new AiRuntimePreviewService({
      pythonExecutable: "python3",
      cliPath: "/tmp/ai-runtime-cli.py",
      commandRunner: async () => ({
        stdout: JSON.stringify({
          source: "llm_provider",
          result: {
            provider: "openai_compatible",
            model: "cost-model-v1",
            configured: true,
            healthy: true,
            message: "ok",
          },
        }),
        stderr: "",
      }),
    }),
  });

  const response = await app.inject({
    method: "GET",
    url: "/v1/ai/provider-health",
    headers: {
      authorization: `Bearer ${await createToken("admin-001", "system_admin")}`,
    },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().healthy, true);
  assert.equal(response.json().configured, true);

  await app.close();
});

test("GET /v1/projects/:id/ai/provider-telemetry aggregates provider job metrics", async () => {
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
    quotaLineRepository: new InMemoryQuotaLineRepository([]),
    auditLogRepository: new InMemoryAuditLogRepository([]),
    aiRecommendationRepository: new InMemoryAiRecommendationRepository([]),
    backgroundJobRepository: new InMemoryBackgroundJobRepository([
      {
        id: "background-job-003",
        jobType: "ai_recommendation",
        status: "completed",
        requestedBy: "engineer-001",
        projectId: "project-001",
        payload: {
          projectId: "project-001",
          recommendationType: "bill_recommendation",
          provider: "openai_compatible",
          model: "cost-model-v1",
        },
        result: {
          provider: { provider: "openai_compatible", model: "cost-model-v1" },
          telemetry: { durationMs: 4000, retryCount: 1 },
        },
        errorMessage: null,
        createdAt: "2026-04-20T09:00:00.000Z",
        completedAt: "2026-04-20T09:00:04.000Z",
      },
      {
        id: "background-job-002",
        jobType: "ai_recommendation",
        status: "failed",
        requestedBy: "engineer-001",
        projectId: "project-001",
        payload: {
          projectId: "project-001",
          recommendationType: "bill_recommendation",
          provider: "openai_compatible",
          model: "cost-model-v1",
        },
        result: {
          providerFailureSummary: {
            provider: "openai_compatible",
            model: "cost-model-v1",
            durationMs: 12000,
            retryCount: 2,
          },
        },
        errorMessage: "AI provider failed",
        createdAt: "2026-04-20T10:00:00.000Z",
        completedAt: "2026-04-20T10:00:12.000Z",
      },
      {
        id: "background-job-001",
        jobType: "ai_recommendation",
        status: "failed",
        requestedBy: "engineer-001",
        projectId: "project-001",
        payload: {
          projectId: "project-001",
          recommendationType: "bill_recommendation",
          provider: "deepseek",
          model: "deepseek-chat",
        },
        result: {
          providerFailureSummary: {
            provider: "deepseek",
            model: "deepseek-chat",
            durationMs: 16000,
            retryCount: 0,
          },
        },
        errorMessage: "AI provider failed",
        createdAt: "2026-04-20T11:00:00.000Z",
        completedAt: "2026-04-20T11:00:16.000Z",
      },
    ]),
  });

  const response = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/ai/provider-telemetry",
    headers: {
      authorization: `Bearer ${await createToken("engineer-001", "cost_engineer")}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().totalCount, 3);
  assert.equal(response.json().successCount, 1);
  assert.equal(response.json().failureCount, 2);
  assert.equal(response.json().averageDurationMs, 10667);
  assert.equal(response.json().p95DurationMs, 16000);
  assert.equal(response.json().maxRetryCount, 2);
  assert.equal(response.json().consecutiveFailureCount, 2);
  assert.equal(response.json().groups.length, 2);
  assert.ok(
    response.json().alerts.includes("运维告警：Provider 已连续失败 2 次。"),
  );
  assert.ok(
    response.json().alerts.includes(
      "运维告警：Provider P95 耗时 16000ms，已超过 10000ms。",
    ),
  );

  const forbiddenResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/ai/provider-telemetry",
    headers: {
      authorization: `Bearer ${await createToken("outsider-001", "cost_engineer")}`,
    },
  });
  assert.equal(forbiddenResponse.statusCode, 403);

  const adminResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/ai/provider-telemetry?limit=2",
    headers: {
      authorization: `Bearer ${await createToken("admin-001", "system_admin")}`,
    },
  });
  assert.equal(adminResponse.statusCode, 200);
  assert.equal(adminResponse.json().totalCount, 2);

  await app.close();
});

test("GET /v1/ai/recommendations/rollback-blocked-reasons documents enum values", async () => {
  const app = createRecommendationApp();
  const response = await app.inject({
    method: "GET",
    url: "/v1/ai/recommendations/rollback-blocked-reasons",
    headers: {
      authorization: `Bearer ${await createToken("engineer-001", "cost_engineer")}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().items, [
    { reason: "resource_missing", label: "业务资源已缺失" },
    { reason: "resource_modified", label: "业务资源已被修改" },
    { reason: "resource_has_children", label: "清单下存在子清单" },
    { reason: "resource_has_quota_lines", label: "清单下存在定额行" },
  ]);

  await app.close();
});

test("GET /v1/projects/:id/ai/recommendation-context builds bill, quota, and variance inputs", async () => {
  const app = createRecommendationApp({
    billItems: [
      {
        ...billItems[0],
        systemAmount: 100,
        finalAmount: 140,
      },
    ],
  });
  const token = await createToken("engineer-001", "cost_engineer");

  const billContextResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/ai/recommendation-context?recommendationType=bill_recommendation&resourceType=bill_version&resourceId=bill-version-001&stageCode=estimate&disciplineCode=building",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(billContextResponse.statusCode, 200);
  assert.equal(billContextResponse.json().currentVersion.id, "bill-version-001");
  assert.equal(billContextResponse.json().currentItems.length, 1);

  const quotaContextResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/ai/recommendation-context?recommendationType=quota_recommendation&resourceType=bill_item&resourceId=bill-item-001&stageCode=estimate&disciplineCode=building",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(quotaContextResponse.statusCode, 200);
  assert.equal(quotaContextResponse.json().billItem.id, "bill-item-001");
  assert.ok(Array.isArray(quotaContextResponse.json().quotaCandidates));

  const varianceContextResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/ai/recommendation-context?recommendationType=variance_warning&billVersionId=bill-version-001&stageCode=estimate&disciplineCode=building",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(varianceContextResponse.statusCode, 200);
  assert.equal(varianceContextResponse.json().thresholdScope, "default");
  assert.equal(varianceContextResponse.json().summaryDetails.items.length, 1);

  await app.close();
});

test("variance warning thresholds can be configured per stage and discipline", async () => {
  const app = createRecommendationApp({
    billItems: [
      {
        ...billItems[0],
        systemAmount: 100,
        finalAmount: 112,
      },
    ],
  });
  const token = await createToken("engineer-001", "cost_engineer");

  const thresholdResponse = await app.inject({
    method: "PUT",
    url: "/v1/projects/project-001/ai/variance-warning-thresholds",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      stageCode: "estimate",
      disciplineCode: "building",
      thresholdAmount: 10,
      thresholdRate: 0.1,
    },
  });
  assert.equal(thresholdResponse.statusCode, 200);
  assert.equal(thresholdResponse.json().stageCode, "estimate");
  assert.equal(thresholdResponse.json().disciplineCode, "building");

  const response = await app.inject({
    method: "POST",
    url: "/v1/ai/variance-warnings",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      projectId: "project-001",
      stageCode: "estimate",
      disciplineCode: "building",
      billVersionId: "bill-version-001",
    },
  });
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().items[0].inputPayload.thresholdScope, "stage_discipline");

  const listResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/ai/variance-warning-thresholds?stageCode=estimate&disciplineCode=building",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.json().items.length, 1);

  await app.close();
});

test("quota context changes automatically expire stale quota recommendations", async () => {
  const app = createRecommendationApp();
  const token = await createToken("engineer-001", "cost_engineer");

  const recommendationResponse = await app.inject({
    method: "POST",
    url: "/v1/ai/quota-recommendations",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      projectId: "project-001",
      stageCode: "estimate",
      disciplineCode: "building",
      resourceType: "bill_item",
      resourceId: "bill-item-001",
      outputPayload: {
        quotaName: "挖土方",
      },
    },
  });
  assert.equal(recommendationResponse.statusCode, 201);

  const createQuotaLineResponse = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/bill-versions/bill-version-001/items/bill-item-001/quota-lines",
    headers: { authorization: `Bearer ${token}` },
    payload: {
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
      sourceMode: "manual",
    },
  });
  assert.equal(createQuotaLineResponse.statusCode, 201);

  const expiredResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/ai/quota-recommendations?status=expired",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(expiredResponse.statusCode, 200);
  assert.equal(expiredResponse.json().items.length, 1);
  assert.equal(expiredResponse.json().items[0].statusReason, "quota_context_changed");

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
  assert.deepEqual(acceptResponse.json().outputPayload.acceptedChanges[0], {
    action: "create",
    resourceType: "bill_item",
    resourceId: "bill-item-002",
    label: "A-002 回填土",
    snapshot: {
      id: "bill-item-002",
      billVersionId: "bill-version-001",
      parentId: null,
      itemCode: "A-002",
      itemName: "回填土",
      quantity: 6,
      unit: "m3",
      sortNo: 2,
    },
    rollbackSupported: true,
  });

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

  const rollbackResponse = await app.inject({
    method: "POST",
    url: `/v1/ai/recommendations/${createdResponse.json().id}/rollback`,
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      reason: "撤销新增清单",
    },
  });
  assert.equal(rollbackResponse.statusCode, 200);
  assert.equal(rollbackResponse.json().status, "rolled_back");
  assert.equal(
    rollbackResponse.json().outputPayload.rollback.changes[0].resourceId,
    "bill-item-002",
  );

  const rollbackBillItemsResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/bill-versions/bill-version-001/items",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  assert.equal(rollbackBillItemsResponse.statusCode, 200);
  assert.equal(rollbackBillItemsResponse.json().items.length, 1);

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

  const rollbackResponse = await app.inject({
    method: "POST",
    url: `/v1/ai/recommendations/${createdResponse.json().id}/rollback`,
    headers: {
      authorization: `Bearer ${engineerToken}`,
    },
    payload: {
      reason: "撤销套用",
    },
  });
  assert.equal(rollbackResponse.statusCode, 200);
  assert.equal(rollbackResponse.json().status, "rolled_back");
  assert.equal(
    rollbackResponse.json().outputPayload.rollback.changes[0].resourceType,
    "quota_line",
  );

  const rollbackQuotaLineResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/bill-versions/bill-version-001/items/bill-item-001/quota-lines",
    headers: {
      authorization: `Bearer ${engineerToken}`,
    },
  });
  assert.equal(rollbackQuotaLineResponse.statusCode, 200);
  assert.equal(rollbackQuotaLineResponse.json().items.length, 0);

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

test("POST /v1/ai/recommendations/:id/rollback blocks modified accepted resources", async () => {
  const app = createRecommendationApp();
  const token = await createToken("engineer-001", "cost_engineer");

  const createdResponse = await app.inject({
    method: "POST",
    url: "/v1/ai/bill-recommendations",
    headers: { authorization: `Bearer ${token}` },
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
      },
    },
  });
  assert.equal(createdResponse.statusCode, 201);

  const acceptResponse = await app.inject({
    method: "POST",
    url: `/v1/ai/recommendations/${createdResponse.json().id}/accept`,
    headers: { authorization: `Bearer ${token}` },
    payload: { reason: "确认新增清单" },
  });
  assert.equal(acceptResponse.statusCode, 200);
  const acceptedBillItemId = acceptResponse.json().outputPayload.acceptedBillItemId;

  const updateResponse = await app.inject({
    method: "PUT",
    url: `/v1/projects/project-001/bill-versions/bill-version-001/items/${acceptedBillItemId}`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      parentId: null,
      itemCode: "A-002",
      itemName: "人工改名",
      quantity: 6,
      unit: "m3",
      sortNo: 2,
    },
  });
  assert.equal(updateResponse.statusCode, 200);

  const rollbackResponse = await app.inject({
    method: "POST",
    url: `/v1/ai/recommendations/${createdResponse.json().id}/rollback`,
    headers: { authorization: `Bearer ${token}` },
    payload: { reason: "撤销新增清单" },
  });
  assert.equal(rollbackResponse.statusCode, 409);
  assert.equal(
    rollbackResponse.json().error.code,
    "AI_RECOMMENDATION_ROLLBACK_BLOCKED",
  );
  assert.equal(rollbackResponse.json().error.details.reason, "resource_modified");

  await app.close();
});
