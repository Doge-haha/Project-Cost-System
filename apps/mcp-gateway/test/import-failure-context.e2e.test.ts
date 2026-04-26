import test from "node:test";
import assert from "node:assert/strict";

import {
  InMemoryBackgroundJobRepository,
  type BackgroundJobRecord,
} from "../../api/src/modules/jobs/background-job-repository.js";
import {
  InMemoryImportTaskRepository,
  type ImportTaskRecord,
} from "../../api/src/modules/import/import-task-repository.js";
import { createGatewayTestApp } from "./helpers/http-gateway-harness.js";
import {
  createGatewayTestApiApp,
  createGatewayTestToken,
} from "./helpers/project-seeds.js";

test("import failure context resource and retry tool stay in sync over HTTP", async () => {
  const importTasks: ImportTaskRecord[] = [
    {
      id: "import-task-020",
      projectId: "project-001",
      sourceType: "audit_log",
      sourceLabel: "审计日志筛选导入",
      sourceFileName: "review-events.xlsx",
      sourceBatchNo: "audit-20260424-020",
      status: "failed",
      requestedBy: "user-001",
      totalItemCount: 2,
      importedItemCount: 0,
      memoryItemCount: 0,
      failedItemCount: 2,
      latestJobId: "background-job-020",
      latestErrorMessage: "runtime unavailable",
      failureDetails: ["runtime unavailable"],
      retryCount: 0,
      retryLimit: 3,
      canRetry: true,
      metadata: {
        retryHistory: [],
        failedItems: [
          {
            lineNo: 4,
            reasonCode: "missing_field",
            reasonLabel: "缺少必填字段",
            errorMessage: "缺少工程量",
            projectId: "project-001",
            resourceType: "bill_item",
            action: "create",
            keys: ["projectId", "resourceType", "action", "name"],
            retryEventSnapshot: {
              projectId: "project-001",
              resourceType: "bill_item",
              action: "create",
              name: "某清单项",
            },
          },
          {
            lineNo: 5,
            reasonCode: "missing_field",
            reasonLabel: "缺少必填字段",
            errorMessage: "缺少构件名称",
            projectId: "project-001",
            resourceType: "bill_item",
            action: "create",
            keys: ["projectId", "resourceType", "action", "name"],
            retryEventSnapshot: {
              projectId: "project-001",
              resourceType: "bill_item",
              action: "create",
              name: "另一清单项",
            },
          },
        ],
        failureSnapshots: [
          {
            lineNo: 4,
            reasonCode: "missing_field",
            resourceType: "bill_item",
            action: "create",
            retryEventSnapshot: {
              projectId: "project-001",
              resourceType: "bill_item",
              action: "create",
              name: "某清单项",
            },
          },
          {
            lineNo: 5,
            reasonCode: "missing_field",
            resourceType: "bill_item",
            action: "create",
            retryEventSnapshot: {
              projectId: "project-001",
              resourceType: "bill_item",
              action: "create",
              name: "另一清单项",
            },
          },
        ],
      },
      createdAt: "2026-04-24T10:00:00.000Z",
      completedAt: "2026-04-24T10:05:00.000Z",
    },
  ];

  const backgroundJobs: BackgroundJobRecord[] = [
    {
      id: "background-job-020",
      jobType: "knowledge_extraction",
      status: "failed",
      requestedBy: "user-001",
      projectId: "project-001",
      payload: {
        projectId: "project-001",
        source: "audit_log",
        importTaskId: "import-task-020",
        events: [],
      },
      result: null,
      errorMessage: "runtime unavailable",
      createdAt: "2026-04-24T10:00:00.000Z",
      completedAt: "2026-04-24T10:05:00.000Z",
    },
  ];

  const apiApp = createGatewayTestApiApp({
    appOptions: {
      backgroundJobRepository: new InMemoryBackgroundJobRepository(backgroundJobs),
      importTaskRepository: new InMemoryImportTaskRepository(importTasks),
    },
  });

  const gatewayApp = createGatewayTestApp(apiApp);

  const token = await createGatewayTestToken();

  try {
    const beforeRetryResponse = await gatewayApp.inject({
      method: "GET",
      url: "/v1/resources/import-failure-context?projectId=project-001&failureReason=missing_field&failureResourceType=bill_item&failureAction=create",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(beforeRetryResponse.statusCode, 200);
    assert.equal(beforeRetryResponse.json().data.importTaskId, "import-task-020");
    assert.equal(beforeRetryResponse.json().data.status, "failed");
    assert.deepEqual(beforeRetryResponse.json().data.filteredSummary, {
      itemCount: 2,
      missingFieldCount: 2,
      retrySnapshotCount: 2,
      resourceTypes: [{ label: "bill_item", count: 2 }],
      actions: [{ label: "create", count: 2 }],
    });

    const retryResponse = await gatewayApp.inject({
      method: "POST",
      url: "/v1/tools/retry-import-failure-scope",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        jobId: "background-job-020",
        failureReason: "missing_field",
        failureResourceType: "bill_item",
        failureAction: "create",
      },
    });

    assert.equal(retryResponse.statusCode, 200);
    assert.equal(retryResponse.json().result.id, "background-job-020");
    assert.equal(retryResponse.json().execution.jobId, "background-job-020");
    assert.deepEqual(retryResponse.json().result.payload.retryContext, {
      failureReason: "missing_field",
      failureResourceType: "bill_item",
      failureAction: "create",
    });
    assert.deepEqual(retryResponse.json().result.payload.retryEvents, [
      {
        projectId: "project-001",
        resourceType: "bill_item",
        action: "create",
        name: "某清单项",
      },
      {
        projectId: "project-001",
        resourceType: "bill_item",
        action: "create",
        name: "另一清单项",
      },
    ]);

    const afterRetryResponse = await gatewayApp.inject({
      method: "GET",
      url: "/v1/resources/import-failure-context?projectId=project-001&failureReason=missing_field&failureResourceType=bill_item&failureAction=create",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(afterRetryResponse.statusCode, 200);
    assert.equal(afterRetryResponse.json().data.status, "queued");
    assert.equal(afterRetryResponse.json().data.importTaskId, "import-task-020");
    assert.equal(afterRetryResponse.json().data.retryCount, 1);
    assert.deepEqual(afterRetryResponse.json().data.retryContext, {
      failureReason: "missing_field",
      failureResourceType: "bill_item",
      failureAction: "create",
    });
    assert.equal(afterRetryResponse.json().data.failureSnapshots.length, 2);
  } finally {
    await gatewayApp.close();
    await apiApp.close();
  }
});
