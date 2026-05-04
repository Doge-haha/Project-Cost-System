import test from "node:test";
import assert from "node:assert/strict";

import { GatewayApiClient } from "../src/runtime/api-client.js";
import { AppError } from "../src/shared/app-error.js";

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

test("GatewayApiClient.decideReview posts to the selected review action endpoint", async () => {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const client = new GatewayApiClient({
    apiBaseUrl: "https://api.example.com",
    fetchImpl: async (input, init) => {
      requests.push({
        url: typeof input === "string" ? input : input.toString(),
        init: init ?? {},
      });
      return jsonResponse({
        id: "review-001",
        status: "rejected",
      });
    },
  });

  const result = await client.decideReview(
    {
      projectId: "project-001",
      reviewSubmissionId: "review-001",
      action: "reject",
      reason: "工程量依据不足",
      comment: "退回补充",
    },
    "access-token",
  );

  assert.deepEqual(result, {
    id: "review-001",
    status: "rejected",
  });
  assert.equal(
    requests[0].url,
    "https://api.example.com/v1/projects/project-001/reviews/review-001/reject",
  );
  assert.equal(requests[0].init.method, "POST");
  assert.deepEqual(requests[0].init.headers, {
    authorization: "Bearer access-token",
    "content-type": "application/json",
  });
  assert.deepEqual(JSON.parse(String(requests[0].init.body)), {
    reason: "工程量依据不足",
    comment: "退回补充",
  });
});

test("GatewayApiClient.updateProcessDocumentStatus puts to the document status endpoint", async () => {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const client = new GatewayApiClient({
    apiBaseUrl: "https://api.example.com",
    fetchImpl: async (input, init) => {
      requests.push({
        url: typeof input === "string" ? input : input.toString(),
        init: init ?? {},
      });
      return jsonResponse({
        id: "process-document-001",
        status: "approved",
      });
    },
  });

  const result = await client.updateProcessDocumentStatus(
    {
      projectId: "project-001",
      documentId: "process-document-001",
      status: "approved",
      comment: "通过",
    },
    "access-token",
  );

  assert.deepEqual(result, {
    id: "process-document-001",
    status: "approved",
  });
  assert.equal(
    requests[0].url,
    "https://api.example.com/v1/projects/project-001/process-documents/process-document-001/status",
  );
  assert.equal(requests[0].init.method, "PUT");
  assert.deepEqual(requests[0].init.headers, {
    authorization: "Bearer access-token",
    "content-type": "application/json",
  });
  assert.deepEqual(JSON.parse(String(requests[0].init.body)), {
    status: "approved",
    comment: "通过",
  });
});

test("GatewayApiClient.fetchAiProviderTelemetry gets provider telemetry", async () => {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const client = new GatewayApiClient({
    apiBaseUrl: "https://api.example.com",
    fetchImpl: async (input, init) => {
      requests.push({
        url: typeof input === "string" ? input : input.toString(),
        init: init ?? {},
      });
      return jsonResponse({
        totalCount: 3,
        failureCount: 2,
      });
    },
  });

  const result = await client.fetchAiProviderTelemetry(
    {
      projectId: "project-001",
      limit: 20,
    },
    "access-token",
  );

  assert.deepEqual(result, {
    totalCount: 3,
    failureCount: 2,
  });
  assert.equal(
    requests[0].url,
    "https://api.example.com/v1/projects/project-001/ai/provider-telemetry?limit=20",
  );
  assert.equal(requests[0].init.method, "GET");
  assert.deepEqual(requests[0].init.headers, {
    authorization: "Bearer access-token",
  });
});

test("GatewayApiClient.fetchMemoryEntries gets scoped memory entries", async () => {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const client = new GatewayApiClient({
    apiBaseUrl: "https://api.example.com",
    fetchImpl: async (input, init) => {
      requests.push({
        url: typeof input === "string" ? input : input.toString(),
        init: init ?? {},
      });
      return jsonResponse({
        items: [{ id: "memory-entry-001" }],
        summary: { totalCount: 1 },
      });
    },
  });

  const result = await client.fetchMemoryEntries(
    {
      projectId: "project-001",
      sourceJobId: "job-001",
      subjectType: "project",
      subjectId: "project-001",
      stageCode: "estimate",
      limit: 5,
    },
    "access-token",
  );

  assert.deepEqual(result, {
    items: [{ id: "memory-entry-001" }],
    summary: { totalCount: 1 },
  });
  assert.equal(
    requests[0].url,
    "https://api.example.com/v1/projects/project-001/memory-entries?sourceJobId=job-001&subjectType=project&subjectId=project-001&stageCode=estimate&limit=5",
  );
  assert.equal(requests[0].init.method, "GET");
  assert.deepEqual(requests[0].init.headers, {
    authorization: "Bearer access-token",
  });
});

test("GatewayApiClient.fetchSkillDefinitions gets reserved skills", async () => {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const client = new GatewayApiClient({
    apiBaseUrl: "https://api.example.com",
    fetchImpl: async (input, init) => {
      requests.push({
        url: typeof input === "string" ? input : input.toString(),
        init: init ?? {},
      });
      return jsonResponse({
        items: [{ id: "skill-definition-001" }],
        summary: { totalCount: 1 },
      });
    },
  });

  const result = await client.fetchSkillDefinitions(
    {
      status: "active",
      skillCode: "quota-recommendation",
      limit: 5,
    },
    "access-token",
  );

  assert.deepEqual(result, {
    items: [{ id: "skill-definition-001" }],
    summary: { totalCount: 1 },
  });
  assert.equal(
    requests[0].url,
    "https://api.example.com/v1/skills/definitions?status=active&skillCode=quota-recommendation&limit=5",
  );
  assert.equal(requests[0].init.method, "GET");
  assert.deepEqual(requests[0].init.headers, {
    authorization: "Bearer access-token",
  });
});

test("GatewayApiClient workflow methods surface upstream structured errors", async () => {
  const processDocumentClient = new GatewayApiClient({
    apiBaseUrl: "https://api.example.com",
    fetchImpl: async () =>
      jsonResponse(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Only submitted process documents can be reviewed",
          },
        },
        422,
      ),
  });

  await assert.rejects(
    () =>
      processDocumentClient.updateProcessDocumentStatus(
        {
          projectId: "project-001",
          documentId: "process-document-001",
          status: "approved",
        },
        "access-token",
      ),
    (error) =>
      error instanceof AppError &&
      error.statusCode === 422 &&
      error.code === "VALIDATION_ERROR" &&
      error.message === "Only submitted process documents can be reviewed",
  );

  const reviewClient = new GatewayApiClient({
    apiBaseUrl: "https://api.example.com",
    fetchImpl: async () =>
      jsonResponse(
        {
          error: {
            code: "FORBIDDEN",
            message: "Only the submitter can cancel this review",
          },
        },
        403,
      ),
  });

  await assert.rejects(
    () =>
      reviewClient.decideReview(
        {
          projectId: "project-001",
          reviewSubmissionId: "review-001",
          action: "cancel",
        },
        "access-token",
      ),
    (error) =>
      error instanceof AppError &&
      error.statusCode === 403 &&
      error.code === "FORBIDDEN" &&
      error.message === "Only the submitter can cancel this review",
  );
});
