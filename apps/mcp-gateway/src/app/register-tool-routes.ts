import type { FastifyInstance } from "fastify";

import type { GatewayApiClient } from "../runtime/api-client.js";
import {
  assertCanInvokeWorkflowTool,
  assertCanInvokeWriteTool,
  assertCanPreviewKnowledgeTool,
} from "./permissions.js";
import { toolEnvelope } from "./responders.js";
import {
  decideReviewToolSchema,
  exportSummaryReportToolSchema,
  extractKnowledgeFromAuditToolSchema,
  extractKnowledgePreviewToolSchema,
  extractKnowledgeToolSchema,
  recalculateProjectToolSchema,
  retryImportFailureScopeToolSchema,
  updateProcessDocumentStatusToolSchema,
} from "./schemas.js";

export function registerToolRoutes(
  app: FastifyInstance,
  input: {
    apiClient: GatewayApiClient;
  },
) {
  const { apiClient } = input;

  app.post("/v1/tools/recalculate-project", async (request) => {
    assertCanInvokeWriteTool(request.currentUser!);

    const payload = recalculateProjectToolSchema.parse(request.body);
    const result = await apiClient.recalculateProject(
      payload,
      request.bearerToken!,
    );

    const asyncJobId =
      typeof result.jobId === "string"
        ? result.jobId
        : typeof result.id === "string"
          ? result.id
          : null;

    return toolEnvelope({
      tool: "recalculate_project",
      mode: "accepted",
      target: {
        projectId: payload.projectId,
      },
      result,
      execution:
        asyncJobId != null
          ? {
              kind: "async_job",
              jobId: asyncJobId,
              statusResource: {
                resourceType: "job_status",
                query: {
                  jobId: asyncJobId,
                },
              },
            }
          : undefined,
    });
  });

  app.post("/v1/tools/export-summary-report", async (request) => {
    assertCanInvokeWriteTool(request.currentUser!);

    const payload = exportSummaryReportToolSchema.parse(request.body);
    const result = await apiClient.exportSummaryReport(
      payload,
      request.bearerToken!,
    );
    const asyncTaskId =
      typeof result.result === "object" &&
      result.result !== null &&
      "id" in result.result &&
      typeof result.result.id === "string"
        ? result.result.id
        : null;
    const asyncJobId =
      typeof result.job === "object" &&
      result.job !== null &&
      "id" in result.job &&
      typeof result.job.id === "string"
        ? result.job.id
        : null;
    const reportExportTask =
      asyncTaskId != null
        ? {
            resourceType: "report_export_status" as const,
            query: {
              taskId: asyncTaskId,
            },
          }
        : null;

    return toolEnvelope({
      tool: "export_summary_report",
      mode: "accepted",
      target: {
        projectId: payload.projectId,
        reportType: payload.reportType,
      },
      result,
      execution:
        asyncJobId != null
          ? {
              kind: "async_job",
              jobId: asyncJobId,
              statusResource: {
                resourceType: "job_status",
                query: {
                  jobId: asyncJobId,
                },
              },
            }
          : undefined,
      related:
        reportExportTask != null
          ? {
              reportExportTask,
            }
          : null,
    });
  });

  app.post("/v1/tools/extract-knowledge", async (request) => {
    assertCanInvokeWriteTool(request.currentUser!);

    const payload = extractKnowledgeToolSchema.parse(request.body);
    const result = await apiClient.extractKnowledge(payload, request.bearerToken!);
    const asyncJobId =
      typeof result.job === "object" &&
      result.job !== null &&
      "id" in result.job &&
      typeof result.job.id === "string"
        ? result.job.id
        : null;

    return toolEnvelope({
      tool: "extract_knowledge",
      mode: "accepted",
      target: {
        projectId: payload.projectId,
        source: payload.source,
        eventCount: payload.events.length,
      },
      result,
      execution:
        asyncJobId != null
          ? {
              kind: "async_job",
              jobId: asyncJobId,
              statusResource: {
                resourceType: "job_status",
                query: {
                  jobId: asyncJobId,
                },
              },
            }
          : undefined,
    });
  });

  app.post("/v1/tools/preview-knowledge-extraction", async (request) => {
    assertCanPreviewKnowledgeTool(request.currentUser!);

    const payload = extractKnowledgePreviewToolSchema.parse(request.body);
    const result = await apiClient.extractKnowledgePreview(
      payload,
      request.bearerToken!,
    );

    return toolEnvelope({
      tool: "preview_knowledge_extraction",
      mode: "synchronous",
      target: {
        source: payload.source,
        eventCount: payload.events.length,
      },
      result,
    });
  });

  app.post("/v1/tools/extract-knowledge-from-audit", async (request) => {
    assertCanPreviewKnowledgeTool(request.currentUser!);

    const payload = extractKnowledgeFromAuditToolSchema.parse(request.body);
    const result = await apiClient.extractKnowledgeFromAudit(
      payload,
      request.bearerToken!,
    );
    const asyncJobId =
      typeof result.job === "object" &&
      result.job !== null &&
      "id" in result.job &&
      typeof result.job.id === "string"
        ? result.job.id
        : null;

    return toolEnvelope({
      tool: "extract_knowledge_from_audit",
      mode: "accepted",
      target: {
        projectId: payload.projectId,
        source: payload.source ?? "audit_log",
        resourceType: payload.resourceType ?? null,
        action: payload.action ?? null,
        limit: payload.limit ?? null,
      },
      result,
      execution:
        asyncJobId != null
          ? {
              kind: "async_job",
              jobId: asyncJobId,
              statusResource: {
                resourceType: "job_status",
                query: {
                  jobId: asyncJobId,
                },
              },
            }
          : undefined,
    });
  });

  app.post("/v1/tools/decide-review", async (request) => {
    assertCanInvokeWorkflowTool(request.currentUser!);

    const payload = decideReviewToolSchema.parse(request.body);
    const result = await apiClient.decideReview(payload, request.bearerToken!);

    return toolEnvelope({
      tool: "decide_review",
      mode: "synchronous",
      target: {
        projectId: payload.projectId,
        reviewSubmissionId: payload.reviewSubmissionId,
        action: payload.action,
      },
      result,
    });
  });

  app.post("/v1/tools/update-process-document-status", async (request) => {
    assertCanInvokeWorkflowTool(request.currentUser!);

    const payload = updateProcessDocumentStatusToolSchema.parse(request.body);
    const result = await apiClient.updateProcessDocumentStatus(
      payload,
      request.bearerToken!,
    );

    return toolEnvelope({
      tool: "update_process_document_status",
      mode: "synchronous",
      target: {
        projectId: payload.projectId,
        documentId: payload.documentId,
        status: payload.status,
      },
      result,
    });
  });

  app.post("/v1/tools/retry-import-failure-scope", async (request) => {
    assertCanInvokeWriteTool(request.currentUser!);

    const payload = retryImportFailureScopeToolSchema.parse(request.body);
    const result = await apiClient.retryImportFailureScope(
      {
        jobId: payload.jobId,
        failureReason: payload.failureReason,
        failureResourceType: payload.failureResourceType,
        failureAction: payload.failureAction,
      },
      request.bearerToken!,
    );
    const asyncJobId =
      typeof result.id === "string"
        ? result.id
        : typeof result.jobId === "string"
          ? result.jobId
          : payload.jobId;

    return toolEnvelope({
      tool: "retry_import_failure_scope",
      mode: "accepted",
      target: {
        jobId: payload.jobId,
        failureReason: payload.failureReason ?? null,
        failureResourceType: payload.failureResourceType ?? null,
        failureAction: payload.failureAction ?? null,
      },
      result,
      execution: {
        kind: "async_job",
        jobId: asyncJobId,
        statusResource: {
          resourceType: "job_status",
          query: {
            jobId: asyncJobId,
          },
        },
      },
    });
  });
}
