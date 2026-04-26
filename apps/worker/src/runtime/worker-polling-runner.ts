import type { ExecutedBackgroundJob } from "./background-job-executor.js";
import { WorkerPlatformRequestError } from "./api-worker-platform-client.js";
import type { BackgroundJobSource } from "./queue-backed-worker.js";
import { QueueBackedWorker } from "./queue-backed-worker.js";

type BackgroundJobReporter = {
  completeJob: (
    jobId: string,
    result: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  failJob: (
    jobId: string,
    errorMessage: string,
  ) => Promise<Record<string, unknown>>;
};

export class WorkerPollingRunner {
  constructor(
    private readonly worker: QueueBackedWorker,
    private readonly source: BackgroundJobSource,
    private readonly reporter?: BackgroundJobReporter,
  ) {}

  async pollOnce(): Promise<ExecutedBackgroundJob | null> {
    const executedJob = await this.worker.claimAndDrainOnce(this.source);
    if (!executedJob) {
      return null;
    }

    if (this.reporter) {
      if (executedJob.status === "completed") {
        await this.reportJobState(() => this.reporter!.completeJob(
          executedJob.id,
          executedJob.result ?? {},
        ));
      } else if (executedJob.status === "failed") {
        await this.reportJobState(() => this.reporter!.failJob(
          executedJob.id,
          executedJob.errorMessage ?? "Unknown worker failure",
        ));
      }
    }

    return executedJob;
  }

  private async reportJobState(
    reporterCall: () => Promise<Record<string, unknown>>,
  ): Promise<void> {
    try {
      await reporterCall();
    } catch (error) {
      if (
        error instanceof WorkerPlatformRequestError &&
        error.statusCode === 409 &&
        error.code === "BACKGROUND_JOB_NOT_PROCESSING"
      ) {
        return;
      }

      throw error;
    }
  }
}
