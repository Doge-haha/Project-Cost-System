import test from "node:test";
import assert from "node:assert/strict";

import { InMemoryBackgroundJobRepository } from "../../api/src/modules/jobs/background-job-repository.js";
import { InMemoryImportTaskRepository } from "../../api/src/modules/import/import-task-repository.js";
import { createGatewayTestApp } from "./helpers/http-gateway-harness.js";
import {
  createGatewayTestApiApp,
  createGatewayTestToken,
} from "./helpers/project-seeds.js";

test("extract-knowledge tool exposes job status and history over HTTP", async () => {
  const apiApp = createGatewayTestApiApp({
    appOptions: {
      backgroundJobRepository: new InMemoryBackgroundJobRepository([]),
      importTaskRepository: new InMemoryImportTaskRepository([]),
    },
  });
  const gatewayApp = createGatewayTestApp(apiApp);
  const token = await createGatewayTestToken();

  try {
    const extractResponse = await gatewayApp.inject({
      method: "POST",
      url: "/v1/tools/extract-knowledge",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        projectId: "project-001",
        source: "review_submission",
        events: [
          {
            projectId: "project-001",
            resourceType: "review_submission",
            action: "approve",
          },
        ],
      },
    });

    assert.equal(extractResponse.statusCode, 200);
    assert.equal(extractResponse.json().type, "tool_result");
    assert.equal(extractResponse.json().tool, "extract_knowledge");
    assert.equal(extractResponse.json().result.task.projectId, "project-001");
    assert.equal(extractResponse.json().result.task.sourceType, "review_submission");
    assert.equal(extractResponse.json().result.task.totalItemCount, 1);
    assert.equal(extractResponse.json().result.job.jobType, "knowledge_extraction");
    assert.equal(extractResponse.json().result.job.status, "queued");
    assert.equal(
      extractResponse.json().execution.jobId,
      extractResponse.json().result.job.id,
    );

    const jobStatusResponse = await gatewayApp.inject({
      method: "GET",
      url: `/v1/resources/job-status?jobId=${extractResponse.json().result.job.id}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(jobStatusResponse.statusCode, 200);
    assert.equal(jobStatusResponse.json().data.id, extractResponse.json().result.job.id);
    assert.equal(jobStatusResponse.json().data.jobType, "knowledge_extraction");
    assert.equal(jobStatusResponse.json().data.payload.importTaskId, extractResponse.json().result.task.id);

    const historyResponse = await gatewayApp.inject({
      method: "GET",
      url: "/v1/resources/knowledge-extraction-history?projectId=project-001&requestedBy=user-001&status=queued&limit=5",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(historyResponse.statusCode, 200);
    assert.equal(historyResponse.json().resourceType, "knowledge_extraction_history");
    assert.equal(historyResponse.json().data.items.length, 1);
    assert.equal(historyResponse.json().data.items[0].id, extractResponse.json().result.job.id);
    assert.equal(historyResponse.json().data.summary.totalCount, 1);
  } finally {
    await gatewayApp.close();
    await apiApp.close();
  }
});
