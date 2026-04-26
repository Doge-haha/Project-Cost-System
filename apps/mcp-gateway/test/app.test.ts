import test from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";

import { RESOURCE_DEFINITIONS, TOOL_DEFINITIONS } from "../src/app/capabilities.js";
import { createGatewayApp } from "../src/main.js";

const jwtSecret = "mcp-gateway-test-secret";

async function signAccessToken(payload: {
  sub: string;
  displayName: string;
  roleCodes: string[];
}): Promise<string> {
  return new SignJWT({
    displayName: payload.displayName,
    roleCodes: payload.roleCodes,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(jwtSecret));
}

test("GET /health stays public on mcp-gateway", async () => {
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
  });

  const response = await app.inject({
    method: "GET",
    url: "/health",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ok: true });

  await app.close();
});

test("GET /v1/capabilities exposes resource and tool definitions", async () => {
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
  });

  const response = await app.inject({
    method: "GET",
    url: "/v1/capabilities",
  });

  assert.equal(response.statusCode, 401);

  const token = await signAccessToken({
    sub: "engineer-001",
    displayName: "Cost Engineer",
    roleCodes: ["cost_engineer"],
  });
  const authedResponse = await app.inject({
    method: "GET",
    url: "/v1/capabilities",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(authedResponse.statusCode, 200);
  assert.deepEqual(authedResponse.json(), {
    type: "capabilities",
    resources: [
      {
        name: "project-summary",
        uri: "/v1/resources/project-summary",
        mode: "read",
        description: "Aggregate pricing summary for a project scope",
        parameters: ["projectId", "billVersionId?", "stageCode?", "disciplineCode?"],
      },
      {
        name: "summary-details",
        uri: "/v1/resources/summary-details",
        mode: "read",
        description: "Detailed variance breakdown for a project scope",
        parameters: [
          "projectId",
          "billVersionId?",
          "stageCode?",
          "disciplineCode?",
          "limit?",
        ],
      },
      {
        name: "jobs-summary",
        uri: "/v1/resources/jobs-summary",
        mode: "read",
        description: "Background job list and status summary",
        parameters: ["projectId?", "requestedBy?", "jobType?", "status?", "limit?"],
      },
      {
        name: "project-context",
        uri: "/v1/resources/project-context",
        mode: "read",
        description:
          "Combined project summary, jobs summary, knowledge summary, and optional job snapshot",
        parameters: [
          "projectId",
          "billVersionId?",
          "stageCode?",
          "disciplineCode?",
          "jobsRequestedBy?",
          "jobsStatus?",
          "jobsLimit?",
          "jobId?",
        ],
      },
      {
        name: "job-status",
        uri: "/v1/resources/job-status",
        mode: "read",
        description: "Single background job status snapshot",
        parameters: ["jobId"],
      },
      {
        name: "knowledge-extraction-result",
        uri: "/v1/resources/knowledge-extraction-result",
        mode: "read",
        description: "Knowledge extraction job result snapshot",
        parameters: ["jobId"],
      },
      {
        name: "knowledge-extraction-history",
        uri: "/v1/resources/knowledge-extraction-history",
        mode: "read",
        description: "Recent knowledge extraction jobs for a project",
        parameters: ["projectId", "requestedBy?", "status?", "limit?"],
      },
      {
        name: "review-summary",
        uri: "/v1/resources/review-summary",
        mode: "read",
        description: "Review submissions list and action summary",
        parameters: [
          "projectId",
          "billVersionId?",
          "stageCode?",
          "disciplineCode?",
          "status?",
        ],
      },
      {
        name: "process-document-summary",
        uri: "/v1/resources/process-document-summary",
        mode: "read",
        description: "Process document list and status summary",
        parameters: [
          "projectId",
          "stageCode?",
          "disciplineCode?",
          "documentType?",
          "status?",
        ],
      },
      {
        name: "report-export-status",
        uri: "/v1/resources/report-export-status",
        mode: "read",
        description: "Report export task status and download readiness",
        parameters: ["taskId"],
      },
      {
        name: "import-failure-context",
        uri: "/v1/resources/import-failure-context",
        mode: "read",
        description: "Current import failure scope, filtered failed items, and retry-snapshot readiness",
        parameters: [
          "projectId",
          "importTaskId?",
          "failureReason?",
          "failureResourceType?",
          "failureAction?",
        ],
      },
    ],
    tools: [
      {
        name: "recalculate-project",
        uri: "/v1/tools/recalculate-project",
        mode: "invoke",
        description: "Queue recalculation for a project scope",
        parameters: [
          "projectId",
          "stageCode?",
          "disciplineCode?",
          "priceVersionId?",
          "feeTemplateId?",
        ],
      },
      {
        name: "export-summary-report",
        uri: "/v1/tools/export-summary-report",
        mode: "invoke",
        description: "Queue an export task for summary or variance report output",
        parameters: ["projectId", "reportType", "stageCode?", "disciplineCode?"],
      },
      {
        name: "extract-knowledge",
        uri: "/v1/tools/extract-knowledge",
        mode: "invoke",
        description: "Queue AI knowledge extraction for structured project events",
        parameters: ["projectId", "source", "events"],
      },
      {
        name: "preview-knowledge-extraction",
        uri: "/v1/tools/preview-knowledge-extraction",
        mode: "invoke",
        description:
          "Run synchronous AI knowledge extraction preview for structured project events",
        parameters: ["source", "events"],
      },
      {
        name: "extract-knowledge-from-audit",
        uri: "/v1/tools/extract-knowledge-from-audit",
        mode: "invoke",
        description: "Queue AI knowledge extraction from project audit logs",
        parameters: [
          "projectId",
          "source?",
          "resourceType?",
          "resourceId?",
          "resourceIdPrefix?",
          "action?",
          "operatorId?",
          "createdFrom?",
          "createdTo?",
          "limit?",
        ],
      },
      {
        name: "retry-import-failure-scope",
        uri: "/v1/tools/retry-import-failure-scope",
        mode: "invoke",
        description: "Retry a failed knowledge-extraction job for the current import failure scope",
        parameters: ["jobId", "failureReason?", "failureResourceType?", "failureAction?"],
      },
      {
        name: "decide-review",
        uri: "/v1/tools/decide-review",
        mode: "invoke",
        description: "Approve, reject, or cancel a review submission",
        parameters: ["projectId", "reviewSubmissionId", "action", "comment?", "reason?"],
      },
      {
        name: "update-process-document-status",
        uri: "/v1/tools/update-process-document-status",
        mode: "invoke",
        description: "Submit, approve, or reject a process document",
        parameters: ["projectId", "documentId", "status", "comment?"],
      },
    ],
  });

  await app.close();
});

test("capability URIs are backed by gateway routes", async () => {
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
  });
  const token = await signAccessToken({
    sub: "engineer-001",
    displayName: "Cost Engineer",
    roleCodes: ["cost_engineer"],
  });

  try {
    for (const resource of RESOURCE_DEFINITIONS) {
      const response = await app.inject({
        method: "GET",
        url: resource.uri,
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      assert.notEqual(response.statusCode, 404, resource.uri);
      assert.notEqual(response.statusCode, 405, resource.uri);
    }

    for (const tool of TOOL_DEFINITIONS) {
      const response = await app.inject({
        method: "POST",
        url: tool.uri,
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {},
      });

      assert.notEqual(response.statusCode, 404, tool.uri);
      assert.notEqual(response.statusCode, 405, tool.uri);
    }
  } finally {
    await app.close();
  }
});

test("GET /v1/resources/project-summary requires bearer token", async () => {
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
  });

  const response = await app.inject({
    method: "GET",
    url: "/v1/resources/project-summary?projectId=project-001",
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, "UNAUTHENTICATED");

  await app.close();
});

test("GET /v1/resources/project-summary proxies summary data from api", async () => {
  const requests: Array<{ token: string; projectId: string }> = [];
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
    apiClient: {
      fetchProjectSummary: async (query, bearerToken) => {
        requests.push({
          token: bearerToken,
          projectId: query.projectId,
        });
        return {
          totalFinalAmount: 3210,
          varianceAmount: 210,
        };
      },
    } as never,
  });
  const token = await signAccessToken({
    sub: "engineer-001",
    displayName: "Cost Engineer",
    roleCodes: ["cost_engineer"],
  });

  const response = await app.inject({
    method: "GET",
    url: "/v1/resources/project-summary?projectId=project-001&stageCode=estimate&disciplineCode=building",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    type: "resource",
    resourceType: "project_summary",
    scope: {
      projectId: "project-001",
      stageCode: "estimate",
      disciplineCode: "building",
    },
    data: {
      totalFinalAmount: 3210,
      varianceAmount: 210,
    },
  });
  assert.deepEqual(requests, [
    {
      token,
      projectId: "project-001",
    },
  ]);

  await app.close();
});

test("GET /v1/resources/jobs-summary proxies job summary data from api", async () => {
  const requests: Array<{
    token: string;
    projectId: string | undefined;
    jobType: string | undefined;
  }> = [];
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
    apiClient: {
      fetchProjectSummary: async () => {
        throw new Error("unexpected project summary call");
      },
      fetchJobsSummary: async (query, bearerToken) => {
        requests.push({
          token: bearerToken,
          projectId: query.projectId,
          jobType: query.jobType,
        });
        return {
          items: [],
          summary: {
            totalCount: 2,
            statusCounts: {
              queued: 1,
              processing: 0,
              completed: 1,
              failed: 0,
            },
          },
        };
      },
    } as never,
  });
  const token = await signAccessToken({
    sub: "engineer-001",
    displayName: "Cost Engineer",
    roleCodes: ["cost_engineer"],
  });

  const response = await app.inject({
    method: "GET",
    url: "/v1/resources/jobs-summary?projectId=project-001&jobType=knowledge_extraction&status=completed&limit=10",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    type: "resource",
    resourceType: "jobs_summary",
    scope: {
      projectId: "project-001",
      requestedBy: null,
      jobType: "knowledge_extraction",
      status: "completed",
    },
    data: {
      items: [],
      summary: {
        totalCount: 2,
        statusCounts: {
          queued: 1,
          processing: 0,
          completed: 1,
          failed: 0,
        },
      },
    },
  });
  assert.deepEqual(requests, [
    {
      token,
      projectId: "project-001",
      jobType: "knowledge_extraction",
    },
  ]);

  await app.close();
});

test("GET /v1/resources/project-context aggregates project and job summaries", async () => {
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
    apiClient: {
      fetchProjectSummary: async () => ({
        totalFinalAmount: 3210,
      }),
      fetchJobsSummary: async (query) =>
        query.jobType === "knowledge_extraction"
          ? {
              items: [
                {
                  id: "background-job-knowledge-001",
                  jobType: "knowledge_extraction",
                  status: "completed",
                },
              ],
              summary: {
                totalCount: 1,
              },
            }
          : {
              items: [],
              summary: {
                totalCount: 1,
              },
            },
      fetchKnowledgeEntries: async () => ({
        items: [
          {
            id: "knowledge-entry-001",
            title: "review_reject",
          },
        ],
        summary: {
          totalCount: 1,
          sourceTypeCounts: {
            review_submission: 1,
          },
          sourceActionCounts: {
            reject: 1,
          },
          stageCounts: {
            estimate: 1,
          },
        },
      }),
    } as never,
  });
  const token = await signAccessToken({
    sub: "engineer-001",
    displayName: "Cost Engineer",
    roleCodes: ["cost_engineer"],
  });

  const response = await app.inject({
    method: "GET",
    url: "/v1/resources/project-context?projectId=project-001&stageCode=estimate&disciplineCode=building&jobsStatus=queued&jobsLimit=5",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
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
        totalFinalAmount: 3210,
      },
      jobsSummary: {
        items: [],
        summary: {
          totalCount: 1,
        },
      },
      jobStatus: null,
      latestKnowledgeExtractionJob: {
        id: "background-job-knowledge-001",
        jobType: "knowledge_extraction",
        status: "completed",
      },
      latestKnowledgeSummary: {
        totalCount: 1,
        sourceTypeCounts: {
          review_submission: 1,
        },
        sourceActionCounts: {
          reject: 1,
        },
        stageCounts: {
          estimate: 1,
        },
      },
      latestKnowledgeEntries: [
        {
          id: "knowledge-entry-001",
          title: "review_reject",
        },
      ],
    },
  });

  await app.close();
});

test("GET /v1/resources/project-context includes optional job status snapshot", async () => {
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
    apiClient: {
      fetchProjectSummary: async () => ({
        totalFinalAmount: 3210,
      }),
      fetchJobsSummary: async (query) =>
        query.jobType === "knowledge_extraction"
          ? {
              items: [],
              summary: {
                totalCount: 0,
              },
            }
          : {
              items: [],
              summary: {
                totalCount: 1,
              },
            },
      fetchJobStatus: async () => ({
        id: "background-job-001",
        status: "processing",
      }),
      fetchKnowledgeEntries: async () => ({
        items: [],
        summary: {
          totalCount: 0,
          sourceTypeCounts: {},
          sourceActionCounts: {},
          stageCounts: {},
        },
      }),
    } as never,
  });
  const token = await signAccessToken({
    sub: "engineer-001",
    displayName: "Cost Engineer",
    roleCodes: ["cost_engineer"],
  });

  const response = await app.inject({
    method: "GET",
    url: "/v1/resources/project-context?projectId=project-001&jobId=background-job-001",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    type: "resource",
    resourceType: "project_context",
    scope: {
      projectId: "project-001",
      stageCode: null,
      disciplineCode: null,
      jobId: "background-job-001",
    },
    data: {
      projectSummary: {
        totalFinalAmount: 3210,
      },
      jobsSummary: {
        items: [],
        summary: {
          totalCount: 1,
        },
      },
      jobStatus: {
        id: "background-job-001",
        status: "processing",
      },
      latestKnowledgeExtractionJob: null,
      latestKnowledgeSummary: {
        totalCount: 0,
        sourceTypeCounts: {},
        sourceActionCounts: {},
        stageCounts: {},
      },
      latestKnowledgeEntries: [],
    },
  });

  await app.close();
});

test("GET /v1/resources/summary-details proxies summary detail data from api", async () => {
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
    apiClient: {
      fetchProjectSummary: async () => {
        throw new Error("unexpected project summary call");
      },
      fetchJobsSummary: async () => {
        throw new Error("unexpected jobs summary call");
      },
      fetchSummaryDetails: async () => ({
        items: [{ itemId: "bill-item-001", varianceAmount: 123 }],
      }),
    } as never,
  });
  const token = await signAccessToken({
    sub: "engineer-001",
    displayName: "Cost Engineer",
    roleCodes: ["cost_engineer"],
  });

  const response = await app.inject({
    method: "GET",
    url: "/v1/resources/summary-details?projectId=project-001&billVersionId=bill-version-001&limit=5",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    type: "resource",
    resourceType: "summary_details",
    scope: {
      projectId: "project-001",
      billVersionId: "bill-version-001",
      stageCode: null,
      disciplineCode: null,
    },
    data: {
      items: [{ itemId: "bill-item-001", varianceAmount: 123 }],
    },
  });

  await app.close();
});

test("POST /v1/tools/recalculate-project proxies recalculation for allowed roles", async () => {
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
    apiClient: {
      recalculateProject: async () => ({
        jobId: "background-job-001",
        status: "queued",
      }),
    } as never,
  });
  const token = await signAccessToken({
    sub: "engineer-001",
    displayName: "Cost Engineer",
    roleCodes: ["cost_engineer"],
  });

  const response = await app.inject({
    method: "POST",
    url: "/v1/tools/recalculate-project",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      projectId: "project-001",
      stageCode: "estimate",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    type: "tool_result",
    tool: "recalculate_project",
    mode: "accepted",
    target: {
      projectId: "project-001",
    },
    result: {
      jobId: "background-job-001",
      status: "queued",
    },
    execution: {
      kind: "async_job",
      jobId: "background-job-001",
      statusResource: {
        resourceType: "job_status",
        query: {
          jobId: "background-job-001",
        },
      },
    },
    related: null,
  });

  await app.close();
});

test("POST /v1/tools/recalculate-project rejects disallowed roles", async () => {
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
  });
  const token = await signAccessToken({
    sub: "reviewer-001",
    displayName: "Reviewer",
    roleCodes: ["reviewer"],
  });

  const response = await app.inject({
    method: "POST",
    url: "/v1/tools/recalculate-project",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      projectId: "project-001",
    },
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error.code, "FORBIDDEN");

  await app.close();
});

test("GET /v1/resources/job-status proxies background job status from api", async () => {
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
    apiClient: {
      fetchJobStatus: async () => ({
        id: "background-job-001",
        status: "completed",
        result: {
          exported: true,
        },
      }),
    } as never,
  });
  const token = await signAccessToken({
    sub: "engineer-001",
    displayName: "Cost Engineer",
    roleCodes: ["cost_engineer"],
  });

  const response = await app.inject({
    method: "GET",
    url: "/v1/resources/job-status?jobId=background-job-001",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    type: "resource",
    resourceType: "job_status",
    scope: {
      jobId: "background-job-001",
    },
    data: {
      id: "background-job-001",
      status: "completed",
      result: {
        exported: true,
      },
    },
  });

  await app.close();
});

test("GET /v1/resources/knowledge-extraction-result proxies structured extraction job result", async () => {
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
    apiClient: {
      fetchJobStatus: async () => ({
        id: "background-job-knowledge-001",
        jobType: "knowledge_extraction",
        status: "completed",
        result: {
          runtime: "saas-pricing-ai-runtime:knowledge-memory-agent-runtime",
          source: "review_submission",
          result: {
            summary: {
              knowledgeCount: 1,
              memoryCount: 1,
            },
          },
        },
      }),
    } as never,
  });
  const token = await signAccessToken({
    sub: "engineer-001",
    displayName: "Cost Engineer",
    roleCodes: ["cost_engineer"],
  });

  const response = await app.inject({
    method: "GET",
    url: "/v1/resources/knowledge-extraction-result?jobId=background-job-knowledge-001",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    type: "resource",
    resourceType: "knowledge_extraction_result",
    scope: {
      jobId: "background-job-knowledge-001",
    },
    data: {
      id: "background-job-knowledge-001",
      jobType: "knowledge_extraction",
      status: "completed",
      result: {
        runtime: "saas-pricing-ai-runtime:knowledge-memory-agent-runtime",
        source: "review_submission",
        result: {
          summary: {
            knowledgeCount: 1,
            memoryCount: 1,
          },
        },
      },
    },
  });

  await app.close();
});

test("GET /v1/resources/knowledge-extraction-result rejects non knowledge jobs", async () => {
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
    apiClient: {
      fetchJobStatus: async () => ({
        id: "background-job-002",
        jobType: "report_export",
        status: "completed",
      }),
    } as never,
  });
  const token = await signAccessToken({
    sub: "engineer-001",
    displayName: "Cost Engineer",
    roleCodes: ["cost_engineer"],
  });

  const response = await app.inject({
    method: "GET",
    url: "/v1/resources/knowledge-extraction-result?jobId=background-job-002",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 422);
  assert.equal(response.json().error.code, "INVALID_KNOWLEDGE_EXTRACTION_JOB");

  await app.close();
});

test("GET /v1/resources/knowledge-extraction-history proxies filtered knowledge jobs", async () => {
  const requests: Array<{
    token: string;
    projectId: string | undefined;
    requestedBy: string | undefined;
    jobType: string | undefined;
    status: string | undefined;
    limit: number | undefined;
  }> = [];
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
    apiClient: {
      fetchJobsSummary: async (query, bearerToken) => {
        requests.push({
          token: bearerToken,
          projectId: query.projectId,
          requestedBy: query.requestedBy,
          jobType: query.jobType,
          status: query.status,
          limit: query.limit,
        });
        return {
          items: [
            {
              id: "background-job-knowledge-001",
              jobType: "knowledge_extraction",
              status: "completed",
            },
          ],
          summary: {
            totalCount: 1,
          },
        };
      },
    } as never,
  });
  const token = await signAccessToken({
    sub: "owner-001",
    displayName: "Project Owner",
    roleCodes: ["project_owner"],
  });

  const response = await app.inject({
    method: "GET",
    url: "/v1/resources/knowledge-extraction-history?projectId=project-001&requestedBy=owner-001&status=completed&limit=5",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    type: "resource",
    resourceType: "knowledge_extraction_history",
    scope: {
      projectId: "project-001",
      requestedBy: "owner-001",
      status: "completed",
      limit: 5,
    },
    data: {
      items: [
        {
          id: "background-job-knowledge-001",
          jobType: "knowledge_extraction",
          status: "completed",
        },
      ],
      summary: {
        totalCount: 1,
      },
    },
  });
  assert.deepEqual(requests, [
    {
      token,
      projectId: "project-001",
      requestedBy: "owner-001",
      jobType: "knowledge_extraction",
      status: "completed",
      limit: 5,
    },
  ]);

  await app.close();
});

test("GET /v1/resources/review-summary proxies review list summary from api", async () => {
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
    apiClient: {
      fetchReviewSummary: async () => ({
        items: [],
        summary: {
          totalCount: 2,
          actionableCount: 1,
        },
      }),
    } as never,
  });
  const token = await signAccessToken({
    sub: "engineer-001",
    displayName: "Cost Engineer",
    roleCodes: ["cost_engineer"],
  });

  const response = await app.inject({
    method: "GET",
    url: "/v1/resources/review-summary?projectId=project-001&status=pending",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    type: "resource",
    resourceType: "review_summary",
    scope: {
      projectId: "project-001",
      billVersionId: null,
      stageCode: null,
      disciplineCode: null,
      status: "pending",
    },
    data: {
      items: [],
      summary: {
        totalCount: 2,
        actionableCount: 1,
      },
    },
  });

  await app.close();
});

test("GET /v1/resources/process-document-summary proxies process document summary from api", async () => {
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
    apiClient: {
      fetchProcessDocumentSummary: async () => ({
        items: [],
        summary: {
          totalCount: 3,
          statusCounts: {
            draft: 1,
            submitted: 2,
            approved: 0,
            rejected: 0,
          },
        },
      }),
    } as never,
  });
  const token = await signAccessToken({
    sub: "engineer-001",
    displayName: "Cost Engineer",
    roleCodes: ["cost_engineer"],
  });

  const response = await app.inject({
    method: "GET",
    url: "/v1/resources/process-document-summary?projectId=project-001&documentType=change_order",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    type: "resource",
    resourceType: "process_document_summary",
    scope: {
      projectId: "project-001",
      stageCode: null,
      disciplineCode: null,
      documentType: "change_order",
      status: null,
    },
    data: {
      items: [],
      summary: {
        totalCount: 3,
        statusCounts: {
          draft: 1,
          submitted: 2,
          approved: 0,
          rejected: 0,
        },
      },
    },
  });

  await app.close();
});

test("GET review and process-document summaries share the same gateway auth context", async () => {
  const requests: Array<{ kind: string; query: Record<string, unknown>; token: string }> = [];
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
    apiClient: {
      fetchReviewSummary: async (query, bearerToken) => {
        requests.push({ kind: "review", query, token: bearerToken });
        return {
          items: [],
          summary: {
            totalCount: 2,
            actionableCount: 1,
          },
        };
      },
      fetchProcessDocumentSummary: async (query, bearerToken) => {
        requests.push({ kind: "process", query, token: bearerToken });
        return {
          items: [],
          summary: {
            totalCount: 3,
            statusCounts: {
              draft: 1,
              submitted: 1,
              approved: 1,
              rejected: 0,
            },
          },
        };
      },
    } as never,
  });
  const token = await signAccessToken({
    sub: "engineer-001",
    displayName: "Cost Engineer",
    roleCodes: ["cost_engineer"],
  });

  const reviewResponse = await app.inject({
    method: "GET",
    url: "/v1/resources/review-summary?projectId=project-001&billVersionId=bill-version-001&status=pending",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  const processResponse = await app.inject({
    method: "GET",
    url: "/v1/resources/process-document-summary?projectId=project-001&stageCode=stage-001&documentType=change_order&status=draft",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(reviewResponse.statusCode, 200);
  assert.equal(processResponse.statusCode, 200);
  assert.deepEqual(requests, [
    {
      kind: "review",
      query: {
        projectId: "project-001",
        billVersionId: "bill-version-001",
        status: "pending",
      },
      token,
    },
    {
      kind: "process",
      query: {
        projectId: "project-001",
        stageCode: "stage-001",
        documentType: "change_order",
        status: "draft",
      },
      token,
    },
  ]);
  assert.deepEqual(reviewResponse.json(), {
    type: "resource",
    resourceType: "review_summary",
    scope: {
      projectId: "project-001",
      billVersionId: "bill-version-001",
      stageCode: null,
      disciplineCode: null,
      status: "pending",
    },
    data: {
      items: [],
      summary: {
        totalCount: 2,
        actionableCount: 1,
      },
    },
  });
  assert.deepEqual(processResponse.json(), {
    type: "resource",
    resourceType: "process_document_summary",
    scope: {
      projectId: "project-001",
      stageCode: "stage-001",
      disciplineCode: null,
      documentType: "change_order",
      status: "draft",
    },
    data: {
      items: [],
      summary: {
        totalCount: 3,
        statusCounts: {
          draft: 1,
          submitted: 1,
          approved: 1,
          rejected: 0,
        },
      },
    },
  });

  await app.close();
});

test("POST /v1/tools/decide-review proxies review approval for workflow roles", async () => {
  const requests: Array<Record<string, unknown>> = [];
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
    apiClient: {
      decideReview: async (input, bearerToken) => {
        requests.push({ token: bearerToken, ...input });
        return {
          id: input.reviewSubmissionId,
          status: "approved",
        };
      },
    } as never,
  });
  const token = await signAccessToken({
    sub: "reviewer-001",
    displayName: "Reviewer User",
    roleCodes: ["reviewer"],
  });

  const response = await app.inject({
    method: "POST",
    url: "/v1/tools/decide-review",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      projectId: "project-001",
      reviewSubmissionId: "review-001",
      action: "approve",
      comment: "同意",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    type: "tool_result",
    tool: "decide_review",
    mode: "synchronous",
    target: {
      projectId: "project-001",
      reviewSubmissionId: "review-001",
      action: "approve",
    },
    result: {
      id: "review-001",
      status: "approved",
    },
    execution: null,
    related: null,
  });
  assert.deepEqual(requests, [
    {
      token,
      projectId: "project-001",
      reviewSubmissionId: "review-001",
      action: "approve",
      comment: "同意",
    },
  ]);

  await app.close();
});

test("POST /v1/tools/decide-review requires a reason when rejecting", async () => {
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
    apiClient: {
      decideReview: async () => {
        throw new Error("decideReview should not be called");
      },
    } as never,
  });
  const token = await signAccessToken({
    sub: "reviewer-001",
    displayName: "Reviewer User",
    roleCodes: ["reviewer"],
  });

  const response = await app.inject({
    method: "POST",
    url: "/v1/tools/decide-review",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      projectId: "project-001",
      reviewSubmissionId: "review-001",
      action: "reject",
      comment: "不同意",
    },
  });

  assert.equal(response.statusCode, 422);
  assert.equal(response.json().error.code, "VALIDATION_ERROR");

  await app.close();
});

test("POST /v1/tools/decide-review rejects disallowed roles", async () => {
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
    apiClient: {} as never,
  });
  const token = await signAccessToken({
    sub: "auditor-001",
    displayName: "Auditor User",
    roleCodes: ["auditor"],
  });

  const response = await app.inject({
    method: "POST",
    url: "/v1/tools/decide-review",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      projectId: "project-001",
      reviewSubmissionId: "review-001",
      action: "approve",
    },
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error.code, "FORBIDDEN");

  await app.close();
});

test("POST /v1/tools/decide-review rejects invalid action values", async () => {
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
    apiClient: {
      decideReview: async () => {
        throw new Error("decideReview should not be called");
      },
    } as never,
  });
  const token = await signAccessToken({
    sub: "reviewer-001",
    displayName: "Reviewer User",
    roleCodes: ["reviewer"],
  });

  const response = await app.inject({
    method: "POST",
    url: "/v1/tools/decide-review",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      projectId: "project-001",
      reviewSubmissionId: "review-001",
      action: "archive",
    },
  });

  assert.equal(response.statusCode, 422);
  assert.equal(response.json().error.code, "VALIDATION_ERROR");

  await app.close();
});

test("POST /v1/tools/update-process-document-status proxies document workflow status", async () => {
  const requests: Array<Record<string, unknown>> = [];
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
    apiClient: {
      updateProcessDocumentStatus: async (input, bearerToken) => {
        requests.push({ token: bearerToken, ...input });
        return {
          id: input.documentId,
          status: "approved",
        };
      },
    } as never,
  });
  const token = await signAccessToken({
    sub: "reviewer-001",
    displayName: "Reviewer User",
    roleCodes: ["reviewer"],
  });

  const response = await app.inject({
    method: "POST",
    url: "/v1/tools/update-process-document-status",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      projectId: "project-001",
      documentId: "process-document-001",
      status: "approved",
      comment: "通过",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    type: "tool_result",
    tool: "update_process_document_status",
    mode: "synchronous",
    target: {
      projectId: "project-001",
      documentId: "process-document-001",
      status: "approved",
    },
    result: {
      id: "process-document-001",
      status: "approved",
    },
    execution: null,
    related: null,
  });
  assert.deepEqual(requests, [
    {
      token,
      projectId: "project-001",
      documentId: "process-document-001",
      status: "approved",
      comment: "通过",
    },
  ]);

  await app.close();
});

test("POST /v1/tools/update-process-document-status rejects disallowed roles", async () => {
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
    apiClient: {} as never,
  });
  const token = await signAccessToken({
    sub: "auditor-001",
    displayName: "Auditor User",
    roleCodes: ["auditor"],
  });

  const response = await app.inject({
    method: "POST",
    url: "/v1/tools/update-process-document-status",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      projectId: "project-001",
      documentId: "process-document-001",
      status: "approved",
    },
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error.code, "FORBIDDEN");

  await app.close();
});

test("POST /v1/tools/update-process-document-status rejects invalid status values", async () => {
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
    apiClient: {
      updateProcessDocumentStatus: async () => {
        throw new Error("updateProcessDocumentStatus should not be called");
      },
    } as never,
  });
  const token = await signAccessToken({
    sub: "reviewer-001",
    displayName: "Reviewer User",
    roleCodes: ["reviewer"],
  });

  const response = await app.inject({
    method: "POST",
    url: "/v1/tools/update-process-document-status",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      projectId: "project-001",
      documentId: "process-document-001",
      status: "archived",
    },
  });

  assert.equal(response.statusCode, 422);
  assert.equal(response.json().error.code, "VALIDATION_ERROR");

  await app.close();
});

test("GET /v1/resources/report-export-status proxies export task status from api", async () => {
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
    apiClient: {
      fetchReportExportStatus: async () => ({
        id: "report-export-task-001",
        status: "completed",
        isDownloadReady: true,
      }),
    } as never,
  });
  const token = await signAccessToken({
    sub: "engineer-001",
    displayName: "Cost Engineer",
    roleCodes: ["cost_engineer"],
  });

  const response = await app.inject({
    method: "GET",
    url: "/v1/resources/report-export-status?taskId=report-export-task-001",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    type: "resource",
    resourceType: "report_export_status",
    scope: {
      taskId: "report-export-task-001",
    },
    data: {
      id: "report-export-task-001",
      status: "completed",
      isDownloadReady: true,
    },
  });

  await app.close();
});

test("GET /v1/resources/import-failure-context proxies filtered import failure scope", async () => {
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
    apiClient: {
      fetchImportTasks: async (query) => {
        assert.equal(query.projectId, "project-001");
        return {
          items: [
            {
              id: "import-task-001",
              sourceLabel: "审计日志筛选导入",
              sourceFileName: "review-events.xlsx",
              status: "failed",
              metadata: {
                failureSummary: [
                  {
                    reasonCode: "missing_field",
                    reasonLabel: "缺少必填字段",
                    count: 2,
                  },
                ],
                failedItems: [
                  {
                    lineNo: 2,
                    reasonCode: "missing_field",
                    reasonLabel: "缺少必填字段",
                    errorMessage: "缺少 action",
                    projectId: "project-001",
                    resourceType: "review_submission",
                    action: null,
                    keys: ["projectId", "resourceType"],
                    retryEventSnapshot: null,
                  },
                  {
                    lineNo: 4,
                    reasonCode: "missing_field",
                    reasonLabel: "缺少必填字段",
                    errorMessage: "缺少工程量",
                    projectId: "project-001",
                    resourceType: "bill_item",
                    action: "create",
                    keys: ["projectId", "resourceType", "action", "name"],
                    retryEventSnapshot: {
                      projectId: "project-001",
                      resourceType: "bill_item",
                      action: "create",
                      name: "某清单项",
                    },
                  },
                ],
                failureSnapshots: [
                  {
                    lineNo: 4,
                    reasonCode: "missing_field",
                    resourceType: "bill_item",
                    action: "create",
                    retryEventSnapshot: {
                      projectId: "project-001",
                      resourceType: "bill_item",
                      action: "create",
                      name: "某清单项",
                    },
                  },
                ],
              },
            },
          ],
        };
      },
    } as never,
  });
  const token = await signAccessToken({
    sub: "engineer-001",
    displayName: "Cost Engineer",
    roleCodes: ["cost_engineer"],
  });

  const response = await app.inject({
    method: "GET",
    url: "/v1/resources/import-failure-context?projectId=project-001&failureReason=missing_field&failureResourceType=bill_item&failureAction=create",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    type: "resource",
    resourceType: "import_failure_context",
    scope: {
      projectId: "project-001",
      importTaskId: null,
      failureReason: "missing_field",
      failureResourceType: "bill_item",
      failureAction: "create",
    },
    data: {
      importTaskId: "import-task-001",
        sourceLabel: "审计日志筛选导入",
        sourceFileName: "review-events.xlsx",
        status: "failed",
        retryCount: null,
        retryLimit: null,
        canRetry: null,
        retryContext: null,
        failureSummary: [
        {
          reasonCode: "missing_field",
          reasonLabel: "缺少必填字段",
          count: 2,
        },
      ],
      failureSnapshots: [
        {
          lineNo: 4,
          reasonCode: "missing_field",
          resourceType: "bill_item",
          action: "create",
          retryEventSnapshot: {
            projectId: "project-001",
            resourceType: "bill_item",
            action: "create",
            name: "某清单项",
          },
        },
      ],
      filteredSummary: {
        itemCount: 1,
        missingFieldCount: 1,
        retrySnapshotCount: 1,
        resourceTypes: [{ label: "bill_item", count: 1 }],
        actions: [{ label: "create", count: 1 }],
      },
      failedItems: [
        {
          lineNo: 4,
          reasonCode: "missing_field",
          reasonLabel: "缺少必填字段",
          errorMessage: "缺少工程量",
          projectId: "project-001",
          resourceType: "bill_item",
          action: "create",
          keys: ["projectId", "resourceType", "action", "name"],
          retryEventSnapshot: {
            projectId: "project-001",
            resourceType: "bill_item",
            action: "create",
            name: "某清单项",
          },
        },
      ],
    },
  });

  await app.close();
});

test("POST /v1/tools/export-summary-report returns async job and report task references", async () => {
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
    apiClient: {
      exportSummaryReport: async () => ({
        job: {
          id: "background-job-002",
          status: "queued",
        },
        result: {
          id: "report-export-task-001",
          status: "queued",
        },
      }),
    } as never,
  });
  const token = await signAccessToken({
    sub: "engineer-001",
    displayName: "Cost Engineer",
    roleCodes: ["cost_engineer"],
  });

  const response = await app.inject({
    method: "POST",
    url: "/v1/tools/export-summary-report",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      projectId: "project-001",
      reportType: "summary",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    type: "tool_result",
    tool: "export_summary_report",
    mode: "accepted",
    target: {
      projectId: "project-001",
      reportType: "summary",
    },
    result: {
      job: {
        id: "background-job-002",
        status: "queued",
      },
      result: {
        id: "report-export-task-001",
        status: "queued",
      },
    },
    execution: {
      kind: "async_job",
      jobId: "background-job-002",
      statusResource: {
        resourceType: "job_status",
        query: {
          jobId: "background-job-002",
        },
      },
    },
    related: {
      reportExportTask: {
        resourceType: "report_export_status",
        query: {
          taskId: "report-export-task-001",
        },
      },
    },
  });

  await app.close();
});

test("POST /v1/tools/extract-knowledge returns async job reference", async () => {
  const requests: Array<{ token: string; body: Record<string, unknown> }> = [];
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
    apiClient: {
      extractKnowledge: async (input, bearerToken) => {
        requests.push({
          token: bearerToken,
          body: input as unknown as Record<string, unknown>,
        });
        return {
          job: {
            id: "background-job-knowledge-001",
            jobType: "knowledge_extraction",
            status: "queued",
          },
        };
      },
    } as never,
  });
  const token = await signAccessToken({
    sub: "engineer-001",
    displayName: "Cost Engineer",
    roleCodes: ["cost_engineer"],
  });

  const response = await app.inject({
    method: "POST",
    url: "/v1/tools/extract-knowledge",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      projectId: "project-001",
      source: "review_submission",
      events: [
        {
          id: "event-001",
          entityType: "review_submission",
          action: "approved",
        },
      ],
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    type: "tool_result",
    tool: "extract_knowledge",
    mode: "accepted",
    target: {
      projectId: "project-001",
      source: "review_submission",
      eventCount: 1,
    },
    result: {
      job: {
        id: "background-job-knowledge-001",
        jobType: "knowledge_extraction",
        status: "queued",
      },
    },
    execution: {
      kind: "async_job",
      jobId: "background-job-knowledge-001",
      statusResource: {
        resourceType: "job_status",
        query: {
          jobId: "background-job-knowledge-001",
        },
      },
    },
    related: null,
  });
  assert.deepEqual(requests, [
    {
      token,
      body: {
        projectId: "project-001",
        source: "review_submission",
        events: [
          {
            id: "event-001",
            entityType: "review_submission",
            action: "approved",
          },
        ],
      },
    },
  ]);

  await app.close();
});

test("POST /v1/tools/extract-knowledge rejects reviewer role", async () => {
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
    apiClient: {
      extractKnowledge: async () => ({}) as Record<string, unknown>,
    } as never,
  });
  const token = await signAccessToken({
    sub: "reviewer-001",
    displayName: "Reviewer",
    roleCodes: ["reviewer"],
  });

  const response = await app.inject({
    method: "POST",
    url: "/v1/tools/extract-knowledge",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      projectId: "project-001",
      source: "review_submission",
      events: [{ id: "event-001" }],
    },
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error.code, "FORBIDDEN");

  await app.close();
});

test("POST /v1/tools/preview-knowledge-extraction returns synchronous extraction result for project owners", async () => {
  const requests: Array<{ token: string; body: Record<string, unknown> }> = [];
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
    apiClient: {
      extractKnowledgePreview: async (input, bearerToken) => {
        requests.push({
          token: bearerToken,
          body: input as unknown as Record<string, unknown>,
        });
        return {
          runtime: "saas-pricing-ai-runtime:knowledge-memory-agent-runtime",
          source: "review_submission",
          result: {
            summary: {
              knowledgeCount: 1,
              memoryCount: 1,
            },
          },
        };
      },
    } as never,
  });
  const token = await signAccessToken({
    sub: "owner-001",
    displayName: "Project Owner",
    roleCodes: ["project_owner"],
  });

  const response = await app.inject({
    method: "POST",
    url: "/v1/tools/preview-knowledge-extraction",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      source: "review_submission",
      events: [
        {
          id: "event-001",
          entityType: "review_submission",
          action: "approved",
        },
      ],
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    type: "tool_result",
    tool: "preview_knowledge_extraction",
    mode: "synchronous",
    target: {
      source: "review_submission",
      eventCount: 1,
    },
    result: {
      runtime: "saas-pricing-ai-runtime:knowledge-memory-agent-runtime",
      source: "review_submission",
      result: {
        summary: {
          knowledgeCount: 1,
          memoryCount: 1,
        },
      },
    },
    execution: null,
    related: null,
  });
  assert.deepEqual(requests, [
    {
      token,
      body: {
        source: "review_submission",
        events: [
          {
            id: "event-001",
            entityType: "review_submission",
            action: "approved",
          },
        ],
      },
    },
  ]);

  await app.close();
});

test("POST /v1/tools/preview-knowledge-extraction rejects cost engineers", async () => {
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
    apiClient: {
      extractKnowledgePreview: async () => ({}) as Record<string, unknown>,
    } as never,
  });
  const token = await signAccessToken({
    sub: "engineer-001",
    displayName: "Cost Engineer",
    roleCodes: ["cost_engineer"],
  });

  const response = await app.inject({
    method: "POST",
    url: "/v1/tools/preview-knowledge-extraction",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      source: "review_submission",
      events: [{ id: "event-001" }],
    },
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error.code, "FORBIDDEN");

  await app.close();
});

test("POST /v1/tools/extract-knowledge-from-audit returns async job for project owners", async () => {
  const requests: Array<{ token: string; body: Record<string, unknown> }> = [];
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
    apiClient: {
      extractKnowledgeFromAudit: async (input, bearerToken) => {
        requests.push({
          token: bearerToken,
          body: input as unknown as Record<string, unknown>,
        });
        return {
          job: {
            id: "background-job-knowledge-002",
            jobType: "knowledge_extraction",
            status: "queued",
          },
          source: "audit_log",
          eventCount: 2,
        };
      },
    } as never,
  });
  const token = await signAccessToken({
    sub: "owner-001",
    displayName: "Project Owner",
    roleCodes: ["project_owner"],
  });

  const response = await app.inject({
    method: "POST",
    url: "/v1/tools/extract-knowledge-from-audit",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      projectId: "project-001",
      resourceType: "bill_version",
      action: "submit",
      limit: 2,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    type: "tool_result",
    tool: "extract_knowledge_from_audit",
    mode: "accepted",
    target: {
      projectId: "project-001",
      source: "audit_log",
      resourceType: "bill_version",
      action: "submit",
      limit: 2,
    },
    result: {
      job: {
        id: "background-job-knowledge-002",
        jobType: "knowledge_extraction",
        status: "queued",
      },
      source: "audit_log",
      eventCount: 2,
    },
    execution: {
      kind: "async_job",
      jobId: "background-job-knowledge-002",
      statusResource: {
        resourceType: "job_status",
        query: {
          jobId: "background-job-knowledge-002",
        },
      },
    },
    related: null,
  });
  assert.deepEqual(requests, [
    {
      token,
      body: {
        projectId: "project-001",
        resourceType: "bill_version",
        action: "submit",
        limit: 2,
      },
    },
  ]);

  await app.close();
});

test("POST /v1/tools/extract-knowledge-from-audit rejects cost engineers", async () => {
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
    apiClient: {
      extractKnowledgeFromAudit: async () => ({}) as Record<string, unknown>,
    } as never,
  });
  const token = await signAccessToken({
    sub: "engineer-001",
    displayName: "Cost Engineer",
    roleCodes: ["cost_engineer"],
  });

  const response = await app.inject({
    method: "POST",
    url: "/v1/tools/extract-knowledge-from-audit",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      projectId: "project-001",
      limit: 1,
    },
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error.code, "FORBIDDEN");

  await app.close();
});

test("GET resource and POST tool keep the same import failure scope in sync", async () => {
  const retryRequests: Array<Record<string, unknown>> = [];
  const importTasks = [
    {
      id: "import-task-001",
      sourceLabel: "审计日志筛选导入",
      sourceFileName: "review-events.xlsx",
      status: "failed",
      metadata: {
        failureSummary: [
          {
            reasonCode: "missing_field",
            reasonLabel: "缺少必填字段",
            count: 2,
          },
        ],
        failedItems: [
          {
            lineNo: 2,
            reasonCode: "missing_field",
            reasonLabel: "缺少必填字段",
            errorMessage: "缺少 action",
            projectId: "project-001",
            resourceType: "review_submission",
            action: null,
            keys: ["projectId", "resourceType"],
            retryEventSnapshot: null,
          },
          {
            lineNo: 4,
            reasonCode: "missing_field",
            reasonLabel: "缺少必填字段",
            errorMessage: "缺少工程量",
            projectId: "project-001",
            resourceType: "bill_item",
            action: "create",
            keys: ["projectId", "resourceType", "action", "name"],
            retryEventSnapshot: {
              projectId: "project-001",
              resourceType: "bill_item",
              action: "create",
              name: "某清单项",
            },
          },
        ],
        failureSnapshots: [
          {
            lineNo: 4,
            reasonCode: "missing_field",
            resourceType: "bill_item",
            action: "create",
            retryEventSnapshot: {
              projectId: "project-001",
              resourceType: "bill_item",
              action: "create",
              name: "某清单项",
            },
          },
        ],
      },
    },
  ];
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
    apiClient: {
      fetchImportTasks: async (query) => {
        assert.equal(query.projectId, "project-001");
        return {
          items: importTasks,
        };
      },
      retryImportFailureScope: async (input, bearerToken) => {
        retryRequests.push({
          token: bearerToken,
          ...input,
        });
        importTasks[0] = {
          ...importTasks[0],
          status: "queued",
          latestJobId: "background-job-020",
        };
        return {
          id: "background-job-020",
          status: "queued",
        };
      },
    } as never,
  });
  const token = await signAccessToken({
    sub: "owner-001",
    displayName: "Owner User",
    roleCodes: ["project_owner"],
  });

  const beforeRetryResponse = await app.inject({
    method: "GET",
    url: "/v1/resources/import-failure-context?projectId=project-001&failureReason=missing_field&failureResourceType=bill_item&failureAction=create",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(beforeRetryResponse.statusCode, 200);
  assert.equal(beforeRetryResponse.json().data.status, "failed");
  assert.deepEqual(beforeRetryResponse.json().data.filteredSummary, {
    itemCount: 1,
    missingFieldCount: 1,
    retrySnapshotCount: 1,
    resourceTypes: [{ label: "bill_item", count: 1 }],
    actions: [{ label: "create", count: 1 }],
  });

  const retryResponse = await app.inject({
    method: "POST",
    url: "/v1/tools/retry-import-failure-scope",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      jobId: "background-job-020",
      failureReason: "missing_field",
      failureResourceType: "bill_item",
      failureAction: "create",
    },
  });

  assert.equal(retryResponse.statusCode, 200);
  assert.equal(retryResponse.json().result.status, "queued");
  assert.deepEqual(retryRequests, [
    {
      token,
      jobId: "background-job-020",
      failureReason: "missing_field",
      failureResourceType: "bill_item",
      failureAction: "create",
    },
  ]);

  const afterRetryResponse = await app.inject({
    method: "GET",
    url: "/v1/resources/import-failure-context?projectId=project-001&failureReason=missing_field&failureResourceType=bill_item&failureAction=create",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(afterRetryResponse.statusCode, 200);
  assert.equal(afterRetryResponse.json().data.status, "queued");
  assert.equal(afterRetryResponse.json().data.importTaskId, "import-task-001");

  await app.close();
});

test("POST /v1/tools/retry-import-failure-scope proxies scoped retry for allowed roles", async () => {
  const requests: Array<Record<string, unknown>> = [];
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
    apiClient: {
      retryImportFailureScope: async (input, bearerToken) => {
        requests.push({
          token: bearerToken,
          ...input,
        });
        return {
          id: "background-job-010",
          status: "queued",
        };
      },
    } as never,
  });
  const token = await signAccessToken({
    sub: "owner-001",
    displayName: "Owner User",
    roleCodes: ["project_owner"],
  });

  const response = await app.inject({
    method: "POST",
    url: "/v1/tools/retry-import-failure-scope",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      jobId: "background-job-010",
      failureReason: "missing_field",
      failureResourceType: "bill_item",
      failureAction: "create",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    type: "tool_result",
    tool: "retry_import_failure_scope",
    mode: "accepted",
    target: {
      jobId: "background-job-010",
      failureReason: "missing_field",
      failureResourceType: "bill_item",
      failureAction: "create",
    },
    result: {
      id: "background-job-010",
      status: "queued",
    },
    execution: {
      kind: "async_job",
      jobId: "background-job-010",
      statusResource: {
        resourceType: "job_status",
        query: {
          jobId: "background-job-010",
        },
      },
    },
    related: null,
  });
  assert.deepEqual(requests, [
    {
      token,
      jobId: "background-job-010",
      failureReason: "missing_field",
      failureResourceType: "bill_item",
      failureAction: "create",
    },
  ]);

  await app.close();
});

test("POST /v1/tools/retry-import-failure-scope rejects disallowed roles", async () => {
  const app = createGatewayApp({
    jwtSecret,
    apiBaseUrl: "https://api.example.com",
    apiClient: {} as never,
  });
  const token = await signAccessToken({
    sub: "reviewer-001",
    displayName: "Reviewer User",
    roleCodes: ["reviewer"],
  });

  const response = await app.inject({
    method: "POST",
    url: "/v1/tools/retry-import-failure-scope",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      jobId: "background-job-010",
      failureReason: "missing_field",
    },
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error.code, "FORBIDDEN");

  await app.close();
});
