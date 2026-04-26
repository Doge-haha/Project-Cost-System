import test from "node:test";
import assert from "node:assert/strict";

import {
  ApiWorkerPlatformClient,
  WorkerPlatformRequestError,
} from "../src/main.js";

test("ApiWorkerPlatformClient fetches summary and variance and posts recalculate", async () => {
  const requests: Array<{ input: string; init?: RequestInit }> = [];
  const client = new ApiWorkerPlatformClient({
    baseUrl: "https://api.example.com",
    token: "worker-token",
    fetchImpl: async (input, init) => {
      requests.push({ input: String(input), init });
      const url = String(input);
      if (url.includes("/v1/reports/summary/details")) {
        return new Response(JSON.stringify({ items: [{ itemId: "bill-item-001" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/v1/reports/summary")) {
        return new Response(JSON.stringify({ totalFinalAmount: 321 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ recalculatedCount: 2 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const summary = await client.fetchSummary({
    projectId: "project-001",
    stageCode: "estimate",
    disciplineCode: "building",
    userId: "system-admin-001",
  });
  const variance = await client.fetchVariance({
    projectId: "project-001",
    stageCode: "estimate",
    disciplineCode: "building",
    limit: 10,
    userId: "system-admin-001",
  });
  const recalculate = await client.recalculateProject({
    projectId: "project-001",
    stageCode: "estimate",
    disciplineCode: "building",
    userId: "system-admin-001",
  });

  assert.deepEqual(summary, { totalFinalAmount: 321 });
  assert.deepEqual(variance, { items: [{ itemId: "bill-item-001" }] });
  assert.deepEqual(recalculate, { recalculatedCount: 2 });
  assert.equal(requests.length, 3);
  assert.match(requests[0]?.input ?? "", /\/v1\/reports\/summary\?/);
  assert.match(requests[1]?.input ?? "", /\/v1\/reports\/summary\/details\?/);
  assert.equal(requests[2]?.input, "https://api.example.com/v1/projects/project-001/recalculate");
  assert.equal(requests[2]?.init?.method, "POST");
});

test("ApiWorkerPlatformClient reports completed and failed jobs", async () => {
  const requests: Array<{ input: string; init?: RequestInit }> = [];
  const client = new ApiWorkerPlatformClient({
    baseUrl: "https://api.example.com",
    token: "worker-token",
    fetchImpl: async (input, init) => {
      requests.push({ input: String(input), init });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  await client.completeJob("background-job-001", { exported: true });
  await client.failJob("background-job-002", "worker failed");

  assert.equal(requests.length, 2);
  assert.equal(
    requests[0]?.input,
    "https://api.example.com/v1/jobs/background-job-001/complete",
  );
  assert.equal(requests[0]?.init?.method, "POST");
  assert.equal(
    requests[1]?.input,
    "https://api.example.com/v1/jobs/background-job-002/fail",
  );
  assert.equal(requests[1]?.init?.method, "POST");
});

test("ApiWorkerPlatformClient preserves platform error status and code", async () => {
  const client = new ApiWorkerPlatformClient({
    baseUrl: "https://api.example.com",
    token: "worker-token",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          error: {
            code: "BACKGROUND_JOB_NOT_PROCESSING",
            message: "Background job is not processing",
          },
        }),
        {
          status: 409,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
  });

  await assert.rejects(
    () => client.completeJob("background-job-001", { exported: true }),
    (error) =>
      error instanceof WorkerPlatformRequestError &&
      error.statusCode === 409 &&
      error.code === "BACKGROUND_JOB_NOT_PROCESSING" &&
      error.message === "Background job is not processing",
  );
});
