import { executableBackgroundJobTypes } from "./contracts.js";
import type {
  KnowledgeExtractionJobPayload,
  ProjectRecalculateJobPayload,
  ReportExportJobPayload,
  AiRecommendationJobPayload,
  WorkerJob,
  WorkerProcessorResult,
  WorkerJobType,
} from "./contracts.js";
import { processKnowledgeExtractionPreview } from "./knowledge-extraction-worker.js";
import { processProjectRecalculateJob } from "./project-recalculate-worker.js";
import { processReportExportJob } from "./report-export-worker.js";
import type { AiRuntimeCliClient } from "../runtime/ai-runtime-cli-client.js";

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
  generateAiRecommendations?: (input: {
    payload: AiRecommendationJobPayload;
    requestedBy: string;
  }) => Promise<Record<string, unknown>>;
  aiRuntimeClient: AiRuntimeCliClient;
};

export const executableJobTypes: WorkerJobType[] = [...executableBackgroundJobTypes];

export async function runWorkerJob(
  job: WorkerJob,
  dependencies: Dependencies,
): Promise<WorkerProcessorResult> {
  switch (job.jobType) {
    case "report_export": {
      const payload = job.payload as ReportExportJobPayload;
      return processReportExportJob(
        {
          projectId: payload.projectId,
          reportType: payload.reportType,
          stageCode: payload.stageCode ?? undefined,
          disciplineCode: payload.disciplineCode ?? undefined,
          requestedBy: job.requestedBy,
        },
        dependencies,
      );
    }
    case "project_recalculate": {
      const payload = job.payload as ProjectRecalculateJobPayload;
      return processProjectRecalculateJob(
        {
          projectId: payload.projectId,
          stageCode: payload.stageCode ?? undefined,
          disciplineCode: payload.disciplineCode ?? undefined,
          priceVersionId: payload.priceVersionId ?? undefined,
          feeTemplateId: payload.feeTemplateId ?? undefined,
          requestedBy: job.requestedBy,
        },
        dependencies,
      );
    }
    case "knowledge_extraction": {
      const payload = job.payload as KnowledgeExtractionJobPayload;
      return processKnowledgeExtractionPreview(
        {
          source: payload.source,
          events: payload.events,
        },
        {
          aiRuntimeClient: dependencies.aiRuntimeClient,
        },
      );
    }
    case "ai_recommendation": {
      if (!dependencies.generateAiRecommendations) {
        return {
          status: "failed",
          errorMessage: "AI recommendation jobs require platform-side processing",
        };
      }
      const payload = job.payload as AiRecommendationJobPayload;
      try {
        const result = await dependencies.generateAiRecommendations({
          payload,
          requestedBy: job.requestedBy,
        });
        return {
          status: "completed",
          result,
        };
      } catch (error) {
        return {
          status: "failed",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Unknown AI recommendation job error",
          result: {
            providerFailureSummary: {
              message:
                error instanceof Error
                  ? error.message
                  : "Unknown AI recommendation job error",
              manualActionRequired: true,
            },
          },
        };
      }
    }
    default:
      return assertUnsupportedJobType(job.jobType);
  }
}

function assertUnsupportedJobType(jobType: WorkerJobType): WorkerProcessorResult {
  throw new Error(`Job type ${jobType} should be handled before fallback`);
}
