import test from "node:test";
import assert from "node:assert/strict";

import {
  InlineTransactionRunner,
  PgTransactionRunner,
} from "../src/shared/tx/transaction.js";

test("InlineTransactionRunner executes the operation directly", async () => {
  const runner = new InlineTransactionRunner();
  const result = await runner.runInTransaction(async () => "ok");

  assert.equal(result, "ok");
});

test("PgTransactionRunner commits successful operations", async () => {
  const queries: string[] = [];
  const runner = new PgTransactionRunner({
    pool: {
      async connect() {
        return {
          async query(sql: string) {
            queries.push(sql);
          },
          release() {
            queries.push("RELEASE");
          },
        };
      },
    },
  });

  const result = await runner.runInTransaction(async () => "done");

  assert.equal(result, "done");
  assert.deepEqual(queries, ["BEGIN", "COMMIT", "RELEASE"]);
});

test("PgTransactionRunner rolls back failed operations", async () => {
  const queries: string[] = [];
  const runner = new PgTransactionRunner({
    pool: {
      async connect() {
        return {
          async query(sql: string) {
            queries.push(sql);
          },
          release() {
            queries.push("RELEASE");
          },
        };
      },
    },
  });

  await assert.rejects(
    () =>
      runner.runInTransaction(async () => {
        throw new Error("boom");
      }),
    /boom/,
  );

  assert.deepEqual(queries, ["BEGIN", "ROLLBACK", "RELEASE"]);
});
