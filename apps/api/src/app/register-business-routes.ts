import type { FastifyInstance } from "fastify";

import type { TransactionRunner } from "../shared/tx/transaction.js";
import type { BillVersionService } from "../modules/bill/bill-version-service.js";
import type { BillItemService } from "../modules/bill/bill-item-service.js";
import type { BillWorkItemService } from "../modules/bill/bill-work-item-service.js";
import type { QuotaLineService } from "../modules/quota/quota-line-service.js";
import type { PriceVersionService } from "../modules/pricing/price-version-service.js";
import type { PriceItemService } from "../modules/pricing/price-item-service.js";
import type { CalculateService } from "../modules/engine/calculate-service.js";
import type { ReviewSubmissionService } from "../modules/review/review-submission-service.js";
import type { SummaryService } from "../modules/reports/summary-service.js";
import type { ReportExportTaskService } from "../modules/reports/report-export-task-service.js";
import type { BackgroundJobService } from "../modules/jobs/background-job-service.js";
import type { BackgroundJobProcessor } from "../modules/jobs/background-job-processor.js";
import type { FeeTemplateService } from "../modules/fee/fee-template-service.js";
import { registerBillRoutes } from "./register-bill-routes.js";
import { registerOpsRoutes } from "./register-ops-routes.js";

export function registerBusinessRoutes(
  app: FastifyInstance,
  input: {
    transactionRunner: TransactionRunner;
    billVersionService: BillVersionService;
    billItemService: BillItemService;
    billWorkItemService: BillWorkItemService;
    quotaLineService: QuotaLineService;
    priceVersionService: PriceVersionService;
    priceItemService: PriceItemService;
    calculateService: CalculateService;
    reviewSubmissionService: ReviewSubmissionService;
    summaryService: SummaryService;
    reportExportTaskService: ReportExportTaskService;
    backgroundJobService: BackgroundJobService;
    backgroundJobProcessor: BackgroundJobProcessor;
    feeTemplateService: FeeTemplateService;
  },
) {
  registerBillRoutes(app, {
    transactionRunner: input.transactionRunner,
    billVersionService: input.billVersionService,
    billItemService: input.billItemService,
    billWorkItemService: input.billWorkItemService,
    quotaLineService: input.quotaLineService,
    reviewSubmissionService: input.reviewSubmissionService,
    backgroundJobService: input.backgroundJobService,
    calculateService: input.calculateService,
  });

  registerOpsRoutes(app, {
    transactionRunner: input.transactionRunner,
    priceVersionService: input.priceVersionService,
    priceItemService: input.priceItemService,
    calculateService: input.calculateService,
    summaryService: input.summaryService,
    reportExportTaskService: input.reportExportTaskService,
    backgroundJobService: input.backgroundJobService,
    backgroundJobProcessor: input.backgroundJobProcessor,
    feeTemplateService: input.feeTemplateService,
  });
}
