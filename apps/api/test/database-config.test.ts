import test from "node:test";
import assert from "node:assert/strict";

import { parseDatabaseConfig } from "../src/infrastructure/database/database-config.js";

test("parseDatabaseConfig requires DATABASE_URL", () => {
  assert.throws(
    () =>
      parseDatabaseConfig({
        DATABASE_URL: undefined,
      }),
    /DATABASE_URL is required/,
  );
});

test("parseDatabaseConfig applies defaults for optional fields", () => {
  assert.deepEqual(
    parseDatabaseConfig({
      DATABASE_URL: "postgres://postgres:postgres@localhost:5432/saas_pricing",
    }),
    {
      url: "postgres://postgres:postgres@localhost:5432/saas_pricing",
      maxConnections: 10,
      sslMode: "disable",
    },
  );
});

test("parseDatabaseConfig parses max connections and ssl mode", () => {
  assert.deepEqual(
    parseDatabaseConfig({
      DATABASE_URL: "postgres://postgres:postgres@localhost:5432/saas_pricing",
      DATABASE_MAX_CONNECTIONS: "25",
      DATABASE_SSL_MODE: "require",
    }),
    {
      url: "postgres://postgres:postgres@localhost:5432/saas_pricing",
      maxConnections: 25,
      sslMode: "require",
    },
  );
});

test("parseDatabaseConfig rejects invalid max connections", () => {
  assert.throws(
    () =>
      parseDatabaseConfig({
        DATABASE_URL: "postgres://postgres:postgres@localhost:5432/saas_pricing",
        DATABASE_MAX_CONNECTIONS: "0",
      }),
    /DATABASE_MAX_CONNECTIONS must be a positive integer/,
  );
});

test("parseDatabaseConfig rejects unsupported ssl modes", () => {
  assert.throws(
    () =>
      parseDatabaseConfig({
        DATABASE_URL: "postgres://postgres:postgres@localhost:5432/saas_pricing",
        DATABASE_SSL_MODE: "on",
      }),
    /DATABASE_SSL_MODE must be one of: disable, require/,
  );
});
