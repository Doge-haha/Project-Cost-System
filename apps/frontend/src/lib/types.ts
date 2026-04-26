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
  status: "draft" | "submitted" | "approved" | "rejected";
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
  finalAmount?: number | string | null;
  systemAmount?: number | string | null;
  children?: BillItem[];
};

export type SummaryResponse = {
  totalSystemAmount?: number | string | null;
  totalFinalAmount?: number | string | null;
  varianceAmount?: number | string | null;
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
