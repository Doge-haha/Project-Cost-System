import { getRuntimeConfig } from "./config";
import type {
  AuditLogListResponse,
  AiRecommendation,
  AiRecommendationListResponse,
  AiRecommendationStatus,
  AiRecommendationType,
  BackgroundJob,
  BackgroundJobListResponse,
  BillItem,
  BillVersion,
  CreateReportExportResponse,
  FeeTemplate,
  ImportTaskListResponse,
  KnowledgeEntryListResponse,
  MemoryEntryListResponse,
  ProcessDocumentListResponse,
  PriceVersion,
  ProjectDiscipline,
  ProjectListItem,
  ProjectMember,
  ProjectQuotaLine,
  ProjectStage,
  ProjectWorkspace,
  QuotaSourceCandidate,
  QuotaLineValidationResult,
  ReportExportTask,
  ReviewSubmissionListResponse,
  SummaryDetailItem,
  SummaryResponse,
  VarianceBreakdownGroupBy,
  VarianceBreakdownResponse,
  VersionCompareResponse,
} from "./types";

type QueryValue = string | number | undefined | null;
type HttpMethod = "GET" | "POST" | "PUT";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

function createUrl(path: string, query?: Record<string, QueryValue>) {
  const runtimeConfig = getRuntimeConfig();
  const url = new URL(path, runtimeConfig.apiBaseUrl);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

async function request<T>(
  path: string,
  query?: Record<string, QueryValue>,
  options?: {
    method?: HttpMethod;
    body?: unknown;
  },
): Promise<T> {
  const runtimeConfig = getRuntimeConfig();
  const response = await fetch(createUrl(path, query), {
    method: options?.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(runtimeConfig.apiBearerToken
        ? {
            authorization: `Bearer ${runtimeConfig.apiBearerToken}`,
          }
        : {}),
    },
    body:
      options?.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    let code: string | undefined;
    try {
      const payload = (await response.json()) as {
        error?: {
          code?: string;
          message?: string;
        };
      };
      if (payload.error?.message) {
        message = payload.error.message;
      }
      code = payload.error?.code;
    } catch {
      // Ignore JSON parsing failures and keep the default message.
    }
    throw new ApiError(message, response.status, code);
  }

  return (await response.json()) as T;
}

async function requestBlob(
  path: string,
  query?: Record<string, QueryValue>,
): Promise<{
  blob: Blob;
  fileName: string;
}> {
  const runtimeConfig = getRuntimeConfig();
  const response = await fetch(createUrl(path, query), {
    method: "GET",
    headers: {
      ...(runtimeConfig.apiBearerToken
        ? {
            authorization: `Bearer ${runtimeConfig.apiBearerToken}`,
          }
        : {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    let code: string | undefined;
    try {
      const payload = (await response.json()) as {
        error?: {
          code?: string;
          message?: string;
        };
      };
      if (payload.error?.message) {
        message = payload.error.message;
      }
      code = payload.error?.code;
    } catch {
      // Ignore JSON parsing failures and keep the default message.
    }
    throw new ApiError(message, response.status, code);
  }

  const contentDisposition = response.headers.get("content-disposition") ?? "";
  const matchedFileName = /filename="([^"]+)"/.exec(contentDisposition)?.[1];

  return {
    blob: await response.blob(),
    fileName: matchedFileName ?? "download.json",
  };
}

function triggerBlobDownload(input: { blob: Blob; fileName: string }) {
  const downloadUrl = window.URL.createObjectURL(input.blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = input.fileName;
  anchor.click();
  window.URL.revokeObjectURL(downloadUrl);
}

function normalizeBillVersion(
  input: Partial<BillVersion> & {
    versionStatus?: string;
  },
): BillVersion {
  return {
    id: input.id ?? "",
    versionName: input.versionName ?? "",
    stageCode: input.stageCode ?? "",
    disciplineCode: input.disciplineCode ?? "",
    status: input.status ?? input.versionStatus ?? "",
    itemCount: input.itemCount,
  };
}

export const apiClient = {
  listProjects() {
    return request<{ items: ProjectListItem[] }>("/v1/projects");
  },
  getProject(projectId: string) {
    return request<ProjectListItem>(`/v1/projects/${projectId}`);
  },
  listProjectStages(projectId: string) {
    return request<{ items: ProjectStage[] }>(`/v1/projects/${projectId}/stages`);
  },
  listProjectDisciplines(projectId: string) {
    return request<{ items: ProjectDiscipline[] }>(
      `/v1/projects/${projectId}/disciplines`,
    );
  },
  listProjectMembers(projectId: string) {
    return request<{ items: ProjectMember[] }>(`/v1/projects/${projectId}/members`);
  },
  async getProjectWorkspace(projectId: string) {
    const workspace = await request<ProjectWorkspace>(`/v1/projects/${projectId}/workspace`);
    return {
      ...workspace,
      billVersions: workspace.billVersions.map((version) => normalizeBillVersion(version)),
    };
  },
  async listBillVersions(projectId: string) {
    const response = await request<{ items: BillVersion[] }>(
      `/v1/projects/${projectId}/bill-versions`,
    );
    return {
      ...response,
      items: response.items.map((version) => normalizeBillVersion(version)),
    };
  },
  lockBillVersion(projectId: string, billVersionId: string) {
    return request<BillVersion>(
      `/v1/projects/${projectId}/bill-versions/${billVersionId}/lock`,
      undefined,
      {
        method: "POST",
        body: {},
      },
    );
  },
  unlockBillVersion(projectId: string, billVersionId: string, reason: string) {
    return request<BillVersion>(
      `/v1/projects/${projectId}/bill-versions/${billVersionId}/unlock`,
      undefined,
      {
        method: "POST",
        body: { reason },
      },
    );
  },
  listProjectReviews(projectId: string) {
    return request<ReviewSubmissionListResponse>(`/v1/projects/${projectId}/reviews`);
  },
  approveReview(projectId: string, reviewSubmissionId: string, comment?: string) {
    return request(
      `/v1/projects/${projectId}/reviews/${reviewSubmissionId}/approve`,
      undefined,
      {
        method: "POST",
        body: comment ? { comment } : {},
      },
    );
  },
  rejectReview(
    projectId: string,
    reviewSubmissionId: string,
    reason: string,
    comment?: string,
  ) {
    return request(
      `/v1/projects/${projectId}/reviews/${reviewSubmissionId}/reject`,
      undefined,
      {
        method: "POST",
        body: {
          reason,
          ...(comment ? { comment } : {}),
        },
      },
    );
  },
  cancelReview(projectId: string, reviewSubmissionId: string, comment?: string) {
    return request(
      `/v1/projects/${projectId}/reviews/${reviewSubmissionId}/cancel`,
      undefined,
      {
        method: "POST",
        body: comment ? { comment } : {},
      },
    );
  },
  listProcessDocuments(projectId: string) {
    return request<ProcessDocumentListResponse>(
      `/v1/projects/${projectId}/process-documents`,
    );
  },
  updateProcessDocumentStatus(
    projectId: string,
    documentId: string,
    status: "draft" | "submitted" | "approved" | "rejected" | "settled",
    comment?: string,
  ) {
    return request(
      `/v1/projects/${projectId}/process-documents/${documentId}/status`,
      undefined,
      {
        method: "PUT",
        body: comment ? { status, comment } : { status },
      },
    );
  },
  listBackgroundJobs(projectId: string) {
    return request<BackgroundJobListResponse>("/v1/jobs", { projectId });
  },
  listProjectAuditLogs(
    projectId: string,
    query?: {
      limit?: number;
      resourceType?: string;
      resourceId?: string;
      resourceIdPrefix?: string;
      action?: string;
      operatorId?: string;
      createdFrom?: string;
      createdTo?: string;
    },
  ) {
    return request<AuditLogListResponse>(`/v1/projects/${projectId}/audit-logs`, {
      limit: query?.limit,
      resourceType: query?.resourceType,
      resourceId: query?.resourceId,
      resourceIdPrefix: query?.resourceIdPrefix,
      action: query?.action,
      operatorId: query?.operatorId,
      createdFrom: query?.createdFrom,
      createdTo: query?.createdTo,
    });
  },
  getBackgroundJob(jobId: string) {
    return request(`/v1/jobs/${jobId}`);
  },
  listKnowledgeEntries(
    projectId: string,
    query?: {
      sourceJobId?: string;
      sourceType?: string;
      sourceAction?: string;
      stageCode?: string;
      limit?: number;
    },
  ) {
    return request<KnowledgeEntryListResponse>(
      `/v1/projects/${projectId}/knowledge-entries`,
      {
        sourceJobId: query?.sourceJobId,
        sourceType: query?.sourceType,
        sourceAction: query?.sourceAction,
        stageCode: query?.stageCode,
        limit: query?.limit,
      },
    );
  },
  searchKnowledgeEntries(
    projectId: string,
    query: {
      q: string;
      sourceType?: string;
      stageCode?: string;
      limit?: number;
    },
  ) {
    return request<KnowledgeEntryListResponse>(
      `/v1/projects/${projectId}/knowledge-search`,
      {
        q: query.q,
        sourceType: query.sourceType,
        stageCode: query.stageCode,
        limit: query.limit,
      },
    );
  },
  listMemoryEntries(
    projectId: string,
    query?: {
      sourceJobId?: string;
      subjectType?: string;
      subjectId?: string;
      stageCode?: string;
      limit?: number;
    },
  ) {
    return request<MemoryEntryListResponse>(
      `/v1/projects/${projectId}/memory-entries`,
      {
        sourceJobId: query?.sourceJobId,
        subjectType: query?.subjectType,
        subjectId: query?.subjectId,
        stageCode: query?.stageCode,
        limit: query?.limit,
      },
    );
  },
  listAiRecommendations(
    projectId: string,
    query?: {
      recommendationType?: AiRecommendationType;
      resourceType?: string;
      resourceId?: string;
      status?: AiRecommendationStatus;
      stageCode?: string;
      disciplineCode?: string;
      limit?: number;
    },
  ) {
    return request<AiRecommendationListResponse>(
      `/v1/projects/${projectId}/ai/recommendations`,
      {
        recommendationType: query?.recommendationType,
        resourceType: query?.resourceType,
        resourceId: query?.resourceId,
        status: query?.status,
        stageCode: query?.stageCode,
        disciplineCode: query?.disciplineCode,
        limit: query?.limit,
      },
    );
  },
  acceptAiRecommendation(recommendationId: string, reason?: string) {
    return request<AiRecommendation>(
      `/v1/ai/recommendations/${recommendationId}/accept`,
      undefined,
      {
        method: "POST",
        body: reason ? { reason } : {},
      },
    );
  },
  ignoreAiRecommendation(recommendationId: string, reason?: string) {
    return request<AiRecommendation>(
      `/v1/ai/recommendations/${recommendationId}/ignore`,
      undefined,
      {
        method: "POST",
        body: reason ? { reason } : {},
      },
    );
  },
  listProjectBackgroundJobs(
    projectId: string,
    query?: {
      status?: "queued" | "processing" | "completed" | "failed";
      jobType?: "report_export" | "project_recalculate" | "knowledge_extraction";
    },
  ) {
    return request<BackgroundJobListResponse>("/v1/jobs", {
      projectId,
      status: query?.status,
      jobType: query?.jobType,
    });
  },
  listProjectImportTasks(projectId: string) {
    return request<ImportTaskListResponse>(`/v1/projects/${projectId}/import-tasks`);
  },
  async downloadImportTaskErrorReport(
    projectId: string,
    taskId: string,
    failureReason?: string | null,
    format?: "json" | "csv",
  ) {
    const download = await requestBlob(
      `/v1/projects/${projectId}/import-tasks/${taskId}/error-report`,
      {
        failureReason,
        format,
      },
    );
    triggerBlobDownload(download);
  },
  uploadProjectImportFile(input: {
    projectId: string;
    fileName: string;
    fileContent: string;
    sourceType?: string;
    sourceLabel?: string;
  }) {
    return request<{ task: { id: string }; job: { id: string }; eventCount: number }>(
      `/v1/projects/${input.projectId}/import-tasks/upload`,
      undefined,
      {
        method: "POST",
        body: {
          fileName: input.fileName,
          fileContent: input.fileContent,
          sourceType: input.sourceType,
          sourceLabel: input.sourceLabel,
        },
      },
    );
  },
  retryBackgroundJob(
    jobId: string,
    retryContext?: {
      failureReason?: string | null;
      failureResourceType?: string | null;
      failureAction?: string | null;
    },
  ) {
    return request(`/v1/jobs/${jobId}/retry`, undefined, {
      method: "POST",
      body: {
        failureReason: retryContext?.failureReason,
        failureResourceType: retryContext?.failureResourceType,
        failureAction: retryContext?.failureAction,
      },
    });
  },
  listBillItems(projectId: string, billVersionId: string) {
    return request<{ items: BillItem[] }>(
      `/v1/projects/${projectId}/bill-versions/${billVersionId}/items`,
    );
  },
  listProjectQuotaLines(projectId: string) {
    return request<{ items: ProjectQuotaLine[] }>(
      `/v1/projects/${projectId}/quota-lines`,
    );
  },
  listQuotaSourceCandidates(
    projectId: string,
    query?: {
      standardSetCode?: string;
      disciplineCode?: string;
      keyword?: string;
      chapterCode?: string;
    },
  ) {
    return request<{ items: QuotaSourceCandidate[] }>(
      `/v1/projects/${projectId}/quota-lines/candidates`,
      {
        standardSetCode: query?.standardSetCode,
        disciplineCode: query?.disciplineCode,
        keyword: query?.keyword,
        chapterCode: query?.chapterCode,
      },
    );
  },
  batchCreateQuotaLines(input: {
    projectId: string;
    items: Array<{
      billVersionId: string;
      billItemId: string;
      sourceStandardSetCode: string;
      sourceQuotaId: string;
      sourceSequence?: number | null;
      chapterCode: string;
      quotaCode: string;
      quotaName: string;
      unit: string;
      quantity: number;
      laborFee?: number | null;
      materialFee?: number | null;
      machineFee?: number | null;
      contentFactor?: number;
      sourceMode: "manual" | "ai" | "history_reference";
    }>;
  }) {
    return request<{ items: ProjectQuotaLine[] }>(
      `/v1/projects/${input.projectId}/quota-lines/batch-create`,
      undefined,
      {
        method: "POST",
        body: {
          items: input.items,
        },
      },
    );
  },
  validateProjectQuotaLines(projectId: string) {
    return request<QuotaLineValidationResult>(
      `/v1/projects/${projectId}/quota-lines/validate`,
      undefined,
      {
        method: "POST",
        body: {},
      },
    );
  },
  listPriceVersions(query?: {
    regionCode?: string;
    disciplineCode?: string;
    status?: PriceVersion["status"];
  }) {
    return request<{ items: PriceVersion[] }>("/v1/price-versions", {
      regionCode: query?.regionCode,
      disciplineCode: query?.disciplineCode,
      status: query?.status,
    });
  },
  listFeeTemplates(query?: {
    regionCode?: string;
    projectType?: string;
    stageCode?: string;
    status?: FeeTemplate["status"];
  }) {
    return request<{ items: FeeTemplate[] }>("/v1/fee-templates", {
      regionCode: query?.regionCode,
      projectType: query?.projectType,
      stageCode: query?.stageCode,
      status: query?.status,
    });
  },
  updateProjectDefaultPriceVersion(projectId: string, defaultPriceVersionId: string | null) {
    return request<ProjectListItem>(
      `/v1/projects/${projectId}/default-price-version`,
      undefined,
      {
        method: "PUT",
        body: { defaultPriceVersionId },
      },
    );
  },
  updateProjectDefaultFeeTemplate(projectId: string, defaultFeeTemplateId: string | null) {
    return request<ProjectListItem>(
      `/v1/projects/${projectId}/default-fee-template`,
      undefined,
      {
        method: "PUT",
        body: { defaultFeeTemplateId },
      },
    );
  },
  recalculateBillVersion(input: {
    projectId: string;
    billVersionId: string;
    priceVersionId?: string;
    feeTemplateId?: string;
  }) {
    return request<{
      recalculatedCount: number;
      skippedItems: Array<{
        billItemId: string;
        reason: string;
      }>;
    }>(
      `/v1/projects/${input.projectId}/bill-versions/${input.billVersionId}/recalculate`,
      undefined,
      {
        method: "POST",
        body: {
          priceVersionId: input.priceVersionId,
          feeTemplateId: input.feeTemplateId,
        },
      },
    );
  },
  recalculateProject(input: {
    projectId: string;
    stageCode?: string;
    disciplineCode?: string;
    priceVersionId?: string;
    feeTemplateId?: string;
  }) {
    return request<BackgroundJob>(`/v1/projects/${input.projectId}/recalculate`, undefined, {
      method: "POST",
      body: {
        stageCode: input.stageCode,
        disciplineCode: input.disciplineCode,
        priceVersionId: input.priceVersionId,
        feeTemplateId: input.feeTemplateId,
      },
    });
  },
  calculateBillItem(input: {
    billItemId: string;
    priceVersionId?: string;
    feeTemplateId?: string;
  }) {
    return request<{
      billItemId: string;
      systemUnitPrice: number;
      finalUnitPrice: number;
      systemAmount: number;
      finalAmount: number;
    }>("/v1/engine/calculate", undefined, {
      method: "POST",
      body: {
        billItemId: input.billItemId,
        priceVersionId: input.priceVersionId,
        feeTemplateId: input.feeTemplateId,
      },
    });
  },
  updateBillItemManualPricing(input: {
    projectId: string;
    billVersionId: string;
    itemId: string;
    manualUnitPrice: number | null;
    reason: string;
  }) {
    return request<BillItem>(
      `/v1/projects/${input.projectId}/bill-versions/${input.billVersionId}/items/${input.itemId}/manual-pricing`,
      undefined,
      {
        method: "PUT",
        body: {
          manualUnitPrice: input.manualUnitPrice,
          reason: input.reason,
        },
      },
    );
  },
  getSummary(
    projectId: string,
    query?: {
      billVersionId?: string;
      stageCode?: string;
      disciplineCode?: string;
      unitCode?: string;
      taxMode?: "tax_included" | "tax_excluded";
    },
  ) {
    return request<SummaryResponse>("/v1/reports/summary", {
      projectId,
      billVersionId: query?.billVersionId,
      stageCode: query?.stageCode,
      disciplineCode: query?.disciplineCode,
      unitCode: query?.unitCode,
      taxMode: query?.taxMode,
    });
  },
  getSummaryDetails(
    projectId: string,
    query?: {
      billVersionId?: string;
      stageCode?: string;
      disciplineCode?: string;
      unitCode?: string;
      taxMode?: "tax_included" | "tax_excluded";
    },
  ) {
    return request<{ items: SummaryDetailItem[] }>("/v1/reports/summary/details", {
      projectId,
      billVersionId: query?.billVersionId,
      stageCode: query?.stageCode,
      disciplineCode: query?.disciplineCode,
      unitCode: query?.unitCode,
      taxMode: query?.taxMode,
      limit: 10,
    });
  },
  getVarianceBreakdown(
    projectId: string,
    groupBy: VarianceBreakdownGroupBy,
    query?: {
      billVersionId?: string;
      stageCode?: string;
      disciplineCode?: string;
      unitCode?: string;
    },
  ) {
    return request<VarianceBreakdownResponse>("/v1/reports/variance-breakdown", {
      projectId,
      groupBy,
      billVersionId: query?.billVersionId,
      stageCode: query?.stageCode,
      disciplineCode: query?.disciplineCode,
      unitCode: query?.unitCode,
    });
  },
  getVersionCompare(
    projectId: string,
    baseBillVersionId: string,
    targetBillVersionId: string,
  ) {
    return request<VersionCompareResponse>("/v1/reports/version-compare", {
      projectId,
      baseBillVersionId,
      targetBillVersionId,
    });
  },
  createReportExportTask(input: {
    projectId: string;
    reportType: "summary" | "variance";
    stageCode?: string;
    disciplineCode?: string;
  }) {
    return request<CreateReportExportResponse>("/v1/reports/export", undefined, {
      method: "POST",
      body: input,
    });
  },
  getReportExportTask(taskId: string) {
    return request<ReportExportTask>(`/v1/reports/export/${taskId}`);
  },
  async downloadReportExportTask(taskId: string) {
    const download = await requestBlob(`/v1/reports/export/${taskId}/download`);
    triggerBlobDownload(download);
  },
};
