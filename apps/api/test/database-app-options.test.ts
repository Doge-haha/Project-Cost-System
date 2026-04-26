import test from "node:test";
import assert from "node:assert/strict";

import { createDatabaseAppOptions } from "../src/infrastructure/database/create-database-app-options.js";
import { createPgMemDatabase } from "./helpers/pg-mem.js";

test("createDatabaseAppOptions wires the first database-backed repositories", () => {
  const { appOptions, close } = createDatabaseAppOptions({
    DATABASE_URL: "postgres://postgres:postgres@localhost:5432/saas_pricing",
  });

  assert.ok(appOptions.transactionRunner);
  assert.ok(appOptions.projectRepository);
  assert.ok(appOptions.projectStageRepository);
  assert.ok(appOptions.projectDisciplineRepository);
  assert.ok(appOptions.projectMemberRepository);
  assert.ok(appOptions.billVersionRepository);
  assert.ok(appOptions.billItemRepository);
  assert.ok(appOptions.billWorkItemRepository);
  assert.ok(appOptions.quotaLineRepository);
  assert.ok(appOptions.priceVersionRepository);
  assert.ok(appOptions.priceItemRepository);
  assert.ok(appOptions.feeTemplateRepository);
  assert.ok(appOptions.feeRuleRepository);
  assert.ok(appOptions.reviewSubmissionRepository);
  assert.ok(appOptions.processDocumentRepository);
  assert.ok(appOptions.backgroundJobRepository);
  assert.ok(appOptions.reportExportTaskRepository);
  assert.ok(appOptions.knowledgeEntryRepository);
  assert.ok(appOptions.memoryEntryRepository);
  assert.ok(appOptions.auditLogRepository);
  assert.equal(typeof close, "function");
});

test("createDatabaseAppOptions can be backed by a pg-mem runtime for smoke wiring", async () => {
  const runtime = await createPgMemDatabase();
  try {
    const result = createDatabaseAppOptions(
      {
        DATABASE_URL: "postgres://postgres:postgres@localhost:5432/saas_pricing",
      },
      {
        createDatabaseClient: () => runtime,
      },
    );

    assert.ok(result.appOptions.transactionRunner);
    assert.ok(result.appOptions.projectRepository);
    assert.ok(result.appOptions.billVersionRepository);
    assert.ok(result.appOptions.auditLogRepository);
    await result.close();
  } finally {
    try {
      await runtime.close();
    } catch {
      // close is also called through result.close in the happy path above
    }
  }
});
