import type { TransactionRunner } from "../shared/tx/transaction.js";
import type { BackgroundJobService } from "../modules/jobs/background-job-service.js";
import type { ImportTaskService } from "../modules/import/import-task-service.js";

export async function createKnowledgeExtractionJobWithImportTask(
  dependencies: {
    transactionRunner: TransactionRunner;
    backgroundJobService: BackgroundJobService;
    importTaskService: ImportTaskService;
  },
  input: {
    projectId: string;
    source: string;
    sourceLabel: string;
    sourceFileName?: string | null;
    sourceBatchNo?: string | null;
    events: Array<Record<string, unknown>>;
    totalItemCount?: number;
    failedItemCount?: number;
    failureDetails?: string[];
    latestErrorMessage?: string | null;
    metadata?: Record<string, unknown>;
    requestedBy: string;
  },
) {
  const { transactionRunner, backgroundJobService, importTaskService } = dependencies;

  return transactionRunner.runInTransaction(async () => {
    const task = await importTaskService.createImportTask({
      projectId: input.projectId,
      sourceType: input.source,
      sourceLabel: input.sourceLabel,
      sourceFileName: input.sourceFileName ?? null,
      sourceBatchNo: input.sourceBatchNo ?? null,
      totalItemCount: input.totalItemCount ?? input.events.length,
      failedItemCount: input.failedItemCount ?? 0,
      failureDetails: input.failureDetails ?? [],
      latestErrorMessage: input.latestErrorMessage ?? null,
      metadata: input.metadata,
      requestedBy: input.requestedBy,
    });

    const job = await backgroundJobService.enqueueJob({
      jobType: "knowledge_extraction",
      requestedBy: input.requestedBy,
      projectId: input.projectId,
      payload: {
        projectId: input.projectId,
        source: input.source,
        sourceLabel: input.sourceLabel,
        importTaskId: task.id,
        events: input.events,
      },
    });

    return { task, job };
  });
}
