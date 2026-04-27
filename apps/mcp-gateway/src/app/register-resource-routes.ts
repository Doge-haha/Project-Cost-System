import type { FastifyInstance } from "fastify";

import type { GatewayApiClient } from "../runtime/api-client.js";
import { AppError } from "../shared/app-error.js";
import { buildImportFailureContextResource } from "./import-failure-context.js";
import { resourceEnvelope } from "./responders.js";
import {
  importFailureContextQuerySchema,
  billVersionContextQuerySchema,
  jobStatusQuerySchema,
  jobsSummaryQuerySchema,
  knowledgeExtractionHistoryQuerySchema,
  knowledgeSearchQuerySchema,
  processDocumentSummaryQuerySchema,
  projectContextQuerySchema,
  projectSummaryQuerySchema,
  reportExportStatusQuerySchema,
  reviewSummaryQuerySchema,
  stageContextQuerySchema,
  summaryDetailsQuerySchema,
} from "./schemas.js";

export function registerResourceRoutes(
  app: FastifyInstance,
  input: {
    apiClient: GatewayApiClient;
  },
) {
  const { apiClient } = input;

  app.get("/v1/resources/project-summary", async (request) => {
    const query = projectSummaryQuerySchema.parse(request.query);
    const data = await apiClient.fetchProjectSummary(query, request.bearerToken!);

    return resourceEnvelope({
      resourceType: "project_summary",
      scope: {
        projectId: query.projectId,
        stageCode: query.stageCode ?? null,
        disciplineCode: query.disciplineCode ?? null,
      },
      data,
    });
  });

  app.get("/v1/resources/summary-details", async (request) => {
    const query = summaryDetailsQuerySchema.parse(request.query);
    const data = await apiClient.fetchSummaryDetails(query, request.bearerToken!);

    return resourceEnvelope({
      resourceType: "summary_details",
      scope: {
        projectId: query.projectId,
        billVersionId: query.billVersionId ?? null,
        stageCode: query.stageCode ?? null,
        disciplineCode: query.disciplineCode ?? null,
      },
      data,
    });
  });

  app.get("/v1/resources/jobs-summary", async (request) => {
    const query = jobsSummaryQuerySchema.parse(request.query);
    const data = await apiClient.fetchJobsSummary(query, request.bearerToken!);

    return resourceEnvelope({
      resourceType: "jobs_summary",
      scope: {
        projectId: query.projectId ?? null,
        requestedBy: query.requestedBy ?? null,
        jobType: query.jobType ?? null,
        status: query.status ?? null,
      },
      data,
    });
  });

  app.get("/v1/resources/project-context", async (request) => {
    const query = projectContextQuerySchema.parse(request.query);
    const [
      projectSummary,
      jobsSummary,
      jobStatus,
      latestKnowledgeExtractionJobs,
      latestKnowledgeEntries,
    ] = await Promise.all([
      apiClient.fetchProjectSummary(query, request.bearerToken!),
      apiClient.fetchJobsSummary(
        {
          projectId: query.projectId,
          requestedBy: query.jobsRequestedBy,
          status: query.jobsStatus,
          limit: query.jobsLimit,
        },
        request.bearerToken!,
      ),
      query.jobId
        ? apiClient.fetchJobStatus(
            {
              jobId: query.jobId,
            },
            request.bearerToken!,
          )
        : Promise.resolve(null),
      apiClient.fetchJobsSummary(
        {
          projectId: query.projectId,
          jobType: "knowledge_extraction",
          limit: 1,
        },
        request.bearerToken!,
      ),
      apiClient.fetchKnowledgeEntries(
        {
          projectId: query.projectId,
          limit: 3,
        },
        request.bearerToken!,
      ),
    ]);

    return resourceEnvelope({
      resourceType: "project_context",
      scope: {
        projectId: query.projectId,
        stageCode: query.stageCode ?? null,
        disciplineCode: query.disciplineCode ?? null,
        jobId: query.jobId ?? null,
      },
      data: {
        projectSummary,
        jobsSummary,
        jobStatus,
        latestKnowledgeExtractionJob:
          Array.isArray(latestKnowledgeExtractionJobs.items) &&
          latestKnowledgeExtractionJobs.items.length > 0
            ? latestKnowledgeExtractionJobs.items[0]
            : null,
        latestKnowledgeSummary:
          typeof latestKnowledgeEntries.summary === "object" &&
          latestKnowledgeEntries.summary !== null
            ? latestKnowledgeEntries.summary
            : null,
        latestKnowledgeEntries:
          Array.isArray(latestKnowledgeEntries.items)
            ? latestKnowledgeEntries.items
            : [],
      },
    });
  });

  app.get("/v1/resources/stage-context", async (request) => {
    const query = stageContextQuerySchema.parse(request.query);
    const [projectSummary, latestKnowledgeEntries] = await Promise.all([
      apiClient.fetchProjectSummary(
        {
          projectId: query.projectId,
          stageCode: query.stageCode,
          disciplineCode: query.disciplineCode,
        },
        request.bearerToken!,
      ),
      apiClient.fetchKnowledgeEntries(
        {
          projectId: query.projectId,
          stageCode: query.stageCode,
          limit: query.knowledgeLimit ?? 5,
        },
        request.bearerToken!,
      ),
    ]);

    return resourceEnvelope({
      resourceType: "stage_context",
      scope: {
        projectId: query.projectId,
        stageCode: query.stageCode,
        disciplineCode: query.disciplineCode ?? null,
      },
      data: {
        projectSummary,
        latestKnowledgeSummary:
          typeof latestKnowledgeEntries.summary === "object" &&
          latestKnowledgeEntries.summary !== null
            ? latestKnowledgeEntries.summary
            : null,
        latestKnowledgeEntries:
          Array.isArray(latestKnowledgeEntries.items)
            ? latestKnowledgeEntries.items
            : [],
      },
    });
  });

  app.get("/v1/resources/bill-version-context", async (request) => {
    const query = billVersionContextQuerySchema.parse(request.query);
    const [projectSummary, summaryDetails, latestKnowledgeEntries] =
      await Promise.all([
        apiClient.fetchProjectSummary(query, request.bearerToken!),
        apiClient.fetchSummaryDetails(
          {
            projectId: query.projectId,
            billVersionId: query.billVersionId,
            stageCode: query.stageCode,
            disciplineCode: query.disciplineCode,
            limit: query.detailsLimit ?? 10,
          },
          request.bearerToken!,
        ),
        apiClient.fetchKnowledgeEntries(
          {
            projectId: query.projectId,
            stageCode: query.stageCode,
            limit: query.knowledgeLimit ?? 5,
          },
          request.bearerToken!,
        ),
      ]);

    return resourceEnvelope({
      resourceType: "bill_version_context",
      scope: {
        projectId: query.projectId,
        billVersionId: query.billVersionId,
        stageCode: query.stageCode ?? null,
        disciplineCode: query.disciplineCode ?? null,
      },
      data: {
        projectSummary,
        summaryDetails,
        latestKnowledgeSummary:
          typeof latestKnowledgeEntries.summary === "object" &&
          latestKnowledgeEntries.summary !== null
            ? latestKnowledgeEntries.summary
            : null,
        latestKnowledgeEntries:
          Array.isArray(latestKnowledgeEntries.items)
            ? latestKnowledgeEntries.items
            : [],
      },
    });
  });

  app.get("/v1/resources/knowledge-search", async (request) => {
    const query = knowledgeSearchQuerySchema.parse(request.query);
    const data = await apiClient.searchKnowledgeEntries(
      {
        projectId: query.projectId,
        q: query.q,
        sourceType: query.sourceType,
        stageCode: query.stageCode,
        limit: query.limit,
      },
      request.bearerToken!,
    );

    return resourceEnvelope({
      resourceType: "knowledge_search",
      scope: {
        projectId: query.projectId,
        q: query.q,
        sourceType: query.sourceType ?? null,
        stageCode: query.stageCode ?? null,
      },
      data,
    });
  });

  app.get("/v1/resources/job-status", async (request) => {
    const query = jobStatusQuerySchema.parse(request.query);
    const data = await apiClient.fetchJobStatus(query, request.bearerToken!);

    return resourceEnvelope({
      resourceType: "job_status",
      scope: {
        jobId: query.jobId,
      },
      data,
    });
  });

  app.get("/v1/resources/knowledge-extraction-result", async (request) => {
    const query = jobStatusQuerySchema.parse(request.query);
    const data = await apiClient.fetchJobStatus(query, request.bearerToken!);

    if (data.jobType !== "knowledge_extraction") {
      throw new AppError(
        422,
        "INVALID_KNOWLEDGE_EXTRACTION_JOB",
        "Requested job is not a knowledge extraction job",
      );
    }

    return resourceEnvelope({
      resourceType: "knowledge_extraction_result",
      scope: {
        jobId: query.jobId,
      },
      data,
    });
  });

  app.get("/v1/resources/knowledge-extraction-history", async (request) => {
    const query = knowledgeExtractionHistoryQuerySchema.parse(request.query);
    const data = await apiClient.fetchJobsSummary(
      {
        projectId: query.projectId,
        requestedBy: query.requestedBy,
        jobType: "knowledge_extraction",
        status: query.status,
        limit: query.limit,
      },
      request.bearerToken!,
    );

    return resourceEnvelope({
      resourceType: "knowledge_extraction_history",
      scope: {
        projectId: query.projectId,
        requestedBy: query.requestedBy ?? null,
        status: query.status ?? null,
        limit: query.limit ?? null,
      },
      data,
    });
  });

  app.get("/v1/resources/review-summary", async (request) => {
    const query = reviewSummaryQuerySchema.parse(request.query);
    const data = await apiClient.fetchReviewSummary(query, request.bearerToken!);

    return resourceEnvelope({
      resourceType: "review_summary",
      scope: {
        projectId: query.projectId,
        billVersionId: query.billVersionId ?? null,
        stageCode: query.stageCode ?? null,
        disciplineCode: query.disciplineCode ?? null,
        status: query.status ?? null,
      },
      data,
    });
  });

  app.get("/v1/resources/process-document-summary", async (request) => {
    const query = processDocumentSummaryQuerySchema.parse(request.query);
    const data = await apiClient.fetchProcessDocumentSummary(
      query,
      request.bearerToken!,
    );

    return resourceEnvelope({
      resourceType: "process_document_summary",
      scope: {
        projectId: query.projectId,
        stageCode: query.stageCode ?? null,
        disciplineCode: query.disciplineCode ?? null,
        documentType: query.documentType ?? null,
        status: query.status ?? null,
      },
      data,
    });
  });

  app.get("/v1/resources/report-export-status", async (request) => {
    const query = reportExportStatusQuerySchema.parse(request.query);
    const data = await apiClient.fetchReportExportStatus(
      query,
      request.bearerToken!,
    );

    return resourceEnvelope({
      resourceType: "report_export_status",
      scope: {
        taskId: query.taskId,
      },
      data,
    });
  });

  app.get("/v1/resources/import-failure-context", async (request) => {
    const query = importFailureContextQuerySchema.parse(request.query);
    const importTasks = await apiClient.fetchImportTasks(
      {
        projectId: query.projectId,
      },
      request.bearerToken!,
    );

    return resourceEnvelope({
      resourceType: "import_failure_context",
      scope: {
        projectId: query.projectId,
        importTaskId: query.importTaskId ?? null,
        failureReason: query.failureReason ?? null,
        failureResourceType: query.failureResourceType ?? null,
        failureAction: query.failureAction ?? null,
      },
      data: buildImportFailureContextResource({
        importTasksPayload: importTasks,
        importTaskId: query.importTaskId,
        failureReason: query.failureReason,
        failureResourceType: query.failureResourceType,
        failureAction: query.failureAction,
      }),
    });
  });
}
