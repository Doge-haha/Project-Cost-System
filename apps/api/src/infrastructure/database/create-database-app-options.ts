import type { CreateAppOptions } from "../../app/create-app-options.js";
import {
  DbProjectDisciplineRepository,
} from "../../modules/project/project-discipline-repository.js";
import { DbProjectMemberRepository } from "../../modules/project/project-member-repository.js";
import { DbProjectRepository } from "../../modules/project/project-repository.js";
import { DbProjectStageRepository } from "../../modules/project/project-stage-repository.js";
import { DbBillItemRepository } from "../../modules/bill/bill-item-repository.js";
import { DbBillVersionRepository } from "../../modules/bill/bill-version-repository.js";
import { DbBillWorkItemRepository } from "../../modules/bill/bill-work-item-repository.js";
import { DbAuditLogRepository } from "../../modules/audit/audit-log-repository.js";
import { DbQuotaLineRepository } from "../../modules/quota/quota-line-repository.js";
import { DbReferenceQuotaRepository } from "../../modules/quota/reference-quota-repository.js";
import { DbPriceVersionRepository } from "../../modules/pricing/price-version-repository.js";
import { DbPriceItemRepository } from "../../modules/pricing/price-item-repository.js";
import { DbFeeTemplateRepository } from "../../modules/fee/fee-template-repository.js";
import { DbFeeRuleRepository } from "../../modules/fee/fee-rule-repository.js";
import { DbReviewSubmissionRepository } from "../../modules/review/review-submission-repository.js";
import { DbProcessDocumentRepository } from "../../modules/process/process-document-repository.js";
import { DbBackgroundJobRepository } from "../../modules/jobs/background-job-repository.js";
import { DbReportExportTaskRepository } from "../../modules/reports/report-export-task-repository.js";
import { DbKnowledgeEntryRepository } from "../../modules/knowledge/knowledge-entry-repository.js";
import { DbMemoryEntryRepository } from "../../modules/knowledge/memory-entry-repository.js";
import { DbImportTaskRepository } from "../../modules/import/import-task-repository.js";
import { DbAiRecommendationRepository } from "../../modules/ai/ai-recommendation-repository.js";
import { createTransactionRunner } from "../../shared/tx/transaction.js";
import { createDatabaseClient } from "./database-client.js";
import { parseDatabaseConfig } from "./database-config.js";
import type { ApiDatabase } from "./database-client.js";

type DatabaseClientLike = {
  pool: {
    connect: () => Promise<{
      query: (sql: string) => Promise<unknown>;
      release: () => void;
    }>;
    end: () => Promise<void>;
  };
  db: ApiDatabase;
  close: () => Promise<void>;
};

export function createDatabaseAppOptions(
  env: Record<string, string | undefined>,
  dependencies: {
    createDatabaseClient?: (input: ReturnType<typeof parseDatabaseConfig>) => DatabaseClientLike;
  } = {},
): {
  appOptions: Partial<CreateAppOptions>;
  close: () => Promise<void>;
} {
  const client =
    dependencies.createDatabaseClient?.(parseDatabaseConfig(env)) ??
    createDatabaseClient(parseDatabaseConfig(env));

  return {
    appOptions: {
      appRuntimeMode: "database",
      transactionRunner: createTransactionRunner({
        pool: client.pool,
      }),
      projectRepository: new DbProjectRepository(client.db),
      projectStageRepository: new DbProjectStageRepository(client.db),
      projectDisciplineRepository: new DbProjectDisciplineRepository(client.db),
      projectMemberRepository: new DbProjectMemberRepository(client.db),
      billVersionRepository: new DbBillVersionRepository(client.db),
      billItemRepository: new DbBillItemRepository(client.db),
      billWorkItemRepository: new DbBillWorkItemRepository(client.db),
      quotaLineRepository: new DbQuotaLineRepository(client.db),
      referenceQuotaRepository: new DbReferenceQuotaRepository(client.db),
      priceVersionRepository: new DbPriceVersionRepository(client.db),
      priceItemRepository: new DbPriceItemRepository(client.db),
      feeTemplateRepository: new DbFeeTemplateRepository(client.db),
      feeRuleRepository: new DbFeeRuleRepository(client.db),
      reviewSubmissionRepository: new DbReviewSubmissionRepository(client.db),
      processDocumentRepository: new DbProcessDocumentRepository(client.db),
      backgroundJobRepository: new DbBackgroundJobRepository(client.db),
      importTaskRepository: new DbImportTaskRepository(client.db),
      reportExportTaskRepository: new DbReportExportTaskRepository(client.db),
      knowledgeEntryRepository: new DbKnowledgeEntryRepository(client.db),
      memoryEntryRepository: new DbMemoryEntryRepository(client.db),
      aiRecommendationRepository: new DbAiRecommendationRepository(client.db),
      auditLogRepository: new DbAuditLogRepository(client.db),
    },
    close: async () => {
      await client.close();
    },
  };
}
