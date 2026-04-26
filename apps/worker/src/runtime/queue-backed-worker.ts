import type { BackgroundJobRecord } from "@saas-pricing/job-contracts";

import type { BackgroundJobQueue } from "./background-job-queue.js";
import {
  BackgroundJobExecutor,
  type ExecutedBackgroundJob,
} from "./background-job-executor.js";

type Dependencies = ConstructorParameters<typeof BackgroundJobExecutor>[0];

export interface BackgroundJobSource {
  claimNextQueuedJob(): Promise<BackgroundJobRecord | null>;
}

export class QueueBackedWorker {
  private readonly executor: BackgroundJobExecutor;

  constructor(
    private readonly queue: BackgroundJobQueue,
    dependencies: Dependencies,
  ) {
    this.executor = new BackgroundJobExecutor(dependencies);
  }

  async enqueue(job: BackgroundJobRecord): Promise<void> {
    await this.queue.enqueue(job);
  }

  async drainOnce(): Promise<ExecutedBackgroundJob | null> {
    const job = await this.queue.dequeue();
    if (!job) {
      return null;
    }

    return this.executor.execute(job);
  }

  async claimAndDrainOnce(
    source: BackgroundJobSource,
  ): Promise<ExecutedBackgroundJob | null> {
    const job = await source.claimNextQueuedJob();
    if (!job) {
      return null;
    }

    return this.executor.execute(job);
  }

  async pendingJobs(): Promise<BackgroundJobRecord[]> {
    return this.queue.list();
  }
}
