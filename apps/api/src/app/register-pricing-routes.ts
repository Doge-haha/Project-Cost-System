import type { FastifyInstance } from "fastify";

import type { TransactionRunner } from "../shared/tx/transaction.js";
import {
  calculateEngineSchema,
  type CalculateService,
} from "../modules/engine/calculate-service.js";
import {
  listFeeTemplateSchema,
  type FeeTemplateService,
} from "../modules/fee/fee-template-service.js";
import {
  listPriceItemSchema,
  type PriceItemService,
} from "../modules/pricing/price-item-service.js";
import {
  listPriceVersionSchema,
  type PriceVersionService,
} from "../modules/pricing/price-version-service.js";

export function registerPricingRoutes(
  app: FastifyInstance,
  input: {
    transactionRunner: TransactionRunner;
    priceVersionService: PriceVersionService;
    priceItemService: PriceItemService;
    calculateService: CalculateService;
    feeTemplateService: FeeTemplateService;
  },
) {
  const {
    transactionRunner,
    priceVersionService,
    priceItemService,
    calculateService,
    feeTemplateService,
  } = input;

  app.get("/v1/price-versions", async (request) => {
    const query = listPriceVersionSchema.parse(request.query);

    return transactionRunner.runInTransaction(async () => ({
      items: await priceVersionService.listPriceVersions(query),
    }));
  });

  app.get("/v1/price-versions/:priceVersionId/items", async (request) => {
    const { priceVersionId } = request.params as { priceVersionId: string };
    const query = listPriceItemSchema.parse(request.query);

    return transactionRunner.runInTransaction(async () => ({
      items: await priceItemService.listPriceItems({
        priceVersionId,
        quotaCode: query.quotaCode,
      }),
    }));
  });

  app.post("/v1/engine/calculate", async (request) => {
    const payload = calculateEngineSchema.parse(request.body);

    return transactionRunner.runInTransaction(async () =>
      calculateService.calculate({
        billItemId: payload.billItemId,
        priceVersionId: payload.priceVersionId,
        feeTemplateId: payload.feeTemplateId,
        userId: request.currentUser!.id,
      }),
    );
  });

  app.get("/v1/fee-templates", async (request) => {
    const query = listFeeTemplateSchema.parse(request.query);

    return transactionRunner.runInTransaction(async () => ({
      items: await feeTemplateService.listFeeTemplates(query),
    }));
  });

  app.get("/v1/fee-templates/:feeTemplateId", async (request) => {
    const { feeTemplateId } = request.params as { feeTemplateId: string };

    return transactionRunner.runInTransaction(async () =>
      feeTemplateService.getFeeTemplate(feeTemplateId),
    );
  });
}
