import test from "node:test";
import assert from "node:assert/strict";

import { BackgroundJobService } from "../src/modules/jobs/background-job-service.js";
import { InMemoryBackgroundJobRepository } from "../src/modules/jobs/background-job-repository.js";
import { InMemoryProjectRepository } from "../src/modules/project/project-repository.js";
import { InMemoryProjectStageRepository } from "../src/modules/project/project-stage-repository.js";
import { InMemoryProjectDisciplineRepository } from "../src/modules/project/project-discipline-repository.js";
import { InMemoryProjectMemberRepository } from "../src/modules/project/project-member-repository.js";
import { ReportExportTaskService } from "../src/modules/reports/report-export-task-service.js";
import { InMemoryReportExportTaskRepository } from "../src/modules/reports/report-export-task-repository.js";
import { SummaryService } from "../src/modules/reports/summary-service.js";

test("BackgroundJobService requires auditLogService at construction time", () => {
  assert.throws(
    () =>
      new BackgroundJobService(
        new InMemoryBackgroundJobRepository([]),
        new InMemoryProjectRepository([]),
        new InMemoryProjectStageRepository([]),
        new InMemoryProjectDisciplineRepository([]),
        new InMemoryProjectMemberRepository([]),
        undefined,
      ),
    (error) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "MISSING_DEPENDENCY",
  );
});

test("ReportExportTaskService requires auditLogService at construction time", () => {
  assert.throws(
    () =>
      new ReportExportTaskService(
        new InMemoryReportExportTaskRepository([]),
        new InMemoryProjectRepository([]),
        {} as SummaryService,
        undefined,
      ),
    (error) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "MISSING_DEPENDENCY",
  );
});
