import test from "node:test";
import assert from "node:assert/strict";

import { InMemoryBackgroundJobRepository } from "../../api/src/modules/jobs/background-job-repository.js";
import { InMemoryReportExportTaskRepository } from "../../api/src/modules/reports/report-export-task-repository.js";
import { createGatewayTestApp } from "./helpers/http-gateway-harness.js";
import {
  createGatewayTestApiApp,
  createGatewayTestToken,
} from "./helpers/project-seeds.js";

test("export-summary-report tool and report-export-status resource stay aligned over HTTP", async () => {
  const apiApp = createGatewayTestApiApp({
    appOptions: {
      backgroundJobRepository: new InMemoryBackgroundJobRepository([]),
      reportExportTaskRepository: new InMemoryReportExportTaskRepository([]),
    },
  });
  const gatewayApp = createGatewayTestApp(apiApp);
  const token = await createGatewayTestToken();

  try {
    const exportResponse = await gatewayApp.inject({
      method: "POST",
      url: "/v1/tools/export-summary-report",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        projectId: "project-001",
        reportType: "summary",
        stageCode: "estimate",
        disciplineCode: "building",
        reportTemplateId: "tpl-standard-summary-v1",
        outputFormat: "pdf",
      },
    });

    assert.equal(exportResponse.statusCode, 200);
    assert.equal(exportResponse.json().type, "tool_result");
    assert.equal(exportResponse.json().tool, "export_summary_report");
    assert.equal(exportResponse.json().result.job.jobType, "report_export");
    assert.equal(exportResponse.json().result.job.status, "queued");
    assert.equal(exportResponse.json().result.result.status, "queued");
    assert.equal(exportResponse.json().result.result.reportType, "summary");
    assert.equal(
      exportResponse.json().result.job.payload.reportTemplateId,
      "tpl-standard-summary-v1",
    );
    assert.equal(exportResponse.json().result.job.payload.outputFormat, "pdf");
    assert.equal(
      exportResponse.json().execution.jobId,
      exportResponse.json().result.job.id,
    );
    assert.equal(
      exportResponse.json().related.reportExportTask.query.taskId,
      exportResponse.json().result.result.id,
    );

    const statusResponse = await gatewayApp.inject({
      method: "GET",
      url: `/v1/resources/report-export-status?taskId=${exportResponse.json().result.result.id}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(statusResponse.statusCode, 200);
    assert.equal(statusResponse.json().type, "resource");
    assert.equal(statusResponse.json().resourceType, "report_export_status");
    assert.equal(statusResponse.json().scope.taskId, exportResponse.json().result.result.id);
    assert.equal(statusResponse.json().data.id, exportResponse.json().result.result.id);
    assert.equal(statusResponse.json().data.projectId, "project-001");
    assert.equal(statusResponse.json().data.reportType, "summary");
    assert.equal(statusResponse.json().data.status, "queued");
    assert.equal(statusResponse.json().data.isDownloadReady, false);
  } finally {
    await gatewayApp.close();
    await apiApp.close();
  }
});
