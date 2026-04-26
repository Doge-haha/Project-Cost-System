import { AppError } from "../shared/app-error.js";

type Dependencies = {
  apiBaseUrl: string;
  fetchImpl?: typeof fetch;
};

export type ProjectSummaryQuery = {
  projectId: string;
  billVersionId?: string;
  stageCode?: string;
  disciplineCode?: string;
};

export type SummaryDetailsQuery = ProjectSummaryQuery & {
  limit?: number;
};

export type JobsSummaryQuery = {
  projectId?: string;
  requestedBy?: string;
  jobType?: "report_export" | "project_recalculate" | "knowledge_extraction";
  status?: "queued" | "processing" | "completed" | "failed";
  limit?: number;
};

export type JobStatusQuery = {
  jobId: string;
};

export type ReviewSummaryQuery = {
  projectId: string;
  billVersionId?: string;
  stageCode?: string;
  disciplineCode?: string;
  status?: "pending" | "approved" | "rejected" | "cancelled";
};

export type ProcessDocumentSummaryQuery = {
  projectId: string;
  stageCode?: string;
  disciplineCode?: string;
  documentType?: "change_order" | "site_visa" | "progress_payment";
  status?: "draft" | "submitted" | "approved" | "rejected";
};

export type ReportExportStatusQuery = {
  taskId: string;
};

export type ImportFailureContextQuery = {
  projectId: string;
};

export type KnowledgeEntriesQuery = {
  projectId: string;
  sourceJobId?: string;
  sourceType?: string;
  sourceAction?: string;
  stageCode?: string;
  limit?: number;
};

export type ExtractKnowledgeInput = {
  projectId: string;
  source: string;
  events: Array<Record<string, unknown>>;
};

export type ExtractKnowledgeFromAuditInput = {
  projectId: string;
  source?: string;
  resourceType?: string;
  resourceId?: string;
  resourceIdPrefix?: string;
  action?: string;
  operatorId?: string;
  createdFrom?: string;
  createdTo?: string;
  limit?: number;
};

export type RetryImportFailureScopeInput = {
  jobId: string;
  failureReason?: string;
  failureResourceType?: string;
  failureAction?: string;
};

export type DecideReviewInput = {
  projectId: string;
  reviewSubmissionId: string;
  action: "approve" | "reject" | "cancel";
  comment?: string;
  reason?: string;
};

export type UpdateProcessDocumentStatusInput = {
  projectId: string;
  documentId: string;
  status: "submitted" | "approved" | "rejected";
  comment?: string;
};

export class GatewayApiClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly dependencies: Dependencies) {
    this.fetchImpl = dependencies.fetchImpl ?? fetch;
  }

  async fetchProjectSummary(
    query: ProjectSummaryQuery,
    bearerToken: string,
  ): Promise<Record<string, unknown>> {
    const response = await this.fetchImpl(
      `${this.dependencies.apiBaseUrl}/v1/reports/summary?${this.buildQuery({
        projectId: query.projectId,
        billVersionId: query.billVersionId,
        stageCode: query.stageCode,
        disciplineCode: query.disciplineCode,
      }).toString()}`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${bearerToken}`,
        },
      },
    );

    const payload = (await response.json()) as
      | Record<string, unknown>
      | {
          error?: {
            code?: string;
            message?: string;
          };
        };

    if (!response.ok) {
      throw new AppError(
        response.status,
        (payload as { error?: { code?: string } }).error?.code ??
          "UPSTREAM_REQUEST_FAILED",
        (payload as { error?: { message?: string } }).error?.message ??
          "Failed to load project summary",
      );
    }

    return payload as Record<string, unknown>;
  }

  async fetchJobsSummary(
    query: JobsSummaryQuery,
    bearerToken: string,
  ): Promise<Record<string, unknown>> {
    const response = await this.fetchImpl(
      `${this.dependencies.apiBaseUrl}/v1/jobs?${this.buildQuery({
        projectId: query.projectId,
        requestedBy: query.requestedBy,
        jobType: query.jobType,
        status: query.status,
        limit: query.limit?.toString(),
      }).toString()}`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${bearerToken}`,
        },
      },
    );

    const payload = (await response.json()) as
      | Record<string, unknown>
      | {
          error?: {
            code?: string;
            message?: string;
          };
        };

    if (!response.ok) {
      throw new AppError(
        response.status,
        (payload as { error?: { code?: string } }).error?.code ??
          "UPSTREAM_REQUEST_FAILED",
        (payload as { error?: { message?: string } }).error?.message ??
          "Failed to load jobs summary",
      );
    }

    return payload as Record<string, unknown>;
  }

  async fetchSummaryDetails(
    query: SummaryDetailsQuery,
    bearerToken: string,
  ): Promise<Record<string, unknown>> {
    const response = await this.fetchImpl(
      `${this.dependencies.apiBaseUrl}/v1/reports/summary/details?${this.buildQuery({
        projectId: query.projectId,
        billVersionId: query.billVersionId,
        stageCode: query.stageCode,
        disciplineCode: query.disciplineCode,
        limit: query.limit?.toString(),
      }).toString()}`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${bearerToken}`,
        },
      },
    );

    const payload = (await response.json()) as
      | Record<string, unknown>
      | {
          error?: {
            code?: string;
            message?: string;
          };
        };

    if (!response.ok) {
      throw new AppError(
        response.status,
        (payload as { error?: { code?: string } }).error?.code ??
          "UPSTREAM_REQUEST_FAILED",
        (payload as { error?: { message?: string } }).error?.message ??
          "Failed to load summary details",
      );
    }

    return payload as Record<string, unknown>;
  }

  async fetchKnowledgeEntries(
    query: KnowledgeEntriesQuery,
    bearerToken: string,
  ): Promise<Record<string, unknown>> {
    const response = await this.fetchImpl(
      `${this.dependencies.apiBaseUrl}/v1/projects/${query.projectId}/knowledge-entries?${this.buildQuery({
        sourceJobId: query.sourceJobId,
        sourceType: query.sourceType,
        sourceAction: query.sourceAction,
        stageCode: query.stageCode,
        limit: query.limit?.toString(),
      }).toString()}`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${bearerToken}`,
        },
      },
    );

    const payload = (await response.json()) as
      | Record<string, unknown>
      | {
          error?: {
            code?: string;
            message?: string;
          };
        };

    if (!response.ok) {
      throw new AppError(
        response.status,
        (payload as { error?: { code?: string } }).error?.code ??
          "UPSTREAM_REQUEST_FAILED",
        (payload as { error?: { message?: string } }).error?.message ??
          "Failed to load knowledge entries",
      );
    }

    return payload as Record<string, unknown>;
  }

  async recalculateProject(
    input: {
      projectId: string;
      stageCode?: string;
      disciplineCode?: string;
      priceVersionId?: string;
      feeTemplateId?: string;
    },
    bearerToken: string,
  ): Promise<Record<string, unknown>> {
    const response = await this.fetchImpl(
      `${this.dependencies.apiBaseUrl}/v1/projects/${input.projectId}/recalculate`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${bearerToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          stageCode: input.stageCode,
          disciplineCode: input.disciplineCode,
          priceVersionId: input.priceVersionId,
          feeTemplateId: input.feeTemplateId,
        }),
      },
    );

    const payload = (await response.json()) as
      | Record<string, unknown>
      | {
          error?: {
            code?: string;
            message?: string;
          };
        };

    if (!response.ok) {
      throw new AppError(
        response.status,
        (payload as { error?: { code?: string } }).error?.code ??
          "UPSTREAM_REQUEST_FAILED",
        (payload as { error?: { message?: string } }).error?.message ??
          "Failed to recalculate project",
      );
    }

    return payload as Record<string, unknown>;
  }

  async fetchJobStatus(
    query: JobStatusQuery,
    bearerToken: string,
  ): Promise<Record<string, unknown>> {
    const response = await this.fetchImpl(
      `${this.dependencies.apiBaseUrl}/v1/jobs/${query.jobId}`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${bearerToken}`,
        },
      },
    );

    const payload = (await response.json()) as
      | Record<string, unknown>
      | {
          error?: {
            code?: string;
            message?: string;
          };
        };

    if (!response.ok) {
      throw new AppError(
        response.status,
        (payload as { error?: { code?: string } }).error?.code ??
          "UPSTREAM_REQUEST_FAILED",
        (payload as { error?: { message?: string } }).error?.message ??
          "Failed to load job status",
      );
    }

    return payload as Record<string, unknown>;
  }

  async fetchReviewSummary(
    query: ReviewSummaryQuery,
    bearerToken: string,
  ): Promise<Record<string, unknown>> {
    const response = await this.fetchImpl(
      `${this.dependencies.apiBaseUrl}/v1/projects/${query.projectId}/reviews?${this.buildQuery({
        billVersionId: query.billVersionId,
        stageCode: query.stageCode,
        disciplineCode: query.disciplineCode,
        status: query.status,
      }).toString()}`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${bearerToken}`,
        },
      },
    );

    const payload = (await response.json()) as
      | Record<string, unknown>
      | {
          error?: {
            code?: string;
            message?: string;
          };
        };

    if (!response.ok) {
      throw new AppError(
        response.status,
        (payload as { error?: { code?: string } }).error?.code ??
          "UPSTREAM_REQUEST_FAILED",
        (payload as { error?: { message?: string } }).error?.message ??
          "Failed to load review summary",
      );
    }

    return payload as Record<string, unknown>;
  }

  async fetchProcessDocumentSummary(
    query: ProcessDocumentSummaryQuery,
    bearerToken: string,
  ): Promise<Record<string, unknown>> {
    const response = await this.fetchImpl(
      `${this.dependencies.apiBaseUrl}/v1/projects/${query.projectId}/process-documents?${this.buildQuery({
        stageCode: query.stageCode,
        disciplineCode: query.disciplineCode,
        documentType: query.documentType,
        status: query.status,
      }).toString()}`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${bearerToken}`,
        },
      },
    );

    const payload = (await response.json()) as
      | Record<string, unknown>
      | {
          error?: {
            code?: string;
            message?: string;
          };
        };

    if (!response.ok) {
      throw new AppError(
        response.status,
        (payload as { error?: { code?: string } }).error?.code ??
          "UPSTREAM_REQUEST_FAILED",
        (payload as { error?: { message?: string } }).error?.message ??
          "Failed to load process document summary",
      );
    }

    return payload as Record<string, unknown>;
  }

  async exportSummaryReport(
    input: {
      projectId: string;
      reportType: "summary" | "variance";
      stageCode?: string;
      disciplineCode?: string;
    },
    bearerToken: string,
  ): Promise<Record<string, unknown>> {
    const response = await this.fetchImpl(
      `${this.dependencies.apiBaseUrl}/v1/reports/export`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${bearerToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(input),
      },
    );

    const payload = (await response.json()) as
      | Record<string, unknown>
      | {
          error?: {
            code?: string;
            message?: string;
          };
        };

    if (!response.ok) {
      throw new AppError(
        response.status,
        (payload as { error?: { code?: string } }).error?.code ??
          "UPSTREAM_REQUEST_FAILED",
        (payload as { error?: { message?: string } }).error?.message ??
          "Failed to export summary report",
      );
    }

    return payload as Record<string, unknown>;
  }

  async extractKnowledge(
    input: ExtractKnowledgeInput,
    bearerToken: string,
  ): Promise<Record<string, unknown>> {
    const response = await this.fetchImpl(
      `${this.dependencies.apiBaseUrl}/v1/ai-runtime/extract-jobs`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${bearerToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(input),
      },
    );

    const payload = (await response.json()) as
      | Record<string, unknown>
      | {
          error?: {
            code?: string;
            message?: string;
          };
        };

    if (!response.ok) {
      throw new AppError(
        response.status,
        (payload as { error?: { code?: string } }).error?.code ??
          "UPSTREAM_REQUEST_FAILED",
        (payload as { error?: { message?: string } }).error?.message ??
          "Failed to enqueue knowledge extraction job",
      );
    }

    return payload as Record<string, unknown>;
  }

  async extractKnowledgePreview(
    input: {
      source: string;
      events: Array<Record<string, unknown>>;
    },
    bearerToken: string,
  ): Promise<Record<string, unknown>> {
    const response = await this.fetchImpl(
      `${this.dependencies.apiBaseUrl}/v1/ai-runtime/extract-preview`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${bearerToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(input),
      },
    );

    const payload = (await response.json()) as
      | Record<string, unknown>
      | {
          error?: {
            code?: string;
            message?: string;
          };
        };

    if (!response.ok) {
      throw new AppError(
        response.status,
        (payload as { error?: { code?: string } }).error?.code ??
          "UPSTREAM_REQUEST_FAILED",
        (payload as { error?: { message?: string } }).error?.message ??
          "Failed to preview knowledge extraction",
      );
    }

    return payload as Record<string, unknown>;
  }

  async extractKnowledgeFromAudit(
    input: ExtractKnowledgeFromAuditInput,
    bearerToken: string,
  ): Promise<Record<string, unknown>> {
    const response = await this.fetchImpl(
      `${this.dependencies.apiBaseUrl}/v1/projects/${input.projectId}/ai-runtime/extract-from-audit`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${bearerToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          source: input.source,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          resourceIdPrefix: input.resourceIdPrefix,
          action: input.action,
          operatorId: input.operatorId,
          createdFrom: input.createdFrom,
          createdTo: input.createdTo,
          limit: input.limit,
        }),
      },
    );

    const payload = (await response.json()) as
      | Record<string, unknown>
      | {
          error?: {
            code?: string;
            message?: string;
          };
        };

    if (!response.ok) {
      throw new AppError(
        response.status,
        (payload as { error?: { code?: string } }).error?.code ??
          "UPSTREAM_REQUEST_FAILED",
        (payload as { error?: { message?: string } }).error?.message ??
          "Failed to enqueue audit-based knowledge extraction job",
      );
    }

    return payload as Record<string, unknown>;
  }

  async decideReview(
    input: DecideReviewInput,
    bearerToken: string,
  ): Promise<Record<string, unknown>> {
    const response = await this.fetchImpl(
      `${this.dependencies.apiBaseUrl}/v1/projects/${input.projectId}/reviews/${input.reviewSubmissionId}/${input.action}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${bearerToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          comment: input.comment,
          reason: input.reason,
        }),
      },
    );

    const payload = (await response.json()) as
      | Record<string, unknown>
      | {
          error?: {
            code?: string;
            message?: string;
          };
        };

    if (!response.ok) {
      throw new AppError(
        response.status,
        (payload as { error?: { code?: string } }).error?.code ??
          "UPSTREAM_REQUEST_FAILED",
        (payload as { error?: { message?: string } }).error?.message ??
          "Failed to decide review",
      );
    }

    return payload as Record<string, unknown>;
  }

  async updateProcessDocumentStatus(
    input: UpdateProcessDocumentStatusInput,
    bearerToken: string,
  ): Promise<Record<string, unknown>> {
    const response = await this.fetchImpl(
      `${this.dependencies.apiBaseUrl}/v1/projects/${input.projectId}/process-documents/${input.documentId}/status`,
      {
        method: "PUT",
        headers: {
          authorization: `Bearer ${bearerToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          status: input.status,
          comment: input.comment,
        }),
      },
    );

    const payload = (await response.json()) as
      | Record<string, unknown>
      | {
          error?: {
            code?: string;
            message?: string;
          };
        };

    if (!response.ok) {
      throw new AppError(
        response.status,
        (payload as { error?: { code?: string } }).error?.code ??
          "UPSTREAM_REQUEST_FAILED",
        (payload as { error?: { message?: string } }).error?.message ??
          "Failed to update process document status",
      );
    }

    return payload as Record<string, unknown>;
  }

  async fetchReportExportStatus(
    query: ReportExportStatusQuery,
    bearerToken: string,
  ): Promise<Record<string, unknown>> {
    const response = await this.fetchImpl(
      `${this.dependencies.apiBaseUrl}/v1/reports/export/${query.taskId}`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${bearerToken}`,
        },
      },
    );

    const payload = (await response.json()) as
      | Record<string, unknown>
      | {
          error?: {
            code?: string;
            message?: string;
          };
        };

    if (!response.ok) {
      throw new AppError(
        response.status,
        (payload as { error?: { code?: string } }).error?.code ??
          "UPSTREAM_REQUEST_FAILED",
        (payload as { error?: { message?: string } }).error?.message ??
          "Failed to load report export status",
      );
    }

    return payload as Record<string, unknown>;
  }

  async fetchImportTasks(
    query: ImportFailureContextQuery,
    bearerToken: string,
  ): Promise<Record<string, unknown>> {
    const response = await this.fetchImpl(
      `${this.dependencies.apiBaseUrl}/v1/projects/${query.projectId}/import-tasks`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${bearerToken}`,
        },
      },
    );

    const payload = (await response.json()) as
      | Record<string, unknown>
      | {
          error?: {
            code?: string;
            message?: string;
          };
        };

    if (!response.ok) {
      throw new AppError(
        response.status,
        (payload as { error?: { code?: string } }).error?.code ??
          "UPSTREAM_REQUEST_FAILED",
        (payload as { error?: { message?: string } }).error?.message ??
          "Failed to load import tasks",
      );
    }

    return payload as Record<string, unknown>;
  }

  async retryImportFailureScope(
    input: RetryImportFailureScopeInput,
    bearerToken: string,
  ): Promise<Record<string, unknown>> {
    const response = await this.fetchImpl(
      `${this.dependencies.apiBaseUrl}/v1/jobs/${input.jobId}/retry`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${bearerToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          failureReason: input.failureReason,
          failureResourceType: input.failureResourceType,
          failureAction: input.failureAction,
        }),
      },
    );

    const payload = (await response.json()) as
      | Record<string, unknown>
      | {
          error?: {
            code?: string;
            message?: string;
          };
        };

    if (!response.ok) {
      throw new AppError(
        response.status,
        (payload as { error?: { code?: string } }).error?.code ??
          "UPSTREAM_REQUEST_FAILED",
        (payload as { error?: { message?: string } }).error?.message ??
          "Failed to retry import failure scope",
      );
    }

    return payload as Record<string, unknown>;
  }

  private buildQuery(input: Record<string, string | undefined>): URLSearchParams {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(input)) {
      if (value) {
        search.set(key, value);
      }
    }
    return search;
  }
}
