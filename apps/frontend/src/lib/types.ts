export type ProjectListItem = {
  id: string;
  code: string;
  name: string;
  status: string;
  defaultPriceVersionId?: string | null;
  defaultFeeTemplateId?: string | null;
};

export type ProjectStage = {
  id: string;
  stageCode: string;
  stageName: string;
  status: string;
  sequenceNo: number;
};

export type ProjectDiscipline = {
  id: string;
  disciplineCode: string;
  disciplineName: string;
  status: string;
};

export type ProjectMember = {
  id: string;
  userId: string;
  displayName: string;
  roleCode: string;
  scopes?: Array<{
    scopeType: string;
    scopeValue: string;
  }>;
};

export type BillVersion = {
  id: string;
  versionName: string;
  stageCode: string;
  disciplineCode: string;
  status: string;
  itemCount?: number;
};

export type ProjectWorkspace = {
  project: ProjectListItem;
  currentStage: ProjectStage | null;
  availableStages: ProjectStage[];
  disciplines: ProjectDiscipline[];
  billVersions: BillVersion[];
  todoSummary: {
    totalCount: number;
    pendingReviewCount: number;
    pendingProcessDocumentCount: number;
    draftProcessDocumentCount: number;
    items: string[];
  };
  riskSummary: {
    totalCount: number;
    rejectedReviewCount: number;
    rejectedProcessDocumentCount: number;
    failedJobCount: number;
    items: string[];
  };
  importStatus: {
    mode: string;
    totalCount: number;
    queuedCount: number;
    processingCount: number;
    completedCount: number;
    failedCount: number;
    latestTask: {
      id: string;
      sourceType: string;
      sourceLabel: string;
      status: string;
      createdAt: string;
    } | null;
    note: string;
  };
  currentUser: {
    userId: string;
    displayName: string;
    memberId: string | null;
    permissionSummary: {
      roleCode: string;
      roleLabel: string;
      canManageProject: boolean;
      canEditProject: boolean;
      canExportReports?: boolean;
      canImportBill?: boolean;
      scopeSummary: string[];
      visibleStageCodes: string[];
      visibleDisciplineCodes: string[];
    };
  };
};

export type ReviewSubmission = {
  id: string;
  billVersionId: string;
  stageCode: string;
  disciplineCode: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  submittedBy: string;
  submittedAt: string;
  submissionComment?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewComment?: string | null;
  rejectionReason?: string | null;
  billVersionSummary: {
    versionName: string;
    versionNo: number;
    versionStatus: string;
  };
  canApprove: boolean;
  canReject: boolean;
  canCancel: boolean;
};

export type ReviewSubmissionListResponse = {
  items: ReviewSubmission[];
  summary: {
    totalCount: number;
    statusCounts: Record<ReviewSubmission["status"], number>;
    actionableCount: number;
  };
};

export type ProcessDocument = {
  id: string;
  stageCode: string;
  disciplineCode: string;
  documentType: "change_order" | "site_visa" | "progress_payment";
  status: "draft" | "submitted" | "approved" | "rejected" | "settled";
  title: string;
  referenceNo: string;
  amount: number;
  submittedBy: string;
  submittedAt: string;
  lastComment?: string | null;
  stageName: string;
  disciplineName: string;
  isEditable: boolean;
  isReviewable: boolean;
};

export type ProcessDocumentListResponse = {
  items: ProcessDocument[];
  summary: {
    totalCount: number;
    statusCounts: Record<ProcessDocument["status"], number>;
    documentTypeCounts: Record<ProcessDocument["documentType"], number>;
  };
};

export type BackgroundJob = {
  id: string;
  jobType: string;
  status: "queued" | "processing" | "completed" | "failed";
  requestedBy: string;
  projectId?: string | null;
  payload: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  errorMessage?: string | null;
  createdAt: string;
  completedAt?: string | null;
};

export type BackgroundJobListResponse = {
  items: BackgroundJob[];
  summary: {
    totalCount: number;
    statusCounts: Record<BackgroundJob["status"], number>;
    jobTypeCounts: Record<BackgroundJob["jobType"], number>;
  };
};

export type ImportTask = {
  id: string;
  projectId: string;
  sourceType: string;
  sourceLabel: string;
  sourceFileName?: string | null;
  sourceBatchNo?: string | null;
  status: "queued" | "processing" | "completed" | "failed";
  requestedBy: string;
  totalItemCount: number;
  importedItemCount: number;
  memoryItemCount: number;
  failedItemCount: number;
  latestJobId?: string | null;
  latestErrorMessage?: string | null;
  failureDetails: string[];
  retryCount: number;
  retryLimit: number;
  canRetry: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  completedAt?: string | null;
};

export type ImportTaskListResponse = {
  items: ImportTask[];
  summary: {
    totalCount: number;
    statusCounts: Record<ImportTask["status"], number>;
  };
};

export type SourceBillImportResult = {
  billVersion: BillVersion;
  importTask: ImportTask;
  summary: {
    versionCount: number;
    billItemCount: number;
    workItemCount: number;
    failedItemCount: number;
    measureItemCount: number;
    feeItemCount: number;
    featureItemCount: number;
    quotaClueCount: number;
    failureDetails: string[];
  };
  failedItems?: SourceBillFailureItem[];
};

export type SourceBillFailureItem = {
  lineNo: number | null;
  tableName: string;
  sourceId: string | null;
  itemCode: string | null;
  reasonCode: string;
  reasonLabel: string;
  errorMessage: string;
  projectId: string | null;
  resourceType: string | null;
  action: string | null;
  keys: string[];
};

export type SourceBillImportPreview = {
  summary: SourceBillImportResult["summary"];
  failedItems: SourceBillFailureItem[];
};

export type AuditLogRecord = {
  id: string;
  projectId: string;
  stageCode?: string | null;
  resourceType: string;
  resourceId: string;
  action: string;
  operatorId: string;
  beforePayload?: Record<string, unknown> | null;
  afterPayload?: Record<string, unknown> | null;
  createdAt: string;
};

export type AuditLogListResponse = {
  items: AuditLogRecord[];
};

export type KnowledgeEntry = {
  id: string;
  projectId: string;
  stageCode?: string | null;
  sourceJobId?: string | null;
  sourceType: string;
  sourceAction: string;
  title: string;
  summary: string;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type KnowledgeEntryListResponse = {
  items: KnowledgeEntry[];
  summary: {
    totalCount: number;
    sourceTypeCounts: Record<string, number>;
    sourceActionCounts: Record<string, number>;
    stageCounts: Record<string, number>;
  };
};

export type MemoryEntry = {
  id: string;
  projectId: string;
  stageCode?: string | null;
  sourceJobId?: string | null;
  memoryKey: string;
  subjectType: string;
  subjectId: string;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type MemoryEntryListResponse = {
  items: MemoryEntry[];
  summary: {
    totalCount: number;
    subjectTypeCounts: Record<string, number>;
    stageCounts: Record<string, number>;
  };
};

export type AiRecommendationStatus =
  | "generated"
  | "accepted"
  | "ignored"
  | "expired";

export type AiRecommendationType =
  | "bill_recommendation"
  | "quota_recommendation"
  | "variance_warning";

export type AiRecommendation = {
  id: string;
  projectId: string;
  stageCode?: string | null;
  disciplineCode?: string | null;
  resourceType: string;
  resourceId: string;
  recommendationType: AiRecommendationType;
  inputPayload: Record<string, unknown>;
  outputPayload: Record<string, unknown>;
  status: AiRecommendationStatus;
  createdBy: string;
  handledBy?: string | null;
  handledAt?: string | null;
  statusReason?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiRecommendationListResponse = {
  items: AiRecommendation[];
  summary: {
    totalCount: number;
    statusCounts: Record<AiRecommendationStatus, number>;
    typeCounts: Record<AiRecommendationType, number>;
  };
};

export type BillItem = {
  id: string;
  parentId?: string | null;
  code: string;
  name: string;
  level: number;
  quantity: number | string;
  unit: string;
  sortNo?: number;
  compositeUnitPrice?: number | string | null;
  systemUnitPrice?: number | string | null;
  manualUnitPrice?: number | string | null;
  finalUnitPrice?: number | string | null;
  finalAmount?: number | string | null;
  systemAmount?: number | string | null;
  children?: BillItem[];
};

export type ProjectQuotaLine = {
  id: string;
  billItemId: string;
  billVersionId: string;
  stageCode: string;
  disciplineCode: string;
  billItemCode: string;
  billItemName: string;
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
  contentFactor: number;
  sourceMode: "manual" | "ai" | "history_reference" | "reference_knowledge";
};

export type QuotaSourceCandidate = {
  sourceStandardSetCode: string;
  sourceQuotaId: string;
  sourceSequence?: number | null;
  chapterCode: string;
  quotaCode: string;
  quotaName: string;
  unit: string;
  laborFee?: number | null;
  materialFee?: number | null;
  machineFee?: number | null;
  sourceMode: "manual" | "ai" | "history_reference" | "reference_knowledge";
  sourceDataset: string;
  sourceRegion?: string | null;
  workContentSummary?: string | null;
  resourceCompositionSummary?: string | null;
  matchReason?: string | null;
  matchScore?: number | null;
};

export type QuotaLineValidationIssue = {
  code: "MISSING_QUOTA_LINES" | "UNIT_MISMATCH";
  severity: "warning";
  message: string;
  billVersionId: string;
  billItemId: string;
  billItemCode: string;
  billItemName: string;
  quotaLineId?: string;
  quotaCode?: string;
  billItemUnit?: string;
  quotaUnit?: string;
};

export type QuotaLineValidationResult = {
  passed: boolean;
  issueCount: number;
  issues: QuotaLineValidationIssue[];
};

export type PriceVersion = {
  id: string;
  versionCode: string;
  versionName: string;
  regionCode: string;
  disciplineCode: string;
  status: "active" | "inactive";
};

export type FeeTemplate = {
  id: string;
  templateName: string;
  projectType?: string | null;
  regionCode?: string | null;
  stageScope: string[];
  taxMode: string;
  allocationMode: string;
  status: "draft" | "active" | "inactive";
};

export type SummaryResponse = {
  totalSystemAmount?: number | string | null;
  totalFinalAmount?: number | string | null;
  varianceAmount?: number | string | null;
  varianceRate?: number | string | null;
  taxMode?: "tax_included" | "tax_excluded";
  totalTaxAmount?: number | string | null;
  itemCount?: number;
  billVersionCount?: number;
};

export type SummaryDetailItem = {
  itemId: string;
  itemCode: string;
  itemName: string;
  systemAmount?: number | string | null;
  finalAmount?: number | string | null;
  varianceAmount?: number | string | null;
  varianceRate?: number | string | null;
  varianceShare?: number | string | null;
  taxAmount?: number | string | null;
};

export type VarianceBreakdownGroupBy = "discipline" | "unit";

export type VarianceBreakdownItem = {
  groupKey: string;
  groupLabel: string;
  versionCount: number;
  itemCount: number;
  totalSystemAmount: number;
  totalFinalAmount: number;
  varianceAmount: number;
  varianceRate: number;
  varianceShare: number;
};

export type VarianceBreakdownResponse = {
  projectId: string;
  groupBy: VarianceBreakdownGroupBy;
  billVersionId: string | null;
  stageCode: string | null;
  disciplineCode: string | null;
  unitCode: string | null;
  totalCount: number;
  items: VarianceBreakdownItem[];
};

export type VersionCompareItem = {
  itemCode: string;
  itemNameBase: string | null;
  itemNameTarget: string | null;
  baseSystemAmount: number;
  targetSystemAmount: number;
  baseFinalAmount: number;
  targetFinalAmount: number;
  systemVarianceAmount: number;
  finalVarianceAmount: number;
};

export type VersionCompareResponse = {
  projectId: string;
  baseBillVersionId: string;
  targetBillVersionId: string;
  baseVersionName: string;
  targetVersionName: string;
  itemCount: number;
  items: VersionCompareItem[];
};

export type ReportExportTask = {
  id: string;
  projectId: string;
  reportType: "summary" | "variance" | "stage_bill";
  status: "queued" | "processing" | "completed" | "failed";
  requestedBy: string;
  stageCode?: string | null;
  disciplineCode?: string | null;
  reportTemplateId?: string | null;
  outputFormat?: "json" | "excel" | "pdf" | null;
  createdAt: string;
  completedAt?: string | null;
  errorMessage?: string | null;
  downloadFileName?: string | null;
  downloadContentType?: string | null;
  downloadContentLength?: number | null;
  isDownloadReady?: boolean;
  isTerminal?: boolean;
  hasFailed?: boolean;
  failureMessage?: string | null;
};

export type CreateReportExportResponse = {
  job: {
    id: string;
    jobType: "report_export";
    status: "queued" | "processing" | "completed" | "failed";
  };
  result: ReportExportTask;
};
