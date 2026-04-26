import test from "node:test";
import assert from "node:assert/strict";

import { createRuntimeAppOptions } from "../src/app/create-runtime-app-options.js";

test("createRuntimeAppOptions returns in-memory mode when DATABASE_URL is absent", () => {
  const result = createRuntimeAppOptions({});

  assert.equal(result.mode, "memory");
  assert.deepEqual(result.appOptions, {
    appRuntimeMode: "memory",
  });
  assert.equal(result.close, undefined);
});

test("createRuntimeAppOptions returns database-backed options when DATABASE_URL is present", () => {
  const result = createRuntimeAppOptions({
    DATABASE_URL: "postgres://postgres:postgres@localhost:5432/saas_pricing",
  });

  assert.equal(result.mode, "database");
  assert.equal(result.appOptions.appRuntimeMode, "database");
  assert.ok(result.appOptions.transactionRunner);
  assert.ok(result.appOptions.projectRepository);
  assert.equal(typeof result.close, "function");
});

test("createRuntimeAppOptions honors APP_STORAGE_MODE=memory even when DATABASE_URL exists", () => {
  const result = createRuntimeAppOptions({
    APP_STORAGE_MODE: "memory",
    DATABASE_URL: "postgres://postgres:postgres@localhost:5432/saas_pricing",
  });

  assert.equal(result.mode, "memory");
  assert.deepEqual(result.appOptions, {
    appRuntimeMode: "memory",
  });
  assert.equal(result.close, undefined);
});

test("createRuntimeAppOptions honors APP_STORAGE_MODE=database when DATABASE_URL exists", () => {
  const result = createRuntimeAppOptions({
    APP_STORAGE_MODE: "database",
    DATABASE_URL: "postgres://postgres:postgres@localhost:5432/saas_pricing",
  });

  assert.equal(result.mode, "database");
  assert.equal(result.appOptions.appRuntimeMode, "database");
  assert.ok(result.appOptions.transactionRunner);
  assert.equal(typeof result.close, "function");
});

test("createRuntimeAppOptions rejects APP_STORAGE_MODE=database without DATABASE_URL", () => {
  assert.throws(
    () =>
      createRuntimeAppOptions({
        APP_STORAGE_MODE: "database",
      }),
    /DATABASE_URL is required when APP_STORAGE_MODE=database/,
  );
});

test("createRuntimeAppOptions rejects unknown APP_STORAGE_MODE values", () => {
  assert.throws(
    () =>
      createRuntimeAppOptions({
        APP_STORAGE_MODE: "redis",
      }),
    /APP_STORAGE_MODE must be one of: memory, database/,
  );
});
