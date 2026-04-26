import test from "node:test";
import assert from "node:assert/strict";

import { parseWorkerCliConfig, runWorkerCli } from "../src/cli.js";

test("parseWorkerCliConfig reads required env and applies defaults", () => {
  const config = parseWorkerCliConfig({
    API_BASE_URL: "https://api.example.com",
    WORKER_TOKEN: "worker-token",
  });

  assert.deepEqual(config, {
    apiBaseUrl: "https://api.example.com",
    workerToken: "worker-token",
    pollIntervalMs: 1000,
    maxIterations: undefined,
  });
});

test("parseWorkerCliConfig parses poll interval and max iterations", () => {
  const config = parseWorkerCliConfig({
    API_BASE_URL: "https://api.example.com",
    WORKER_TOKEN: "worker-token",
    POLL_INTERVAL_MS: "2500",
    MAX_ITERATIONS: "3",
  });

  assert.deepEqual(config, {
    apiBaseUrl: "https://api.example.com",
    workerToken: "worker-token",
    pollIntervalMs: 2500,
    maxIterations: 3,
  });
});

test("parseWorkerCliConfig rejects missing required env", () => {
  assert.throws(
    () =>
      parseWorkerCliConfig({
        WORKER_TOKEN: "worker-token",
      }),
    /API_BASE_URL is required/,
  );

  assert.throws(
    () =>
      parseWorkerCliConfig({
        API_BASE_URL: "https://api.example.com",
      }),
    /WORKER_TOKEN is required/,
  );
});

test("runWorkerCli creates the runtime and returns loop summary", async () => {
  const calls: string[] = [];

  const summary = await runWorkerCli(
    {
      API_BASE_URL: "https://api.example.com",
      WORKER_TOKEN: "worker-token",
      POLL_INTERVAL_MS: "2500",
      MAX_ITERATIONS: "2",
    },
    {
      logger: {
        info: (message: string) => {
          calls.push(message);
        },
        error: () => {
          throw new Error("unexpected error log");
        },
      },
      createSource: (config) => {
        calls.push(`source:${config.apiBaseUrl}`);
        return {} as never;
      },
      createWorker: () => {
        calls.push("worker");
        return {} as never;
      },
      createRunner: () => {
        calls.push("runner");
        return {} as never;
      },
      createLoop: (_runner, config) => {
        calls.push(`loop:${config.pollIntervalMs}:${config.maxIterations}`);
        return {
          run: async () => ({
            iterations: 2,
            executedCount: 1,
            failedCount: 0,
            idleCount: 1,
            lastJobId: "background-job-001",
            lastFailureMessage: null,
          }),
        };
      },
    },
  );

  assert.deepEqual(summary, {
    iterations: 2,
    executedCount: 1,
    failedCount: 0,
    idleCount: 1,
    lastJobId: "background-job-001",
    lastFailureMessage: null,
  });
  assert.deepEqual(calls, [
    "source:https://api.example.com",
    "worker",
    "runner",
    "loop:2500:2",
    "worker loop completed: iterations=2 executed=1 failed=0 idle=1",
  ]);
});
