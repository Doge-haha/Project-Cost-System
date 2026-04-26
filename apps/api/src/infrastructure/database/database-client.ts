import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";

import type { DatabaseConfig } from "./database-config.js";
import * as schema from "./schema.js";

export type ApiDatabase = NodePgDatabase<typeof schema>;

export function createDatabaseClient(config: DatabaseConfig) {
  const poolConfig: PoolConfig = {
    connectionString: config.url,
    max: config.maxConnections,
    ssl:
      config.sslMode === "require" ? { rejectUnauthorized: false } : undefined,
  };
  const pool = new Pool(poolConfig);
  const db = drizzle(pool, { schema });

  return {
    pool,
    db,
    async close() {
      await pool.end();
    },
  };
}
