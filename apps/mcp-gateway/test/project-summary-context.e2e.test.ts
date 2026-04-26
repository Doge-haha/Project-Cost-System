import test from "node:test";
import assert from "node:assert/strict";

import {
  InMemoryBillItemRepository,
  type BillItemRecord,
} from "../../api/src/modules/bill/bill-item-repository.js";
import {
  InMemoryBillVersionRepository,
  type BillVersionRecord,
} from "../../api/src/modules/bill/bill-version-repository.js";
import {
  InMemoryBackgroundJobRepository,
  type BackgroundJobRecord,
} from "../../api/src/modules/jobs/background-job-repository.js";
import {
  InMemoryKnowledgeEntryRepository,
  type KnowledgeEntryRecord,
} from "../../api/src/modules/knowledge/knowledge-entry-repository.js";
import { createGatewayTestApp } from "./helpers/http-gateway-harness.js";
import {
  createGatewayTestApiApp,
  createGatewayTestToken,
} from "./helpers/project-seeds.js";

const seededBillVersions: BillVersionRecord[] = [
  {
    id: "bill-version-001",
    projectId: "project-001",
    stageCode: "estimate",
    disciplineCode: "building",
    versionNo: 1,
    versionName: "估算版 V1",
    versionStatus: "submitted",
    sourceVersionId: null,
  },
];

const seededBillItems: BillItemRecord[] = [
  {
    id: "bill-item-001",
    billVersionId: "bill-version-001",
    parentId: null,
    itemCode: "010101001",
    itemName: "土方工程",
    quantity: 10,
    unit: "m3",
    sortNo: 1,
    systemUnitPrice: 100,
    manualUnitPrice: null,
    finalUnitPrice: 110,
    systemAmount: 1000,
    finalAmount: 1100,
    calculatedAt: "2026-04-24T09:00:00.000Z",
  },
  {
    id: "bill-item-002",
    billVersionId: "bill-version-001",
    parentId: null,
    itemCode: "010102001",
    itemName: "基础工程",
    quantity: 5,
    unit: "m3",
    sortNo: 2,
    systemUnitPrice: 200,
    manualUnitPrice: null,
    finalUnitPrice: 180,
    systemAmount: 1000,
    finalAmount: 900,
    calculatedAt: "2026-04-24T09:10:00.000Z",
  },
];

const seededBackgroundJobs: BackgroundJobRecord[] = [
  {
    id: "background-job-001",
    jobType: "knowledge_extraction",
    status: "completed",
    requestedBy: "user-001",
    projectId: "project-001",
    payload: {
      projectId: "project-001",
      source: "audit_logs",
      sourceLabel: "审计日志",
      events: [],
    },
    result: {
      knowledgeCount: 1,
    },
    errorMessage: null,
    createdAt: "2026-04-24T10:00:00.000Z",
    completedAt: "2026-04-24T10:01:00.000Z",
  },
  {
    id: "background-job-002",
    jobType: "project_recalculate",
    status: "queued",
    requestedBy: "user-001",
    projectId: "project-001",
    payload: {
      projectId: "project-001",
      stageCode: "estimate",
      disciplineCode: "building",
      priceVersionId: null,
      feeTemplateId: null,
      roleCodes: ["owner"],
    },
    result: null,
    errorMessage: null,
    createdAt: "2026-04-24T09:00:00.000Z",
    completedAt: null,
  },
];

const seededKnowledgeEntries: KnowledgeEntryRecord[] = [
  {
    id: "knowledge-entry-001",
    projectId: "project-001",
    stageCode: "estimate",
    sourceJobId: "background-job-001",
    sourceType: "audit_log",
    sourceAction: "bill_item.update",
    title: "土方工程价格调整",
    summary: "土方工程最终价高于系统价。",
    tags: ["pricing", "variance"],
    metadata: {
      billItemId: "bill-item-001",
    },
    createdAt: "2026-04-24T10:02:00.000Z",
  },
];

test("project summary, summary details and context stay aligned over HTTP", async () => {
  const apiApp = createGatewayTestApiApp({
    appOptions: {
      billVersionRepository: new InMemoryBillVersionRepository(seededBillVersions),
      billItemRepository: new InMemoryBillItemRepository(seededBillItems),
      backgroundJobRepository: new InMemoryBackgroundJobRepository(
        seededBackgroundJobs,
      ),
      knowledgeEntryRepository: new InMemoryKnowledgeEntryRepository(
        seededKnowledgeEntries,
      ),
    },
  });

  const gatewayApp = createGatewayTestApp(apiApp);
  const token = await createGatewayTestToken();

  try {
    const summaryResponse = await gatewayApp.inject({
      method: "GET",
      url: "/v1/resources/project-summary?projectId=project-001&billVersionId=bill-version-001&stageCode=estimate&disciplineCode=building",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(summaryResponse.statusCode, 200);
    assert.deepEqual(summaryResponse.json(), {
      type: "resource",
      resourceType: "project_summary",
      scope: {
        projectId: "project-001",
        stageCode: "estimate",
        disciplineCode: "building",
      },
      data: {
        projectId: "project-001",
        billVersionId: "bill-version-001",
        stageCode: "estimate",
        disciplineCode: "building",
        unitCode: null,
        versionCount: 1,
        itemCount: 2,
        totalSystemAmount: 2000,
        totalFinalAmount: 2000,
        varianceAmount: 0,
        varianceRate: 0,
      },
    });

    const detailsResponse = await gatewayApp.inject({
      method: "GET",
      url: "/v1/resources/summary-details?projectId=project-001&billVersionId=bill-version-001&limit=1",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(detailsResponse.statusCode, 200);
    assert.deepEqual(detailsResponse.json(), {
      type: "resource",
      resourceType: "summary_details",
      scope: {
        projectId: "project-001",
        billVersionId: "bill-version-001",
        stageCode: null,
        disciplineCode: null,
      },
      data: {
        projectId: "project-001",
        billVersionId: "bill-version-001",
        stageCode: null,
        disciplineCode: null,
        unitCode: null,
        totalCount: 2,
        items: [
          {
            billVersionId: "bill-version-001",
            versionName: "估算版 V1",
            versionNo: 1,
            stageCode: "estimate",
            disciplineCode: "building",
            itemId: "bill-item-001",
            itemCode: "010101001",
            itemName: "土方工程",
            systemAmount: 1000,
            finalAmount: 1100,
            varianceAmount: 100,
            varianceRate: 0.1,
            varianceShare: 0.5,
          },
        ],
      },
    });

    const contextResponse = await gatewayApp.inject({
      method: "GET",
      url: "/v1/resources/project-context?projectId=project-001&stageCode=estimate&disciplineCode=building&jobsLimit=2",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(contextResponse.statusCode, 200);
    assert.deepEqual(contextResponse.json(), {
      type: "resource",
      resourceType: "project_context",
      scope: {
        projectId: "project-001",
        stageCode: "estimate",
        disciplineCode: "building",
        jobId: null,
      },
      data: {
        projectSummary: {
          projectId: "project-001",
          billVersionId: null,
          stageCode: "estimate",
          disciplineCode: "building",
          unitCode: null,
          versionCount: 1,
          itemCount: 2,
          totalSystemAmount: 2000,
          totalFinalAmount: 2000,
          varianceAmount: 0,
          varianceRate: 0,
        },
        jobsSummary: {
          items: seededBackgroundJobs,
          summary: {
            totalCount: 2,
            statusCounts: {
              queued: 1,
              processing: 0,
              completed: 1,
              failed: 0,
            },
            jobTypeCounts: {
              report_export: 0,
              project_recalculate: 1,
              knowledge_extraction: 1,
            },
          },
        },
        jobStatus: null,
        latestKnowledgeExtractionJob: seededBackgroundJobs[0],
        latestKnowledgeSummary: {
          totalCount: 1,
          sourceTypeCounts: {
            audit_log: 1,
          },
          sourceActionCounts: {
            "bill_item.update": 1,
          },
          stageCounts: {
            estimate: 1,
          },
        },
        latestKnowledgeEntries: seededKnowledgeEntries,
      },
    });
  } finally {
    await gatewayApp.close();
    await apiApp.close();
  }
});
