import {
  InMemoryProjectRepository,
  type ProjectRepository,
} from "../modules/project/project-repository.js";
import {
  InMemoryProjectStageRepository,
  type ProjectStageRepository,
} from "../modules/project/project-stage-repository.js";
import {
  InMemoryProjectDisciplineRepository,
  type ProjectDisciplineRepository,
} from "../modules/project/project-discipline-repository.js";
import {
  InMemoryProjectMemberRepository,
  type ProjectMemberRepository,
} from "../modules/project/project-member-repository.js";
import {
  InMemoryBillVersionRepository,
  type BillVersionRepository,
} from "../modules/bill/bill-version-repository.js";
import {
  InMemoryBillItemRepository,
  type BillItemRepository,
} from "../modules/bill/bill-item-repository.js";
import {
  InMemoryBillWorkItemRepository,
  type BillWorkItemRepository,
} from "../modules/bill/bill-work-item-repository.js";
import {
  InMemoryQuotaLineRepository,
  type QuotaLineRepository,
} from "../modules/quota/quota-line-repository.js";
import {
  InMemoryReferenceQuotaRepository,
  type ReferenceQuotaRepository,
} from "../modules/quota/reference-quota-repository.js";
import {
  InMemoryPriceVersionRepository,
  type PriceVersionRepository,
} from "../modules/pricing/price-version-repository.js";
import {
  InMemoryPriceItemRepository,
  type PriceItemRepository,
} from "../modules/pricing/price-item-repository.js";
import {
  InMemoryFeeTemplateRepository,
  type FeeTemplateRepository,
} from "../modules/fee/fee-template-repository.js";
import {
  InMemoryFeeRuleRepository,
  type FeeRuleRepository,
} from "../modules/fee/fee-rule-repository.js";
import {
  InMemoryReviewSubmissionRepository,
  type ReviewSubmissionRepository,
} from "../modules/review/review-submission-repository.js";
import {
  InMemoryAuditLogRepository,
  type AuditLogRepository,
} from "../modules/audit/audit-log-repository.js";
import {
  InMemoryProcessDocumentRepository,
  type ProcessDocumentRepository,
} from "../modules/process/process-document-repository.js";
import {
  InMemoryKnowledgeEntryRepository,
  type KnowledgeEntryRepository,
} from "../modules/knowledge/knowledge-entry-repository.js";
import {
  InMemoryMemoryEntryRepository,
  type MemoryEntryRepository,
} from "../modules/knowledge/memory-entry-repository.js";
import {
  InMemoryReportExportTaskRepository,
  type ReportExportTaskRepository,
} from "../modules/reports/report-export-task-repository.js";
import {
  InMemoryBackgroundJobRepository,
  type BackgroundJobRepository,
} from "../modules/jobs/background-job-repository.js";
import {
  InMemoryImportTaskRepository,
  type ImportTaskRepository,
} from "../modules/import/import-task-repository.js";
import {
  InMemoryAiRecommendationRepository,
  type AiRecommendationRepository,
} from "../modules/ai/ai-recommendation-repository.js";

export type AppRepositories = {
  project: ProjectRepository;
  projectStage: ProjectStageRepository;
  projectDiscipline: ProjectDisciplineRepository;
  projectMember: ProjectMemberRepository;
  billVersion: BillVersionRepository;
  billItem: BillItemRepository;
  billWorkItem: BillWorkItemRepository;
  quotaLine: QuotaLineRepository;
  referenceQuota: ReferenceQuotaRepository;
  priceVersion: PriceVersionRepository;
  priceItem: PriceItemRepository;
  feeTemplate: FeeTemplateRepository;
  feeRule: FeeRuleRepository;
  reviewSubmission: ReviewSubmissionRepository;
  auditLog: AuditLogRepository;
  processDocument: ProcessDocumentRepository;
  knowledgeEntry: KnowledgeEntryRepository;
  memoryEntry: MemoryEntryRepository;
  reportExportTask: ReportExportTaskRepository;
  backgroundJob: BackgroundJobRepository;
  importTask: ImportTaskRepository;
  aiRecommendation: AiRecommendationRepository;
};

export type CreateAppRepositoryOptions = {
  projectRepository?: ProjectRepository;
  projectStageRepository?: ProjectStageRepository;
  projectDisciplineRepository?: ProjectDisciplineRepository;
  projectMemberRepository?: ProjectMemberRepository;
  billVersionRepository?: BillVersionRepository;
  billItemRepository?: BillItemRepository;
  billWorkItemRepository?: BillWorkItemRepository;
  quotaLineRepository?: QuotaLineRepository;
  referenceQuotaRepository?: ReferenceQuotaRepository;
  priceVersionRepository?: PriceVersionRepository;
  priceItemRepository?: PriceItemRepository;
  feeTemplateRepository?: FeeTemplateRepository;
  feeRuleRepository?: FeeRuleRepository;
  reviewSubmissionRepository?: ReviewSubmissionRepository;
  auditLogRepository?: AuditLogRepository;
  processDocumentRepository?: ProcessDocumentRepository;
  knowledgeEntryRepository?: KnowledgeEntryRepository;
  memoryEntryRepository?: MemoryEntryRepository;
  reportExportTaskRepository?: ReportExportTaskRepository;
  backgroundJobRepository?: BackgroundJobRepository;
  importTaskRepository?: ImportTaskRepository;
  aiRecommendationRepository?: AiRecommendationRepository;
};

export function createAppRepositories(
  options: CreateAppRepositoryOptions,
): AppRepositories {
  return {
    project: options.projectRepository ?? new InMemoryProjectRepository([]),
    projectStage:
      options.projectStageRepository ?? new InMemoryProjectStageRepository([]),
    projectDiscipline:
      options.projectDisciplineRepository ??
      new InMemoryProjectDisciplineRepository([]),
    projectMember:
      options.projectMemberRepository ?? new InMemoryProjectMemberRepository([]),
    billVersion:
      options.billVersionRepository ?? new InMemoryBillVersionRepository([]),
    billItem: options.billItemRepository ?? new InMemoryBillItemRepository([]),
    billWorkItem:
      options.billWorkItemRepository ?? new InMemoryBillWorkItemRepository([]),
    quotaLine:
      options.quotaLineRepository ?? new InMemoryQuotaLineRepository([]),
    referenceQuota:
      options.referenceQuotaRepository ?? new InMemoryReferenceQuotaRepository([]),
    priceVersion:
      options.priceVersionRepository ?? new InMemoryPriceVersionRepository([]),
    priceItem: options.priceItemRepository ?? new InMemoryPriceItemRepository([]),
    feeTemplate:
      options.feeTemplateRepository ?? new InMemoryFeeTemplateRepository([]),
    feeRule: options.feeRuleRepository ?? new InMemoryFeeRuleRepository([]),
    reviewSubmission:
      options.reviewSubmissionRepository ??
      new InMemoryReviewSubmissionRepository([]),
    auditLog: options.auditLogRepository ?? new InMemoryAuditLogRepository([]),
    processDocument:
      options.processDocumentRepository ??
      new InMemoryProcessDocumentRepository([]),
    knowledgeEntry:
      options.knowledgeEntryRepository ?? new InMemoryKnowledgeEntryRepository([]),
    memoryEntry:
      options.memoryEntryRepository ?? new InMemoryMemoryEntryRepository([]),
    reportExportTask:
      options.reportExportTaskRepository ??
      new InMemoryReportExportTaskRepository([]),
    backgroundJob:
      options.backgroundJobRepository ??
      new InMemoryBackgroundJobRepository([]),
    importTask:
      options.importTaskRepository ?? new InMemoryImportTaskRepository([]),
    aiRecommendation:
      options.aiRecommendationRepository ??
      new InMemoryAiRecommendationRepository([]),
  };
}
