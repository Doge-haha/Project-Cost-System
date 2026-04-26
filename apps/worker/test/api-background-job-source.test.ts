import test from "node:test";
import assert from "node:assert/strict";

import { ApiBackgroundJobSource } from "../src/main.js";

test("ApiBackgroundJobSource claims the next queued job from the API", async () => {
  const requests: Array<{
    input: string;
    init?: RequestInit;
  }> = [];

  const source = new ApiBackgroundJobSource({
    baseUrl: "https://api.example.com",
    token: "worker-token",
    fetchImpl: async (input, init) => {
      requests.push({
        input: String(input),
        init,
      });

      return new Response(
        JSON.stringify({
          job: {
            id: "background-job-001",
            jobType: "report_export",
            status: "processing",
            requestedBy: "system-admin-001",
            projectId: "project-001",
            payload: {
              projectId: "project-001",
              reportType: "summary",
            },
            createdAt: "2026-04-18T10:00:00.000Z",
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    },
  });

  const job = await source.claimNextQueuedJob();

  assert.deepEqual(job, {
    id: "background-job-001",
    jobType: "report_export",
    status: "processing",
    requestedBy: "system-admin-001",
    projectId: "project-001",
    payload: {
      projectId: "project-001",
      reportType: "summary",
    },
    createdAt: "2026-04-18T10:00:00.000Z",
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.input, "https://api.example.com/v1/jobs/pull-next");
  assert.equal(requests[0]?.init?.method, "POST");
  assert.equal(
    (requests[0]?.init?.headers as Record<string, string>).authorization,
    "Bearer worker-token",
  );
});

test("ApiBackgroundJobSource returns null when the API has no queued job", async () => {
  const source = new ApiBackgroundJobSource({
    baseUrl: "https://api.example.com",
    token: "worker-token",
    fetchImpl: async () =>
      new Response(JSON.stringify({ job: null }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
  });

  const job = await source.claimNextQueuedJob();

  assert.equal(job, null);
});

test("ApiBackgroundJobSource throws when the API returns an error response", async () => {
  const source = new ApiBackgroundJobSource({
    baseUrl: "https://api.example.com",
    token: "worker-token",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          error: {
            code: "FORBIDDEN",
            message: "Only system administrators can claim background jobs",
          },
        }),
        {
          status: 403,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
  });

  await assert.rejects(
    () => source.claimNextQueuedJob(),
    /Only system administrators can claim background jobs/,
  );
});
