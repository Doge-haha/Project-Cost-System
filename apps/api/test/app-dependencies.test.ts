import test from "node:test";
import assert from "node:assert/strict";

import { createAppDependencies } from "../src/app/create-app-dependencies.js";
import { PgTransactionRunner } from "../src/shared/tx/transaction.js";
import { InMemoryProjectRepository } from "../src/modules/project/project-repository.js";
import { InMemoryProjectStageRepository } from "../src/modules/project/project-stage-repository.js";
import { InMemoryProjectDisciplineRepository } from "../src/modules/project/project-discipline-repository.js";
import { InMemoryProjectMemberRepository } from "../src/modules/project/project-member-repository.js";
import { InMemoryBillVersionRepository } from "../src/modules/bill/bill-version-repository.js";
import { InMemoryBillItemRepository } from "../src/modules/bill/bill-item-repository.js";
import { InMemoryBillWorkItemRepository } from "../src/modules/bill/bill-work-item-repository.js";
import { InMemoryQuotaLineRepository } from "../src/modules/quota/quota-line-repository.js";
import { InMemoryPriceVersionRepository } from "../src/modules/pricing/price-version-repository.js";
import { InMemoryPriceItemRepository } from "../src/modules/pricing/price-item-repository.js";
import { InMemoryFeeTemplateRepository } from "../src/modules/fee/fee-template-repository.js";
import { InMemoryFeeRuleRepository } from "../src/modules/fee/fee-rule-repository.js";
import { InMemoryReviewSubmissionRepository } from "../src/modules/review/review-submission-repository.js";
import { InMemoryAuditLogRepository } from "../src/modules/audit/audit-log-repository.js";
import { InMemoryProcessDocumentRepository } from "../src/modules/process/process-document-repository.js";
import { InMemoryKnowledgeEntryRepository } from "../src/modules/knowledge/knowledge-entry-repository.js";
import { InMemoryMemoryEntryRepository } from "../src/modules/knowledge/memory-entry-repository.js";
import { InMemoryReportExportTaskRepository } from "../src/modules/reports/report-export-task-repository.js";
import { InMemoryBackgroundJobRepository } from "../src/modules/jobs/background-job-repository.js";

function createDatabaseLikeDependencies() {
  return createAppDependencies({
    appRuntimeMode: "database",
    transactionRunner: new PgTransactionRunner({
      pool: {
        connect: async () => ({
          query: async () => undefined,
          release: () => undefined,
        }),
      },
    }),
    projectRepository: new InMemoryProjectRepository([]),
    projectStageRepository: new InMemoryProjectStageRepository([]),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository([]),
    projectMemberRepository: new InMemoryProjectMemberRepository([]),
    billVersionRepository: new InMemoryBillVersionRepository([]),
    billItemRepository: new InMemoryBillItemRepository([]),
    billWorkItemRepository: new InMemoryBillWorkItemRepository([]),
    quotaLineRepository: new InMemoryQuotaLineRepository([]),
    priceVersionRepository: new InMemoryPriceVersionRepository([]),
    priceItemRepository: new InMemoryPriceItemRepository([]),
    feeTemplateRepository: new InMemoryFeeTemplateRepository([]),
    feeRuleRepository: new InMemoryFeeRuleRepository([]),
    reviewSubmissionRepository: new InMemoryReviewSubmissionRepository([]),
    auditLogRepository: new InMemoryAuditLogRepository([]),
    processDocumentRepository: new InMemoryProcessDocumentRepository([]),
    knowledgeEntryRepository: new InMemoryKnowledgeEntryRepository([]),
    memoryEntryRepository: new InMemoryMemoryEntryRepository([]),
    reportExportTaskRepository: new InMemoryReportExportTaskRepository([]),
    backgroundJobRepository: new InMemoryBackgroundJobRepository([]),
  });
}

test("createAppDependencies rejects inline transactions in database mode", () => {
  assert.throws(
    () =>
      createAppDependencies({
        appRuntimeMode: "database",
      }),
    /Database runtime mode requires a non-inline transaction runner/,
  );
});

test("createAppDependencies rejects in-memory repositories in database mode", () => {
  assert.throws(
    () => createDatabaseLikeDependencies(),
    /Database runtime mode requires database-backed repositories for:/,
  );
});

test("createAppDependencies allows in-memory defaults in memory mode", () => {
  const result = createAppDependencies({
    appRuntimeMode: "memory",
  });

  assert.ok(result.repositories.project);
  assert.ok(result.services.transactionRunner);
});
