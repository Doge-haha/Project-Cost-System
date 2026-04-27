import { AppError } from "../shared/errors/app-error.js";
import {
  InlineTransactionRunner,
  type TransactionRunner,
} from "../shared/tx/transaction.js";
import { ProjectService } from "../modules/project/project-service.js";
import { BillVersionService } from "../modules/bill/bill-version-service.js";
import { BillItemService } from "../modules/bill/bill-item-service.js";
import { BillWorkItemService } from "../modules/bill/bill-work-item-service.js";
import { QuotaLineService } from "../modules/quota/quota-line-service.js";
import { PriceVersionService } from "../modules/pricing/price-version-service.js";
import { PriceItemService } from "../modules/pricing/price-item-service.js";
import { FeeTemplateService } from "../modules/fee/fee-template-service.js";
import { CalculateService } from "../modules/engine/calculate-service.js";
import { SummaryService } from "../modules/reports/summary-service.js";
import { ReportExportTaskService } from "../modules/reports/report-export-task-service.js";
import { BackgroundJobService } from "../modules/jobs/background-job-service.js";
import {
  NoopBackgroundJobSink,
  type BackgroundJobSink,
} from "../modules/jobs/background-job-sink.js";
import { BackgroundJobProcessor } from "../modules/jobs/background-job-processor.js";
import { ReviewSubmissionService } from "../modules/review/review-submission-service.js";
import { AuditLogService } from "../modules/audit/audit-log-service.js";
import { ProcessDocumentService } from "../modules/process/process-document-service.js";
import { AiRuntimePreviewService } from "../modules/ai/ai-runtime-preview-service.js";
import { AiRecommendationService } from "../modules/ai/ai-recommendation-service.js";
import { KnowledgeService } from "../modules/knowledge/knowledge-service.js";
import { ImportTaskService } from "../modules/import/import-task-service.js";
import type { AppRepositories } from "./create-app-repositories.js";

export type AppServices = {
  transactionRunner: TransactionRunner;
  auditLogService: AuditLogService;
  backgroundJobService: BackgroundJobService;
  aiRuntimePreviewService: AiRuntimePreviewService;
  aiRecommendationService: AiRecommendationService;
  projectService: ProjectService;
  billVersionService: BillVersionService;
  billItemService: BillItemService;
  billWorkItemService: BillWorkItemService;
  quotaLineService: QuotaLineService;
  priceVersionService: PriceVersionService;
  priceItemService: PriceItemService;
  calculateService: CalculateService;
  feeTemplateService: FeeTemplateService;
  summaryService: SummaryService;
  knowledgeService: KnowledgeService;
  importTaskService: ImportTaskService;
  backgroundJobProcessor: BackgroundJobProcessor;
  reportExportTaskService: ReportExportTaskService;
  reviewSubmissionService: ReviewSubmissionService;
  processDocumentService: ProcessDocumentService;
};

export type CreateAppServiceOptions = {
  transactionRunner?: TransactionRunner;
  backgroundJobSink?: BackgroundJobSink;
  aiRuntimePreviewService?: AiRuntimePreviewService;
};

export function createAppServices(
  repositories: AppRepositories,
  options: CreateAppServiceOptions,
): AppServices {
  const transactionRunner =
    options.transactionRunner ?? new InlineTransactionRunner();

  const auditLogService = new AuditLogService(
    repositories.auditLog,
    repositories.project,
    repositories.projectStage,
    repositories.projectDiscipline,
    repositories.projectMember,
  );
  const importTaskService = new ImportTaskService(
    repositories.importTask,
    {
      projectRepository: repositories.project,
      projectStageRepository: repositories.projectStage,
      projectDisciplineRepository: repositories.projectDiscipline,
      projectMemberRepository: repositories.projectMember,
    },
    auditLogService,
  );
  const backgroundJobService = new BackgroundJobService(
    repositories.backgroundJob,
    repositories.project,
    repositories.projectStage,
    repositories.projectDiscipline,
    repositories.projectMember,
    auditLogService,
    options.backgroundJobSink ?? new NoopBackgroundJobSink(),
    importTaskService,
  );
  const aiRuntimePreviewService =
    options.aiRuntimePreviewService ??
    new AiRuntimePreviewService({
      pythonExecutable: "python3",
      cliPath: `${process.cwd()}/apps/ai-runtime/app/cli.py`,
    });
  const projectService = new ProjectService(
    repositories.project,
    repositories.projectStage,
    repositories.projectDiscipline,
    repositories.projectMember,
    repositories.billVersion,
    repositories.reviewSubmission,
    repositories.processDocument,
    repositories.backgroundJob,
    repositories.importTask,
    repositories.priceVersion,
    repositories.feeTemplate,
    auditLogService,
  );
  const billVersionService = new BillVersionService(
    repositories.billVersion,
    {
      projectRepository: repositories.project,
      projectStageRepository: repositories.projectStage,
      projectDisciplineRepository: repositories.projectDiscipline,
      projectMemberRepository: repositories.projectMember,
      billItemRepository: repositories.billItem,
      billWorkItemRepository: repositories.billWorkItem,
    },
    auditLogService,
  );
  const billItemService = new BillItemService(
    repositories.billItem,
    {
      projectRepository: repositories.project,
      projectStageRepository: repositories.projectStage,
      projectDisciplineRepository: repositories.projectDiscipline,
      projectMemberRepository: repositories.projectMember,
      billVersionRepository: repositories.billVersion,
      quotaLineRepository: repositories.quotaLine,
    },
    auditLogService,
  );
  const billWorkItemService = new BillWorkItemService(
    repositories.billWorkItem,
    {
      billItemService,
      billItemRepository: repositories.billItem,
    },
    auditLogService,
  );
  const quotaLineService = new QuotaLineService(
    repositories.quotaLine,
    {
      billItemService,
      billItemRepository: repositories.billItem,
      billVersionService,
      projectDisciplineRepository: repositories.projectDiscipline,
    },
    auditLogService,
  );
  const priceVersionService = new PriceVersionService(repositories.priceVersion);
  const priceItemService = new PriceItemService(repositories.priceItem, {
    priceVersionRepository: repositories.priceVersion,
  });
  const feeTemplateService = new FeeTemplateService(
    repositories.feeTemplate,
    repositories.feeRule,
  );
  const summaryService = new SummaryService({
    projectRepository: repositories.project,
    projectStageRepository: repositories.projectStage,
    projectDisciplineRepository: repositories.projectDiscipline,
    projectMemberRepository: repositories.projectMember,
    billVersionRepository: repositories.billVersion,
    billItemRepository: repositories.billItem,
    feeTemplateRepository: repositories.feeTemplate,
    feeRuleRepository: repositories.feeRule,
  });
  const knowledgeService = new KnowledgeService(
    repositories.knowledgeEntry,
    repositories.memoryEntry,
    repositories.project,
    repositories.projectStage,
    repositories.projectDiscipline,
    repositories.projectMember,
  );
  const aiRecommendationService = new AiRecommendationService(
    repositories.aiRecommendation,
    {
      projectRepository: repositories.project,
      projectStageRepository: repositories.projectStage,
      projectDisciplineRepository: repositories.projectDiscipline,
      projectMemberRepository: repositories.projectMember,
      billItemService,
      quotaLineService,
      summaryService,
      knowledgeService,
    },
    auditLogService,
  );
  const calculateService = new CalculateService(
    {
      projectRepository: repositories.project,
      projectStageRepository: repositories.projectStage,
      projectDisciplineRepository: repositories.projectDiscipline,
      projectMemberRepository: repositories.projectMember,
      billItemRepository: repositories.billItem,
      billVersionRepository: repositories.billVersion,
      quotaLineRepository: repositories.quotaLine,
      priceVersionRepository: repositories.priceVersion,
      priceItemRepository: repositories.priceItem,
      feeTemplateRepository: repositories.feeTemplate,
      feeRuleRepository: repositories.feeRule,
      billVersionService,
    },
    auditLogService,
  );
  const reportExportTaskService = new ReportExportTaskService(
    repositories.reportExportTask,
    repositories.project,
    summaryService,
    auditLogService,
  );
  const backgroundJobProcessor = new BackgroundJobProcessor(backgroundJobService, {
    processProjectRecalculate: async ({ payload, requestedBy }) =>
      calculateService.recalculateProject({
        projectId: payload.projectId,
        stageCode: payload.stageCode ?? undefined,
        disciplineCode: payload.disciplineCode ?? undefined,
        priceVersionId: payload.priceVersionId ?? undefined,
        feeTemplateId: payload.feeTemplateId ?? undefined,
        userId: requestedBy,
        roleCodes: Array.isArray(payload.roleCodes)
          ? payload.roleCodes.filter(
              (value): value is string => typeof value === "string" && value.length > 0,
            )
          : [],
      }),
    processReportExport: async ({ payload, requestedBy }) => {
      if (!payload.reportExportTaskId) {
        throw new AppError(
          422,
          "REPORT_EXPORT_TASK_ID_REQUIRED",
          "Report export task id is required",
        );
      }

      const completed = await reportExportTaskService.processReportExportTask({
        taskId: payload.reportExportTaskId,
        userId: requestedBy,
      });

      return {
        taskId: completed.id,
        status: completed.status,
        reportType: completed.reportType,
      };
    },
    processKnowledgeExtraction: async ({ payload, requestedBy, jobId }) => {
      const result = await aiRuntimePreviewService.processEventBatch({
        source: payload.source,
        events: payload.events,
      });
      const persisted = await knowledgeService.persistExtractionResult({
        projectId: payload.projectId,
        sourceJobId: jobId,
        result,
      });

      return {
        ...result,
        persisted: {
          requestedBy,
          knowledgeEntryCount: persisted.knowledgeEntries.length,
          memoryEntryCount: persisted.memoryEntries.length,
          knowledgeEntryIds: persisted.knowledgeEntries.map((entry) => entry.id),
          memoryEntryIds: persisted.memoryEntries.map((entry) => entry.id),
        },
      };
    },
  });
  const reviewSubmissionService = new ReviewSubmissionService(
    repositories.reviewSubmission,
    {
      projectRepository: repositories.project,
      projectStageRepository: repositories.projectStage,
      projectDisciplineRepository: repositories.projectDiscipline,
      projectMemberRepository: repositories.projectMember,
      billVersionRepository: repositories.billVersion,
    },
    auditLogService,
  );
  const processDocumentService = new ProcessDocumentService(
    repositories.processDocument,
    {
      projectRepository: repositories.project,
      projectStageRepository: repositories.projectStage,
      projectDisciplineRepository: repositories.projectDiscipline,
      projectMemberRepository: repositories.projectMember,
    },
    auditLogService,
  );

  return {
    transactionRunner,
    auditLogService,
    backgroundJobService,
    aiRuntimePreviewService,
    aiRecommendationService,
    projectService,
    billVersionService,
    billItemService,
    billWorkItemService,
    quotaLineService,
    priceVersionService,
    priceItemService,
    calculateService,
    feeTemplateService,
    summaryService,
    knowledgeService,
    importTaskService,
    backgroundJobProcessor,
    reportExportTaskService,
    reviewSubmissionService,
    processDocumentService,
  };
}
