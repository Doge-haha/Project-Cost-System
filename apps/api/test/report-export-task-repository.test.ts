import test from "node:test";
import assert from "node:assert/strict";

import { DbReportExportTaskRepository } from "../src/modules/reports/report-export-task-repository.js";
import { createPgMemDatabase } from "./helpers/pg-mem.js";

test("DbReportExportTaskRepository persists report template and output format metadata", async () => {
  const runtime = await createPgMemDatabase();
  try {
    await runtime.pool.query(
      "insert into project (id, code, name, status) values ('project-001', 'PRJ-001', '项目 A', 'draft')",
    );

    const repository = new DbReportExportTaskRepository(runtime.db);
    const created = await repository.create({
      projectId: "project-001",
      reportType: "summary",
      status: "queued",
      requestedBy: "user-001",
      stageCode: "estimate",
      disciplineCode: "building",
      reportTemplateId: "tpl-standard-summary-v1",
      outputFormat: "pdf",
      createdAt: "2026-04-29T01:00:00.000Z",
      completedAt: null,
      errorMessage: null,
      resultPreview: null,
      downloadFileName: null,
      downloadContentType: null,
      downloadContentLength: null,
    });

    assert.equal(created.reportTemplateId, "tpl-standard-summary-v1");
    assert.equal(created.outputFormat, "pdf");

    const found = await repository.findById(created.id);
    assert.equal(found?.reportTemplateId, "tpl-standard-summary-v1");
    assert.equal(found?.outputFormat, "pdf");

    const updated = await repository.update(created.id, {
      status: "completed",
      reportTemplateId: "tpl-enterprise-summary-v2",
      outputFormat: "excel",
      resultPreview: {
        totalFinalAmount: 100,
      },
      downloadFileName: "summary.xlsx",
      downloadContentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      downloadContentLength: 2048,
      completedAt: "2026-04-29T01:01:00.000Z",
    });

    assert.equal(updated.status, "completed");
    assert.equal(updated.reportTemplateId, "tpl-enterprise-summary-v2");
    assert.equal(updated.outputFormat, "excel");
    assert.deepEqual(updated.resultPreview, { totalFinalAmount: 100 });
    assert.equal(updated.downloadFileName, "summary.xlsx");
    assert.equal(updated.downloadContentLength, 2048);
  } finally {
    await runtime.close();
  }
});
