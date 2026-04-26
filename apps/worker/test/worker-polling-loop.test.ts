import test from "node:test";
import assert from "node:assert/strict";

import { WorkerPollingLoop } from "../src/main.js";

test("WorkerPollingLoop polls repeatedly and stops after max iterations", async () => {
  const pollResults = [
    {
      id: "background-job-001",
      jobType: "report_export",
      status: "completed",
      result: { jobId: "job-001" },
    },
    {
      id: "background-job-002",
      jobType: "project_recalculate",
      status: "failed",
      errorMessage: "boom",
    },
  ];
  const observedSleeps: number[] = [];
  const observedResults: Array<string> = [];
  let pollCalls = 0;

  const loop = new WorkerPollingLoop(
    {
      pollOnce: async () => {
        pollCalls += 1;
        return pollResults.shift() ?? null;
      },
    },
    {
      intervalMs: 250,
      maxIterations: 2,
      sleep: async (ms) => {
        observedSleeps.push(ms);
      },
      onResult: async (result) => {
        observedResults.push(result ? `${result.id}:${result.status}` : "idle");
      },
    },
  );

  const summary = await loop.run();

  assert.equal(pollCalls, 2);
  assert.equal(summary.iterations, 2);
  assert.equal(summary.executedCount, 2);
  assert.equal(summary.failedCount, 1);
  assert.equal(summary.idleCount, 0);
  assert.equal(summary.lastJobId, "background-job-002");
  assert.equal(summary.lastFailureMessage, "boom");
  assert.deepEqual(observedSleeps, [250]);
  assert.deepEqual(observedResults, [
    "background-job-001:completed",
    "background-job-002:failed",
  ]);
});

test("WorkerPollingLoop can be stopped before hitting max iterations", async () => {
  const observedSleeps: number[] = [];
  let pollCalls = 0;

  const loop = new WorkerPollingLoop(
    {
      pollOnce: async () => {
        pollCalls += 1;
        loop.stop();
        return null;
      },
    },
    {
      intervalMs: 100,
      maxIterations: 10,
      sleep: async (ms) => {
        observedSleeps.push(ms);
      },
    },
  );

  const summary = await loop.run();

  assert.equal(pollCalls, 1);
  assert.equal(summary.iterations, 1);
  assert.equal(summary.executedCount, 0);
  assert.equal(summary.failedCount, 0);
  assert.equal(summary.idleCount, 1);
  assert.equal(summary.lastJobId, null);
  assert.equal(summary.lastFailureMessage, null);
  assert.deepEqual(observedSleeps, []);
});
