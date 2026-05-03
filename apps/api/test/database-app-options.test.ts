import test from "node:test";
import assert from "node:assert/strict";

import { createDatabaseAppOptions } from "../src/infrastructure/database/create-database-app-options.js";
import { DbProjectMemberRepository } from "../src/modules/project/project-member-repository.js";
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

test("DbProjectMemberRepository lists project and user members with scopes", async () => {
  const runtime = await createPgMemDatabase();
  try {
    await runtime.pool.query(
      "insert into project (id, code, name, status) values ('project-001', 'PRJ-001', '项目一', 'draft'), ('project-002', 'PRJ-002', '项目二', 'draft')",
    );
    await runtime.pool.query(
      "insert into project_member (id, project_id, user_id, display_name, role_code) values ('member-001', 'project-001', 'user-001', 'Owner User', 'project_owner'), ('member-002', 'project-002', 'user-001', 'Scoped User', 'cost_engineer')",
    );
    await runtime.pool.query(
      "insert into project_member_scope (id, member_id, scope_type, scope_value) values ('scope-001', 'member-001', 'project', 'project-001'), ('scope-002', 'member-002', 'stage', 'estimate'), ('scope-003', 'member-002', 'discipline', 'building')",
    );
    const repository = new DbProjectMemberRepository(runtime.db);

    const projectMembers = await repository.listByProjectId("project-002");
    const userMembers = await repository.listByUserId("user-001");

    assert.deepEqual(projectMembers, [
      {
        id: "member-002",
        projectId: "project-002",
        userId: "user-001",
        displayName: "Scoped User",
        roleCode: "cost_engineer",
        scopes: [
          { scopeType: "discipline", scopeValue: "building" },
          { scopeType: "stage", scopeValue: "estimate" },
        ],
      },
    ]);
    assert.deepEqual(
      userMembers.map((member) => member.projectId),
      ["project-001", "project-002"],
    );
  } finally {
    await runtime.close();
  }
});

test("DbProjectMemberRepository maps snake_case project member rows and users", async () => {
  const runtime = await createPgMemDatabase();
  try {
    await runtime.pool.query(
      "insert into project (id, code, name, status) values ('project-001', 'PRJ-001', '项目一', 'draft')",
    );
    await runtime.pool.query(
      "insert into project_member (id, project_id, user_id, display_name, role_code) values ('member-001', 'project-001', 'user-001', 'Owner User', 'project_owner')",
    );
    await runtime.pool.query(
      "insert into project_member_scope (id, member_id, scope_type, scope_value) values ('scope-001', 'member-001', 'project', 'project-001')",
    );
    const repository = new DbProjectMemberRepository(runtime.db);

    const [member] = await repository.listByProjectId("project-001");

    assert.deepEqual(member, {
      id: "member-001",
      projectId: "project-001",
      userId: "user-001",
      displayName: "Owner User",
      roleCode: "project_owner",
      scopes: [{ scopeType: "project", scopeValue: "project-001" }],
    });
  } finally {
    await runtime.close();
  }
});

test("DbProjectMemberRepository replaces members and clears stale scopes", async () => {
  const runtime = await createPgMemDatabase();
  try {
    await runtime.pool.query(
      "insert into project (id, code, name, status) values ('project-001', 'PRJ-001', '项目一', 'draft')",
    );
    await runtime.pool.query(
      "insert into project_member (id, project_id, user_id, display_name, role_code) values ('member-old', 'project-001', 'user-old', 'Old User', 'reviewer')",
    );
    await runtime.pool.query(
      "insert into project_member_scope (id, member_id, scope_type, scope_value) values ('scope-old', 'member-old', 'stage', 'estimate')",
    );
    const repository = new DbProjectMemberRepository(runtime.db);

    const replaced = await repository.replaceByProjectId("project-001", [
      {
        id: "member-new",
        userId: "user-new",
        displayName: "New User",
        roleCode: "project_owner",
        scopes: [{ scopeType: "project", scopeValue: "project-001" }],
      },
    ]);
    const listed = await repository.listByProjectId("project-001");

    assert.deepEqual(replaced, listed);
    assert.deepEqual(listed, [
      {
        id: "member-new",
        projectId: "project-001",
        userId: "user-new",
        displayName: "New User",
        roleCode: "project_owner",
        scopes: [{ scopeType: "project", scopeValue: "project-001" }],
      },
    ]);
  } finally {
    await runtime.close();
  }
});

test("DbProjectMemberRepository clears members and scopes when replacing with empty list", async () => {
  const runtime = await createPgMemDatabase();
  try {
    await runtime.pool.query(
      "insert into project (id, code, name, status) values ('project-001', 'PRJ-001', '项目一', 'draft')",
    );
    await runtime.pool.query(
      "insert into project_member (id, project_id, user_id, display_name, role_code) values ('member-old', 'project-001', 'user-old', 'Old User', 'reviewer')",
    );
    await runtime.pool.query(
      "insert into project_member_scope (id, member_id, scope_type, scope_value) values ('scope-old', 'member-old', 'stage', 'estimate')",
    );
    const repository = new DbProjectMemberRepository(runtime.db);

    const replaced = await repository.replaceByProjectId("project-001", []);
    const listed = await repository.listByProjectId("project-001");
    const remainingScopes = await runtime.pool.query(
      "select id from project_member_scope where member_id = 'member-old'",
    );

    assert.deepEqual(replaced, []);
    assert.deepEqual(listed, []);
    assert.deepEqual(remainingScopes.rows, []);
  } finally {
    await runtime.close();
  }
});

test("DbProjectMemberRepository rejects invalid persisted scope types", async () => {
  const runtime = await createPgMemDatabase();
  try {
    await runtime.pool.query(
      "insert into project (id, code, name, status) values ('project-001', 'PRJ-001', '项目一', 'draft')",
    );
    await runtime.pool.query(
      "insert into project_member (id, project_id, user_id, display_name, role_code) values ('member-001', 'project-001', 'user-001', 'Owner User', 'project_owner')",
    );
    await runtime.pool.query(
      "insert into project_member_scope (id, member_id, scope_type, scope_value) values ('scope-001', 'member-001', 'unsupported', 'project-001')",
    );
    const repository = new DbProjectMemberRepository(runtime.db);

    await assert.rejects(() => repository.listByProjectId("project-001"), {
      message: "Project member field scopeType is invalid",
    });
  } finally {
    await runtime.close();
  }
});
