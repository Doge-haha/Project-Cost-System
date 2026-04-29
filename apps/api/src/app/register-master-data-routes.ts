import type { FastifyInstance } from "fastify";

import type { TransactionRunner } from "../shared/tx/transaction.js";
import {
  listDisciplineTypesSchema,
  listStandardSetsSchema,
  type MasterDataService,
} from "../modules/master-data/master-data-service.js";

export function registerMasterDataRoutes(
  app: FastifyInstance,
  input: {
    transactionRunner: TransactionRunner;
    masterDataService: MasterDataService;
  },
) {
  app.get("/v1/discipline-types", async (request) => {
    const query = listDisciplineTypesSchema.parse(request.query);

    return input.transactionRunner.runInTransaction(async () => ({
      items: await input.masterDataService.listDisciplineTypes(query),
    }));
  });

  app.get("/v1/standard-sets", async (request) => {
    const query = listStandardSetsSchema.parse(request.query);

    return input.transactionRunner.runInTransaction(async () => ({
      items: await input.masterDataService.listStandardSets(query),
    }));
  });
}
