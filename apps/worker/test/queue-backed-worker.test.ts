import test from "node:test";
import assert from "node:assert/strict";

import {
  InMemoryBackgroundJobQueue,
  QueueBackedWorker,
} from "../src/main.js";

test("QueueBackedWorker drains queued jobs and returns executed result", async () => {
  const worker = new QueueBackedWorker(new InMemoryBackgroundJobQueue(), {
    now: () => "2026-04-18T09:00:00.000Z",
    fetchSummary: async () => ({ totalFinalAmount: 888 }),
    fetchVariance: async () => ({ items: [] }),
    recalculateProject: async () => ({ recalculatedCount: 0 }),
    aiRuntimeClient: { processEventBatch: async () => ({}) } as never,
  });

  await worker.enqueue({
    id: "job-001",
    jobType: "report_export",
    status: "queued",
    requestedBy: "user-001",
    projectId: "project-001",
    payload: {
      projectId: "project-001",
      reportType: "summary",
    },
    createdAt: "2026-04-18T08:59:00.000Z",
  });

  assert.equal((await worker.pendingJobs()).length, 1);

  const executed = await worker.drainOnce();
  assert.ok(executed);
  assert.equal(executed?.status, "completed");
  assert.equal(executed?.completedAt, "2026-04-18T09:00:00.000Z");
  assert.deepEqual(executed?.result, { totalFinalAmount: 888 });
  assert.equal((await worker.pendingJobs()).length, 0);
});

test("QueueBackedWorker drainOnce returns null when queue is empty", async () => {
  const worker = new QueueBackedWorker(new InMemoryBackgroundJobQueue(), {
    fetchSummary: async () => ({ totalFinalAmount: 0 }),
    fetchVariance: async () => ({ items: [] }),
    recalculateProject: async () => ({ recalculatedCount: 0 }),
    aiRuntimeClient: { processEventBatch: async () => ({}) } as never,
  });

  const executed = await worker.drainOnce();
  assert.equal(executed, null);
});

test("QueueBackedWorker can claim the next queued job from a source and execute it", async () => {
  const worker = new QueueBackedWorker(new InMemoryBackgroundJobQueue(), {
    now: () => "2026-04-18T10:00:00.000Z",
    fetchSummary: async () => ({ totalFinalAmount: 456 }),
    fetchVariance: async () => ({ items: [] }),
    recalculateProject: async () => ({ recalculatedCount: 0 }),
    aiRuntimeClient: { processEventBatch: async () => ({}) } as never,
  });

  const source = {
    calls: 0,
    async claimNextQueuedJob() {
      this.calls += 1;
      return {
        id: "job-remote-001",
        jobType: "report_export" as const,
        status: "processing" as const,
        requestedBy: "system-admin-001",
        projectId: "project-001",
        payload: {
          projectId: "project-001",
          reportType: "summary" as const,
        },
        createdAt: "2026-04-18T09:59:00.000Z",
      };
    },
  };

  const executed = await worker.claimAndDrainOnce(source);

  assert.equal(source.calls, 1);
  assert.ok(executed);
  assert.equal(executed?.status, "completed");
  assert.equal(executed?.completedAt, "2026-04-18T10:00:00.000Z");
  assert.deepEqual(executed?.result, { totalFinalAmount: 456 });
});
