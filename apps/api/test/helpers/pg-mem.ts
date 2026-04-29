import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import { newDb } from "pg-mem";

import * as schema from "../../src/infrastructure/database/schema.js";

export async function createPgMemDatabase() {
  const memoryDb = newDb({
    autoCreateForeignKeyIndices: true,
  });
  const adapter = memoryDb.adapters.createPg();
  const stripUnsupportedTypes = (query: unknown) => {
    if (query && typeof query === "object") {
      const cloned = { ...(query as Record<string, unknown>) };
      delete cloned.types;
      delete cloned.rowMode;
      return cloned;
    }
    return query;
  };
  const originalPoolQuery = adapter.Pool.prototype.query;
  const originalClientQuery = adapter.Client.prototype.query;
  adapter.Pool.prototype.query = function (
    query: unknown,
    ...args: unknown[]
  ) {
    return Promise.resolve(
      originalPoolQuery.call(this, stripUnsupportedTypes(query), ...args),
    ).then((result: any) =>
      typeof query === "string" ? normalizeResultRows(result) : result,
    );
  };
  adapter.Client.prototype.query = function (
    query: unknown,
    ...args: unknown[]
  ) {
    return Promise.resolve(
      originalClientQuery.call(this, stripUnsupportedTypes(query), ...args),
    ).then((result: any) =>
      typeof query === "string" ? normalizeResultRows(result) : result,
    );
  };
  const pool = new adapter.Pool();

  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const migrationsDir = path.resolve(currentDir, "../../drizzle");
  const migrationFiles = readdirSync(migrationsDir)
    .filter((entry) => entry.endsWith(".sql"))
    .sort();

  for (const fileName of migrationFiles) {
    const sqlText = readFileSync(path.join(migrationsDir, fileName), "utf8");
    const statements = sqlText
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      memoryDb.public.none(statement);
    }
  }

  const db = drizzle(pool, { schema });

  return {
    memoryDb,
    pool,
    db,
    async close() {
      await pool.end();
    },
  };
}

function normalizeResultRows<T extends { rows?: unknown[] }>(result: T): T {
  if (!Array.isArray(result.rows)) {
    return result;
  }

  result.rows = result.rows.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return row;
    }

    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[toCamelCaseKey(key)] = value;
    }
    return normalized;
  });

  return result;
}

function toCamelCaseKey(value: string): string {
  return value.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}
