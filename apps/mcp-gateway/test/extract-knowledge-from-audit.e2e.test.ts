import test from "node:test";
import assert from "node:assert/strict";

import { InMemoryAuditLogRepository } from "../../api/src/modules/audit/audit-log-repository.js";
import type { AuditLogRecord } from "../../api/src/modules/audit/audit-log-repository.js";
import { InMemoryBackgroundJobRepository } from "../../api/src/modules/jobs/background-job-repository.js";
import { InMemoryImportTaskRepository } from "../../api/src/modules/import/import-task-repository.js";
import { createGatewayTestApp } from "./helpers/http-gateway-harness.js";
import {
  createGatewayTestApiApp,
  createGatewayTestToken,
} from "./helpers/project-seeds.js";

const seededAuditLogs: AuditLogRecord[] = [
  {
    id: "audit-log-001",
    projectId: "project-001",
    stageCode: "estimate",
    resourceType: "bill_version",
    resourceId: "bill-version-001",
    action: "submit",
    operatorId: "user-002",
    beforePayload: { versionStatus: "editable" },
    afterPayload: { versionStatus: "submitted" },
    createdAt: "2026-04-24T09:00:00.000Z",
  },
  {
    id: "audit-log-002",
    projectId: "project-001",
    stageCode: "estimate",
    resourceType: "bill_version",
    resourceId: "bill-version-002",
    action: "submit",
    operatorId: "user-002",
    beforePayload: { versionStatus: "editable" },
    afterPayload: { versionStatus: "submitted" },
    createdAt: "2026-04-24T09:10:00.000Z",
  },
  {
    id: "audit-log-003",
    projectId: "project-001",
    stageCode: "estimate",
    resourceType: "bill_item",
    resourceId: "bill-item-001",
    action: "create",
    operatorId: "user-002",
    beforePayload: null,
    afterPayload: { name: "清单项" },
    createdAt: "2026-04-24T09:20:00.000Z",
  },
];

test("extract-knowledge-from-audit creates import task and job over HTTP", async () => {
  const apiApp = createGatewayTestApiApp({
    appOptions: {
      auditLogRepository: new InMemoryAuditLogRepository(seededAuditLogs),
      backgroundJobRepository: new InMemoryBackgroundJobRepository([]),
      importTaskRepository: new InMemoryImportTaskRepository([]),
    },
  });
  const gatewayApp = createGatewayTestApp(apiApp);
  const token = await createGatewayTestToken();

  try {
    const response = await gatewayApp.inject({
      method: "POST",
      url: "/v1/tools/extract-knowledge-from-audit",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        projectId: "project-001",
        resourceType: "bill_version",
        action: "submit",
        limit: 2,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().type, "tool_result");
    assert.equal(response.json().tool, "extract_knowledge_from_audit");
    assert.equal(response.json().target.projectId, "project-001");
    assert.equal(response.json().target.resourceType, "bill_version");
    assert.equal(response.json().target.action, "submit");
    assert.equal(response.json().target.limit, 2);
    assert.equal(response.json().result.eventCount, 2);
    assert.equal(response.json().result.source, "audit_log");
    assert.equal(response.json().result.task.status, "queued");
    assert.equal(response.json().result.task.sourceLabel, "审计日志筛选导入");
    assert.equal(response.json().result.task.totalItemCount, 2);
    assert.equal(response.json().result.job.jobType, "knowledge_extraction");
    assert.equal(response.json().result.job.status, "queued");
    assert.equal(
      response.json().execution.jobId,
      response.json().result.job.id,
    );
    assert.deepEqual(response.json().result.job.payload.events.map(
      (event: { id: string }) => event.id,
    ), ["audit-log-002", "audit-log-001"]);
  } finally {
    await gatewayApp.close();
    await apiApp.close();
  }
});
