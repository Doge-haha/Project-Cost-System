import { AiRuntimeCliClient } from "./ai-runtime-cli-client.js";
import { ApiBackgroundJobSource } from "./api-background-job-source.js";
import { ApiWorkerPlatformClient } from "./api-worker-platform-client.js";
import { InMemoryBackgroundJobQueue } from "./background-job-queue.js";
import { QueueBackedWorker } from "./queue-backed-worker.js";
import { WorkerPollingLoop } from "./worker-polling-loop.js";
import { WorkerPollingRunner } from "./worker-polling-runner.js";
import type { WorkerCliConfig } from "../cli.js";

export type WorkerCliLogger = {
  info: (message: string) => void;
  error: (message: string) => void;
};

export type WorkerCliDependencies = {
  logger?: WorkerCliLogger;
  createSource?: (config: WorkerCliConfig) => ApiBackgroundJobSource;
  createPlatformClient?: (config: WorkerCliConfig) => ApiWorkerPlatformClient;
  createWorker?: (config: WorkerCliConfig) => QueueBackedWorker;
  createRunner?: (
    worker: QueueBackedWorker,
    source: ApiBackgroundJobSource,
    platformClient: ApiWorkerPlatformClient,
  ) => WorkerPollingRunner;
  createLoop?: (
    runner: WorkerPollingRunner,
    config: WorkerCliConfig,
  ) => Pick<WorkerPollingLoop, "run">;
};

export function createWorkerCliRuntime(
  env: Record<string, string | undefined>,
  config: WorkerCliConfig,
  dependencies: WorkerCliDependencies = {},
) {
  const logger = dependencies.logger ?? console;
  const source =
    dependencies.createSource?.(config) ??
    new ApiBackgroundJobSource({
      baseUrl: config.apiBaseUrl,
      token: config.workerToken,
    });
  const platformClient =
    dependencies.createPlatformClient?.(config) ??
    new ApiWorkerPlatformClient({
      baseUrl: config.apiBaseUrl,
      token: config.workerToken,
    });
  const worker =
    dependencies.createWorker?.(config) ??
    new QueueBackedWorker(new InMemoryBackgroundJobQueue(), {
      fetchSummary: (input) => platformClient.fetchSummary(input),
      fetchVariance: (input) => platformClient.fetchVariance(input),
      recalculateProject: (input) => platformClient.recalculateProject(input),
      aiRuntimeClient: new AiRuntimeCliClient({
        pythonExecutable: env.AI_RUNTIME_PYTHON?.trim() || "python3",
        cliPath:
          env.AI_RUNTIME_CLI_PATH?.trim() ||
          `${process.cwd()}/apps/ai-runtime/app/cli.py`,
      }),
    });
  const runner =
    dependencies.createRunner?.(worker, source, platformClient) ??
    new WorkerPollingRunner(worker, source, platformClient);
  const loop =
    dependencies.createLoop?.(runner, config) ??
    new WorkerPollingLoop(runner, {
      intervalMs: config.pollIntervalMs,
      maxIterations: config.maxIterations,
      onResult: async (result) => {
        if (!result) {
          logger.info("worker poll idle");
          return;
        }

        logger.info(
          `worker processed job: id=${result.id} type=${result.jobType} status=${result.status}`,
        );
      },
    });

  return {
    logger,
    source,
    platformClient,
    worker,
    runner,
    loop,
  };
}
