import type { ExecutedBackgroundJob } from "./background-job-executor.js";

type Poller = {
  pollOnce(): Promise<ExecutedBackgroundJob | null>;
};

type Dependencies = {
  intervalMs: number;
  maxIterations?: number;
  sleep?: (ms: number) => Promise<void>;
  onResult?: (result: ExecutedBackgroundJob | null) => void | Promise<void>;
};

export class WorkerPollingLoop {
  private stopped = false;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private readonly poller: Poller,
    private readonly dependencies: Dependencies,
  ) {
    this.sleep =
      dependencies.sleep ??
      (async (ms: number) => {
        await new Promise((resolve) => setTimeout(resolve, ms));
      });
  }

  stop(): void {
    this.stopped = true;
  }

  async run(): Promise<{
    iterations: number;
    executedCount: number;
    failedCount: number;
    idleCount: number;
    lastJobId: string | null;
    lastFailureMessage: string | null;
  }> {
    let iterations = 0;
    let executedCount = 0;
    let failedCount = 0;
    let idleCount = 0;
    let lastJobId: string | null = null;
    let lastFailureMessage: string | null = null;

    while (!this.stopped) {
      if (
        this.dependencies.maxIterations !== undefined &&
        iterations >= this.dependencies.maxIterations
      ) {
        break;
      }

      const result = await this.poller.pollOnce();
      await this.dependencies.onResult?.(result);
      iterations += 1;
      if (result) {
        executedCount += 1;
        lastJobId = result.id;
        if (result.status === "failed") {
          failedCount += 1;
          lastFailureMessage = result.errorMessage ?? "Unknown worker failure";
        }
      } else {
        idleCount += 1;
      }

      if (this.stopped) {
        break;
      }

      if (
        this.dependencies.maxIterations !== undefined &&
        iterations >= this.dependencies.maxIterations
      ) {
        break;
      }

      await this.sleep(this.dependencies.intervalMs);
    }

    return {
      iterations,
      executedCount,
      failedCount,
      idleCount,
      lastJobId,
      lastFailureMessage,
    };
  }
}
