import test from "node:test";
import assert from "node:assert/strict";

import {
  ApiBackgroundJobSource,
  QueueBackedWorker,
  WorkerPlatformRequestError,
  WorkerPollingRunner,
} from "../src/main.js";

test("WorkerPollingRunner polls one job from the API source and executes it", async () => {
  const worker = new QueueBackedWorker(
    {
      enqueue: async () => {
        throw new Error("not used");
      },
      dequeue: async () => null,
      peek: async () => null,
      list: async () => [],
    },
    {
      now: () => "2026-04-18T12:00:00.000Z",
      fetchSummary: async () => ({ totalFinalAmount: 999 }),
      fetchVariance: async () => ({ items: [] }),
      recalculateProject: async () => ({ recalculatedCount: 0 }),
      aiRuntimeClient: { processEventBatch: async () => ({}) } as never,
    },
  );
  const source = new ApiBackgroundJobSource({
    baseUrl: "https://api.example.com",
    token: "worker-token",
    fetchImpl: async () =>
      new Response(
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
            createdAt: "2026-04-18T11:59:00.000Z",
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
  });

  const runner = new WorkerPollingRunner(worker, source);
  const result = await runner.pollOnce();

  assert.ok(result);
  assert.equal(result?.status, "completed");
  assert.deepEqual(result?.result, { totalFinalAmount: 999 });
});

test("WorkerPollingRunner returns null when the API source has no queued job", async () => {
  const worker = new QueueBackedWorker(
    {
      enqueue: async () => {
        throw new Error("not used");
      },
      dequeue: async () => null,
      peek: async () => null,
      list: async () => [],
    },
    {
      fetchSummary: async () => ({ totalFinalAmount: 0 }),
      fetchVariance: async () => ({ items: [] }),
      recalculateProject: async () => ({ recalculatedCount: 0 }),
      aiRuntimeClient: { processEventBatch: async () => ({}) } as never,
    },
  );
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

  const runner = new WorkerPollingRunner(worker, source);
  const result = await runner.pollOnce();

  assert.equal(result, null);
});

test("WorkerPollingRunner reports completed jobs back to the platform", async () => {
  const completions: Array<{ jobId: string; result: Record<string, unknown> }> = [];
  const worker = new QueueBackedWorker(
    {
      enqueue: async () => {
        throw new Error("not used");
      },
      dequeue: async () => null,
      peek: async () => null,
      list: async () => [],
    },
    {
      now: () => "2026-04-18T12:00:00.000Z",
      fetchSummary: async () => ({ totalFinalAmount: 999 }),
      fetchVariance: async () => ({ items: [] }),
      recalculateProject: async () => ({ recalculatedCount: 0 }),
      aiRuntimeClient: { processEventBatch: async () => ({}) } as never,
    },
  );
  const source = new ApiBackgroundJobSource({
    baseUrl: "https://api.example.com",
    token: "worker-token",
    fetchImpl: async () =>
      new Response(
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
            createdAt: "2026-04-18T11:59:00.000Z",
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
  });

  const runner = new WorkerPollingRunner(worker, source, {
    completeJob: async (jobId, result) => {
      completions.push({ jobId, result });
      return { ok: true };
    },
    failJob: async () => {
      throw new Error("unexpected fail callback");
    },
  });

  const result = await runner.pollOnce();

  assert.equal(result?.status, "completed");
  assert.deepEqual(completions, [
    {
      jobId: "background-job-001",
      result: { totalFinalAmount: 999 },
    },
  ]);
});

test("WorkerPollingRunner reports failed jobs back to the platform", async () => {
  const failures: Array<{ jobId: string; errorMessage: string }> = [];
  const worker = new QueueBackedWorker(
    {
      enqueue: async () => {
        throw new Error("not used");
      },
      dequeue: async () => null,
      peek: async () => null,
      list: async () => [],
    },
    {
      now: () => "2026-04-18T12:00:00.000Z",
      fetchSummary: async () => {
        throw new Error("summary fetch failed");
      },
      fetchVariance: async () => ({ items: [] }),
      recalculateProject: async () => ({ recalculatedCount: 0 }),
      aiRuntimeClient: { processEventBatch: async () => ({}) } as never,
    },
  );
  const source = new ApiBackgroundJobSource({
    baseUrl: "https://api.example.com",
    token: "worker-token",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          job: {
            id: "background-job-002",
            jobType: "report_export",
            status: "processing",
            requestedBy: "system-admin-001",
            projectId: "project-001",
            payload: {
              projectId: "project-001",
              reportType: "summary",
            },
            createdAt: "2026-04-18T11:59:00.000Z",
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
  });

  const runner = new WorkerPollingRunner(worker, source, {
    completeJob: async () => {
      throw new Error("unexpected complete callback");
    },
    failJob: async (jobId, errorMessage) => {
      failures.push({ jobId, errorMessage });
      return { ok: true };
    },
  });

  const result = await runner.pollOnce();

  assert.equal(result?.status, "failed");
  assert.deepEqual(failures, [
    {
      jobId: "background-job-002",
      errorMessage: "summary fetch failed",
    },
  ]);
});

test("WorkerPollingRunner ignores stale terminal-state platform conflicts", async () => {
  const worker = new QueueBackedWorker(
    {
      enqueue: async () => {
        throw new Error("not used");
      },
      dequeue: async () => null,
      peek: async () => null,
      list: async () => [],
    },
    {
      now: () => "2026-04-18T12:00:00.000Z",
      fetchSummary: async () => ({ totalFinalAmount: 999 }),
      fetchVariance: async () => ({ items: [] }),
      recalculateProject: async () => ({ recalculatedCount: 0 }),
      aiRuntimeClient: { processEventBatch: async () => ({}) } as never,
    },
  );
  const source = new ApiBackgroundJobSource({
    baseUrl: "https://api.example.com",
    token: "worker-token",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          job: {
            id: "background-job-003",
            jobType: "report_export",
            status: "processing",
            requestedBy: "system-admin-001",
            projectId: "project-001",
            payload: {
              projectId: "project-001",
              reportType: "summary",
            },
            createdAt: "2026-04-18T11:59:00.000Z",
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
  });

  const runner = new WorkerPollingRunner(worker, source, {
    completeJob: async () => {
      throw new WorkerPlatformRequestError(
        409,
        "BACKGROUND_JOB_NOT_PROCESSING",
        "Background job is not processing",
      );
    },
    failJob: async () => {
      throw new Error("unexpected fail callback");
    },
  });

  const result = await runner.pollOnce();

  assert.equal(result?.status, "completed");
});

test("WorkerPollingRunner rethrows non-stale platform report failures", async () => {
  const worker = new QueueBackedWorker(
    {
      enqueue: async () => {
        throw new Error("not used");
      },
      dequeue: async () => null,
      peek: async () => null,
      list: async () => [],
    },
    {
      now: () => "2026-04-18T12:00:00.000Z",
      fetchSummary: async () => ({ totalFinalAmount: 999 }),
      fetchVariance: async () => ({ items: [] }),
      recalculateProject: async () => ({ recalculatedCount: 0 }),
      aiRuntimeClient: { processEventBatch: async () => ({}) } as never,
    },
  );
  const source = new ApiBackgroundJobSource({
    baseUrl: "https://api.example.com",
    token: "worker-token",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          job: {
            id: "background-job-004",
            jobType: "report_export",
            status: "processing",
            requestedBy: "system-admin-001",
            projectId: "project-001",
            payload: {
              projectId: "project-001",
              reportType: "summary",
            },
            createdAt: "2026-04-18T11:59:00.000Z",
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
  });

  const runner = new WorkerPollingRunner(worker, source, {
    completeJob: async () => {
      throw new WorkerPlatformRequestError(
        500,
        "INTERNAL_ERROR",
        "platform unavailable",
      );
    },
    failJob: async () => {
      throw new Error("unexpected fail callback");
    },
  });

  await assert.rejects(
    () => runner.pollOnce(),
    {
      name: "WorkerPlatformRequestError",
      message: "platform unavailable",
    },
  );
});
