import test from "node:test";
import assert from "node:assert/strict";

import { createApp } from "../src/app/create-app.js";
import { createDatabaseAppOptions } from "../src/infrastructure/database/create-database-app-options.js";
import { AiRuntimePreviewService } from "../src/modules/ai/ai-runtime-preview-service.js";
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

test("database-mode app aggregates provider telemetry after database filters and limit", async () => {
  const runtime = await createPgMemDatabase();
  try {
    await runtime.pool.query(
      "insert into project (id, code, name, status) values ('project-001', 'PRJ-001', '数据库模式项目一', 'draft'), ('project-002', 'PRJ-002', '数据库模式项目二', 'draft')",
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
    await runtime.pool.query(`
      insert into background_job
        (id, job_type, status, requested_by, project_id, payload, result, error_message, created_at, completed_at)
      values
        ('job-other-newer', 'ai_recommendation', 'completed', 'user-002', 'project-002', '{"projectId":"project-002","provider":"other","model":"other-model"}', '{"provider":{"provider":"other","model":"other-model"},"telemetry":{"durationMs":1000,"retryCount":0}}', null, '2026-04-20T12:00:00.000Z', '2026-04-20T12:00:01.000Z'),
        ('job-target-failed', 'ai_recommendation', 'failed', 'user-001', 'project-001', '{"projectId":"project-001","provider":"deepseek","model":"deepseek-chat"}', '{"providerFailureSummary":{"provider":"deepseek","model":"deepseek-chat","durationMs":16000,"retryCount":2}}', 'AI provider failed', '2026-04-20T11:00:00.000Z', '2026-04-20T11:00:16.000Z'),
        ('job-target-completed', 'ai_recommendation', 'completed', 'user-001', 'project-001', '{"projectId":"project-001","provider":"openai_compatible","model":"cost-model-v1"}', '{"provider":{"provider":"openai_compatible","model":"cost-model-v1"},"telemetry":{"durationMs":4000,"retryCount":1}}', null, '2026-04-20T10:00:00.000Z', '2026-04-20T10:00:04.000Z'),
        ('job-target-other-type', 'project_recalculate', 'completed', 'user-001', 'project-001', '{"projectId":"project-001"}', '{"recalculatedCount":1}', null, '2026-04-20T09:00:00.000Z', '2026-04-20T09:00:01.000Z')
    `);

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

    const response = await app.inject({
      method: "GET",
      url: "/v1/projects/project-001/ai/provider-telemetry?limit=2",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().totalCount, 2);
    assert.equal(response.json().successCount, 1);
    assert.equal(response.json().failureCount, 1);
    assert.equal(response.json().averageDurationMs, 10000);
    assert.equal(response.json().p95DurationMs, 16000);
    assert.equal(response.json().maxRetryCount, 2);
    assert.deepEqual(
      response.json().groups.map((group: { provider: string }) => group.provider),
      ["deepseek", "openai_compatible"],
    );

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

test("database-mode provider health does not require a global audit project", async () => {
  const runtime = await createPgMemDatabase();
  try {
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
      aiRuntimePreviewService: new AiRuntimePreviewService({
        pythonExecutable: "python3",
        cliPath: "/tmp/ai-runtime-cli.py",
        commandRunner: async () => ({
          stdout: JSON.stringify({
            source: "llm_provider",
            result: {
              provider: "openai_compatible",
              configured: false,
              healthy: false,
              message: "LLM_API_KEY is required",
            },
          }),
          stderr: "",
        }),
      }),
    });
    const token = await signAccessToken(
      {
        sub: "system-admin-001",
        roleCodes: ["system_admin"],
        displayName: "System Admin",
      },
      jwtSecret,
    );

    const response = await app.inject({
      method: "GET",
      url: "/v1/ai/provider-health",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().healthy, false);
    assert.equal(response.json().message, "LLM_API_KEY is required");

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

test("database-mode report summary allows system admin worker access without project membership", async () => {
  const runtime = await createPgMemDatabase();
  try {
    await runtime.pool.query(
      "insert into project (id, code, name, status) values ('project-001', 'PRJ-001', '数据库模式项目', 'draft')",
    );
    await runtime.pool.query(
      "insert into project_stage (id, project_id, stage_code, stage_name, status, sequence_no) values ('stage-001', 'project-001', 'estimate', '投资估算', 'draft', 1)",
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
        sub: "system-admin-001",
        roleCodes: ["system_admin"],
        displayName: "System Admin",
      },
      jwtSecret,
    );

    const response = await app.inject({
      method: "GET",
      url: "/v1/reports/summary?projectId=project-001",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().projectId, "project-001");
    assert.equal(response.json().versionCount, 0);

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
