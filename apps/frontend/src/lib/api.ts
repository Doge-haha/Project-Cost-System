import { getRuntimeConfig } from "./config";
import type {
  AuditLogListResponse,
  BackgroundJobListResponse,
  BillItem,
  BillVersion,
  ImportTaskListResponse,
  ProcessDocumentListResponse,
  ProjectDiscipline,
  ProjectListItem,
  ProjectMember,
  ProjectStage,
  ProjectWorkspace,
  ReviewSubmissionListResponse,
  SummaryDetailItem,
  SummaryResponse,
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
      action?: string;
    },
  ) {
    return request<AuditLogListResponse>(`/v1/projects/${projectId}/audit-logs`, {
      limit: query?.limit,
      resourceType: query?.resourceType,
      action: query?.action,
    });
  },
  getBackgroundJob(jobId: string) {
    return request(`/v1/jobs/${jobId}`);
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
  getSummary(projectId: string, billVersionId?: string) {
    return request<SummaryResponse>("/v1/reports/summary", {
      projectId,
      billVersionId,
    });
  },
  getSummaryDetails(projectId: string, billVersionId?: string) {
    return request<{ items: SummaryDetailItem[] }>("/v1/reports/summary/details", {
      projectId,
      billVersionId,
      limit: 10,
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
};
