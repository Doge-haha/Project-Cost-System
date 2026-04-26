import type {
  BackgroundJobProcessorResult,
  BackgroundJobRecord,
} from "@saas-pricing/job-contracts";

import { runWorkerJob } from "../jobs/job-runner.js";

type Dependencies = {
  fetchSummary: (input: {
    projectId: string;
    stageCode?: string;
    disciplineCode?: string;
    userId: string;
  }) => Promise<Record<string, unknown>>;
  fetchVariance: (input: {
    projectId: string;
    stageCode?: string;
    disciplineCode?: string;
    userId: string;
    limit?: number;
  }) => Promise<Record<string, unknown>>;
  recalculateProject: (input: {
    projectId: string;
    stageCode?: string;
    disciplineCode?: string;
    priceVersionId?: string;
    feeTemplateId?: string;
    userId: string;
  }) => Promise<Record<string, unknown>>;
  aiRuntimeClient: import("./ai-runtime-cli-client.js").AiRuntimeCliClient;
  now?: () => string;
};

export type ExecutedBackgroundJob = BackgroundJobRecord & {
  completedAt: string;
  result?: Record<string, unknown> | null;
  errorMessage?: string | null;
};

export class BackgroundJobExecutor {
  constructor(private readonly dependencies: Dependencies) {}

  async execute(job: BackgroundJobRecord): Promise<ExecutedBackgroundJob> {
    const executionResult = await runWorkerJob(job, {
      fetchSummary: this.dependencies.fetchSummary,
      fetchVariance: this.dependencies.fetchVariance,
      recalculateProject: this.dependencies.recalculateProject,
      aiRuntimeClient: this.dependencies.aiRuntimeClient,
    });

    return this.toExecutedJob(job, executionResult);
  }

  private toExecutedJob(
    job: BackgroundJobRecord,
    executionResult: BackgroundJobProcessorResult,
  ): ExecutedBackgroundJob {
    return {
      ...job,
      status: executionResult.status,
      result: executionResult.result ?? null,
      errorMessage: executionResult.errorMessage ?? null,
      completedAt: this.dependencies.now?.() ?? new Date().toISOString(),
    };
  }
}
