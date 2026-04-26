import type { FastifyInstance } from "fastify";

import type { TransactionRunner } from "../shared/tx/transaction.js";
import type { CalculateService } from "../modules/engine/calculate-service.js";
import type { FeeTemplateService } from "../modules/fee/fee-template-service.js";
import type { BackgroundJobProcessor } from "../modules/jobs/background-job-processor.js";
import type { BackgroundJobService } from "../modules/jobs/background-job-service.js";
import type { PriceItemService } from "../modules/pricing/price-item-service.js";
import type { PriceVersionService } from "../modules/pricing/price-version-service.js";
import type { ReportExportTaskService } from "../modules/reports/report-export-task-service.js";
import type { SummaryService } from "../modules/reports/summary-service.js";
import { registerJobRoutes } from "./register-job-routes.js";
import { registerPricingRoutes } from "./register-pricing-routes.js";
import { registerReportRoutes } from "./register-report-routes.js";

export function registerOpsRoutes(
  app: FastifyInstance,
  input: {
    transactionRunner: TransactionRunner;
    priceVersionService: PriceVersionService;
    priceItemService: PriceItemService;
    calculateService: CalculateService;
    summaryService: SummaryService;
    reportExportTaskService: ReportExportTaskService;
    backgroundJobService: BackgroundJobService;
    backgroundJobProcessor: BackgroundJobProcessor;
    feeTemplateService: FeeTemplateService;
  },
) {
  registerPricingRoutes(app, {
    transactionRunner: input.transactionRunner,
    priceVersionService: input.priceVersionService,
    priceItemService: input.priceItemService,
    calculateService: input.calculateService,
    feeTemplateService: input.feeTemplateService,
  });

  registerReportRoutes(app, {
    transactionRunner: input.transactionRunner,
    summaryService: input.summaryService,
    reportExportTaskService: input.reportExportTaskService,
    backgroundJobService: input.backgroundJobService,
  });

  registerJobRoutes(app, {
    transactionRunner: input.transactionRunner,
    backgroundJobService: input.backgroundJobService,
    backgroundJobProcessor: input.backgroundJobProcessor,
  });
}
