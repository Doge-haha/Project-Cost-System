import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/node-postgres/migrator";

import { createApp } from "../src/app/create-app.js";
import { createDatabaseAppOptions } from "../src/infrastructure/database/create-database-app-options.js";
import { createDatabaseClient } from "../src/infrastructure/database/database-client.js";
import { parseDatabaseConfig } from "../src/infrastructure/database/database-config.js";
import { signAccessToken } from "../src/shared/auth/jwt.js";

const jwtSecret = "database-live-smoke-secret";
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(currentDir, "../drizzle");

const shouldRunLiveSmoke = process.env.RUN_LIVE_DATABASE_SMOKE === "1";

test("database live smoke serves project routes against a real postgres connection", async (t) => {
  if (!shouldRunLiveSmoke) {
    t.skip("Set RUN_LIVE_DATABASE_SMOKE=1 to run the live Postgres smoke test");
    return;
  }

  const env = {
    DATABASE_URL: process.env.DATABASE_URL,
  };
  const runtime = createDatabaseClient(parseDatabaseConfig(env));
  const suffix = Date.now().toString(36);
  const projectId = `live-project-${suffix}`;
  const stageId = `live-stage-${suffix}`;
  const disciplineId = `live-discipline-${suffix}`;
  const memberId = `live-member-${suffix}`;
  const scopeId = `live-scope-${suffix}`;
  const userId = `live-user-${suffix}`;

  try {
    await migrate(runtime.db, {
      migrationsFolder,
    });

    await runtime.pool.query(
      `insert into project (id, code, name, status) values ($1, $2, $3, 'draft')`,
      [projectId, `LIVE-${suffix}`, "真实数据库模式项目"],
    );
    await runtime.pool.query(
      `insert into project_stage (id, project_id, stage_code, stage_name, status, sequence_no) values ($1, $2, 'estimate', '投资估算', 'draft', 1)`,
      [stageId, projectId],
    );
    await runtime.pool.query(
      `insert into project_discipline (id, project_id, discipline_code, discipline_name, default_standard_set_code, status) values ($1, $2, 'building', '建筑工程', 'JS-2014', 'enabled')`,
      [disciplineId, projectId],
    );
    await runtime.pool.query(
      `insert into project_member (id, project_id, user_id, display_name, role_code) values ($1, $2, $3, 'Live Owner', 'project_owner')`,
      [memberId, projectId, userId],
    );
    await runtime.pool.query(
      `insert into project_member_scope (id, member_id, scope_type, scope_value) values ($1, $2, 'project', $3)`,
      [scopeId, memberId, projectId],
    );

    const { appOptions, close } = createDatabaseAppOptions(env);
    const app = createApp({
      jwtSecret,
      ...appOptions,
    });
    const token = await signAccessToken(
      {
        sub: userId,
        roleCodes: ["project_owner"],
        displayName: "Live Owner",
      },
      jwtSecret,
    );

    const projectResponse = await app.inject({
      method: "GET",
      url: `/v1/projects/${projectId}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    const stageResponse = await app.inject({
      method: "GET",
      url: `/v1/projects/${projectId}/stages`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(projectResponse.statusCode, 200);
    assert.equal(projectResponse.json().id, projectId);
    assert.equal(stageResponse.statusCode, 200);
    assert.equal(stageResponse.json().items.length, 1);

    await app.close();
    await close();
  } finally {
    await runtime.close();
  }
});
