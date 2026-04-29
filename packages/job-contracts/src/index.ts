export const executableBackgroundJobTypes = [
  "report_export",
  "project_recalculate",
  "knowledge_extraction",
] as const;

export type BackgroundJobType = (typeof executableBackgroundJobTypes)[number];

export const backgroundJobStatuses = [
  "queued",
  "processing",
  "completed",
  "failed",
] as const;

export type BackgroundJobStatus = (typeof backgroundJobStatuses)[number];

export type ReportExportJobPayload = {
  projectId: string;
  reportType: "summary" | "variance" | "stage_bill";
  reportExportTaskId?: string | null;
  stageCode?: string | null;
  disciplineCode?: string | null;
  reportTemplateId?: string | null;
  outputFormat?: "json" | "excel" | "pdf" | null;
};

export type ProjectRecalculateJobPayload = {
  projectId: string;
  stageCode?: string | null;
  disciplineCode?: string | null;
  priceVersionId?: string | null;
  feeTemplateId?: string | null;
  roleCodes?: string[];
};

export type KnowledgeExtractionJobPayload = {
  projectId: string;
  source: string;
  sourceLabel?: string | null;
  importTaskId?: string | null;
  events: Array<Record<string, unknown>>;
  retryEvents?: Array<Record<string, unknown>>;
  retryContext?: {
    failureReason?: string | null;
    failureResourceType?: string | null;
    failureAction?: string | null;
  } | null;
};

export type BackgroundJobPayloadMap = {
  report_export: ReportExportJobPayload;
  project_recalculate: ProjectRecalculateJobPayload;
  knowledge_extraction: KnowledgeExtractionJobPayload;
};

export type BackgroundJobPayload = BackgroundJobPayloadMap[BackgroundJobType];

export type BackgroundJobRecord<
  TJobType extends BackgroundJobType = BackgroundJobType,
  TResult extends Record<string, unknown> = Record<string, unknown>,
> = {
  id: string;
  jobType: TJobType;
  status: BackgroundJobStatus;
  requestedBy: string;
  projectId?: string | null;
  payload: BackgroundJobPayloadMap[TJobType];
  result?: TResult | null;
  errorMessage?: string | null;
  createdAt: string;
  completedAt?: string | null;
};

export type BackgroundJobProcessorResult = {
  status: "completed" | "failed";
  result?: Record<string, unknown>;
  errorMessage?: string;
};
