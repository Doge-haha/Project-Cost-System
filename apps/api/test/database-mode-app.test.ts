import test from "node:test";
import assert from "node:assert/strict";

import { createApp } from "../src/app/create-app.js";
import { createDatabaseAppOptions } from "../src/infrastructure/database/create-database-app-options.js";
import { signAccessToken } from "../src/shared/auth/jwt.js";
import { createPgMemDatabase } from "./helpers/pg-mem.js";

const jwtSecret = "database-mode-test-secret";

test("database-mode app serves project and stage queries through database-backed repositories", async () => {
  const runtime = await createPgMemDatabase();
  try {
    await runtime.pool.query(
      "insert into project (id, code, name, status) values ('project-001', 'PRJ-001', '数据库模式项目', 'draft')",
    );
    await runtime.pool.query(
      "insert into project_stage (id, project_id, stage_code, stage_name, status, sequence_no) values ('stage-001', 'project-001', 'estimate', '投资估算', 'draft', 1)",
    );
    await runtime.pool.query(
      "insert into project_discipline (id, project_id, discipline_code, discipline_name, default_standard_set_code, status) values ('discipline-001', 'project-001', 'building', '建筑工程', 'JS-2014', 'enabled')",
    );
    await runtime.pool.query(
      "insert into project_member (id, project_id, user_id, display_name, role_code) values ('member-001', 'project-001', 'user-001', 'Owner User', 'project_owner')",
    );
    await runtime.pool.query(
      "insert into project_member_scope (id, member_id, scope_type, scope_value) values ('scope-001', 'member-001', 'project', 'project-001')",
    );

    const { appOptions, close } = createDatabaseAppOptions(
      {
        DATABASE_URL: "postgres://postgres:postgres@localhost:5432/saas_pricing",
      },
      {
        createDatabaseClient: () => runtime,
      },
    );
    const app = createApp({
      jwtSecret,
      ...appOptions,
    });
    const token = await signAccessToken(
      {
        sub: "user-001",
        roleCodes: ["system_admin"],
        displayName: "System Admin",
      },
      jwtSecret,
    );

    const listResponse = await app.inject({
      method: "GET",
      url: "/v1/projects",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    const stageResponse = await app.inject({
      method: "GET",
      url: "/v1/projects/project-001/stages",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(listResponse.statusCode, 200);
    assert.equal(listResponse.json().items.length, 1);
    assert.deepEqual(listResponse.json().pagination, {
      page: 1,
      pageSize: 20,
      total: 1,
    });
    assert.equal(stageResponse.statusCode, 200);
    assert.equal(stageResponse.json().items.length, 1);

    await app.close();
    await close();
  } finally {
    try {
      await runtime.close();
    } catch {
      // runtime may already be closed through createDatabaseAppOptions.close()
    }
  }
});
