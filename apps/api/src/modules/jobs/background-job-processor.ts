import type {
  KnowledgeExtractionJobPayload,
  ProjectRecalculateJobPayload,
  ReportExportJobPayload,
} from "@saas-pricing/job-contracts";

import { BackgroundJobService } from "./background-job-service.js";

type Dependencies = {
  processProjectRecalculate: (input: {
    payload: ProjectRecalculateJobPayload;
    requestedBy: string;
  }) => Promise<Record<string, unknown>>;
  processReportExport: (input: {
    payload: ReportExportJobPayload;
    requestedBy: string;
  }) => Promise<Record<string, unknown>>;
  processKnowledgeExtraction: (input: {
    jobId: string;
    payload: KnowledgeExtractionJobPayload;
    requestedBy: string;
  }) => Promise<Record<string, unknown>>;
};

export class BackgroundJobProcessor {
  constructor(
    private readonly backgroundJobService: BackgroundJobService,
    private readonly dependencies: Dependencies,
  ) {}

  async processJob(jobId: string) {
    const job = await this.backgroundJobService.startJob(jobId);

    try {
      const knowledgeExtractionPayload =
        job.jobType === "knowledge_extraction"
          ? ({
              ...(job.payload as KnowledgeExtractionJobPayload),
              events:
                Array.isArray(
                  (job.payload as KnowledgeExtractionJobPayload).retryEvents,
                ) &&
                (job.payload as KnowledgeExtractionJobPayload).retryEvents!.length > 0
                  ? (job.payload as KnowledgeExtractionJobPayload).retryEvents!
                  : (job.payload as KnowledgeExtractionJobPayload).events,
            } as KnowledgeExtractionJobPayload)
          : null;
      const result =
        job.jobType === "project_recalculate"
          ? await this.dependencies.processProjectRecalculate({
              payload: job.payload as ProjectRecalculateJobPayload,
              requestedBy: job.requestedBy,
            })
          : job.jobType === "report_export"
            ? await this.dependencies.processReportExport({
                payload: job.payload as ReportExportJobPayload,
                requestedBy: job.requestedBy,
              })
            : await this.dependencies.processKnowledgeExtraction({
                jobId: job.id,
                payload: knowledgeExtractionPayload as KnowledgeExtractionJobPayload,
                requestedBy: job.requestedBy,
              });

      return this.backgroundJobService.completeJob({
        jobId: job.id,
        result,
      });
    } catch (error) {
      return this.backgroundJobService.failJob({
        jobId: job.id,
        errorMessage:
          error instanceof Error ? error.message : "Unknown background job error",
      });
    }
  }
}
