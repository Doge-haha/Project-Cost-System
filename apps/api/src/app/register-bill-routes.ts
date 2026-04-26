import type { FastifyInstance } from "fastify";

import type { TransactionRunner } from "../shared/tx/transaction.js";
import type { BillItemService } from "../modules/bill/bill-item-service.js";
import type { BillVersionService } from "../modules/bill/bill-version-service.js";
import type { BillWorkItemService } from "../modules/bill/bill-work-item-service.js";
import type { CalculateService } from "../modules/engine/calculate-service.js";
import type { BackgroundJobService } from "../modules/jobs/background-job-service.js";
import type { QuotaLineService } from "../modules/quota/quota-line-service.js";
import type { ReviewSubmissionService } from "../modules/review/review-submission-service.js";
import { registerBillItemRoutes } from "./register-bill-item-routes.js";
import { registerBillVersionRoutes } from "./register-bill-version-routes.js";
import { registerBillWorkItemRoutes } from "./register-bill-work-item-routes.js";
import { registerQuotaRoutes } from "./register-quota-routes.js";
import { registerRecalculateRoutes } from "./register-recalculate-routes.js";
import { registerReviewRoutes } from "./register-review-routes.js";

export function registerBillRoutes(
  app: FastifyInstance,
  input: {
    transactionRunner: TransactionRunner;
    billVersionService: BillVersionService;
    billItemService: BillItemService;
    billWorkItemService: BillWorkItemService;
    quotaLineService: QuotaLineService;
    reviewSubmissionService: ReviewSubmissionService;
    backgroundJobService: BackgroundJobService;
    calculateService: CalculateService;
  },
) {
  registerReviewRoutes(app, {
    transactionRunner: input.transactionRunner,
    reviewSubmissionService: input.reviewSubmissionService,
  });

  registerRecalculateRoutes(app, {
    transactionRunner: input.transactionRunner,
    backgroundJobService: input.backgroundJobService,
    calculateService: input.calculateService,
  });

  registerBillVersionRoutes(app, {
    transactionRunner: input.transactionRunner,
    billVersionService: input.billVersionService,
  });

  registerBillItemRoutes(app, {
    transactionRunner: input.transactionRunner,
    billItemService: input.billItemService,
  });

  registerBillWorkItemRoutes(app, {
    transactionRunner: input.transactionRunner,
    billWorkItemService: input.billWorkItemService,
  });

  registerQuotaRoutes(app, {
    transactionRunner: input.transactionRunner,
    quotaLineService: input.quotaLineService,
  });
}
