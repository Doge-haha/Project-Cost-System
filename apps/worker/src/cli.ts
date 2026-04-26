import {
  createWorkerCliRuntime,
  type WorkerCliDependencies as Dependencies,
} from "./runtime/create-worker-runtime.js";

export type WorkerCliConfig = {
  apiBaseUrl: string;
  workerToken: string;
  pollIntervalMs: number;
  maxIterations?: number;
};

export function parseWorkerCliConfig(
  env: Record<string, string | undefined>,
): WorkerCliConfig {
  const apiBaseUrl = env.API_BASE_URL?.trim();
  if (!apiBaseUrl) {
    throw new Error("API_BASE_URL is required");
  }

  const workerToken = env.WORKER_TOKEN?.trim();
  if (!workerToken) {
    throw new Error("WORKER_TOKEN is required");
  }

  const pollIntervalMs = env.POLL_INTERVAL_MS
    ? Number.parseInt(env.POLL_INTERVAL_MS, 10)
    : 1000;
  if (!Number.isFinite(pollIntervalMs) || pollIntervalMs <= 0) {
    throw new Error("POLL_INTERVAL_MS must be a positive integer");
  }

  const maxIterations = env.MAX_ITERATIONS
    ? Number.parseInt(env.MAX_ITERATIONS, 10)
    : undefined;
  if (
    maxIterations !== undefined &&
    (!Number.isFinite(maxIterations) || maxIterations <= 0)
  ) {
    throw new Error("MAX_ITERATIONS must be a positive integer");
  }

  return {
    apiBaseUrl,
    workerToken,
    pollIntervalMs,
    maxIterations,
  };
}

export async function runWorkerCli(
  env: Record<string, string | undefined>,
  dependencies: Dependencies = {},
): Promise<{
  iterations: number;
  executedCount: number;
  failedCount: number;
  idleCount: number;
  lastJobId: string | null;
  lastFailureMessage: string | null;
}> {
  const config = parseWorkerCliConfig(env);
  const { logger, loop } = createWorkerCliRuntime(env, config, dependencies);

  const summary = await loop.run();
  logger.info(
    `worker loop completed: iterations=${summary.iterations} executed=${summary.executedCount} failed=${summary.failedCount} idle=${summary.idleCount}`,
  );
  return summary;
}

async function main() {
  try {
    await runWorkerCli(process.env);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown worker CLI failure";
    console.error(message);
    process.exitCode = 1;
  }
}

if (
  typeof process.argv[1] === "string" &&
  /(?:^|[\\/])cli\.ts$/.test(process.argv[1])
) {
  void main();
}
