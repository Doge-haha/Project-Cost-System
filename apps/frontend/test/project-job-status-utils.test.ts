import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { BackgroundJob, ImportTask } from "../src/lib/types";
import {
  buildCurrentJobStatusViewUrl,
  buildCsvLine,
  buildErrorReportActionKey,
  buildFailureSubsetDownload,
  buildNextJobStatusSearchParams,
  buildRecentJobStatusProcessingLinkInput,
  buildJobStatusReturnParams,
  buildSuggestedErrorReportFileName,
  findMatchingImportTaskIdForJob,
  findMatchingJobIdForImportTask,
  parseFailedLine,
  parseOptionalFilterValue,
  parseStatusFilter,
  readSelectedFile,
  resolveJobStatusSelection,
  triggerClientDownload,
} from "../src/features/projects/project-job-status-utils";

describe("project-job-status-utils", () => {
  const createObjectUrl = vi.fn<(input: Blob) => string>();
  const revokeObjectUrl = vi.fn<(value: string) => void>();
  const anchorClick = vi.fn();

  beforeEach(() => {
    Object.defineProperty(window.URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrl,
    });
    Object.defineProperty(window.URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrl,
    });
    createObjectUrl.mockReturnValue("blob:job-status");
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function click() {
      anchorClick();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    createObjectUrl.mockReset();
    revokeObjectUrl.mockReset();
    anchorClick.mockReset();
  });

  test("parses filters and failed line values safely", () => {
    expect(parseStatusFilter("queued")).toBe("queued");
    expect(parseStatusFilter("other")).toBe("all");
    expect(parseFailedLine("4")).toBe(4);
    expect(parseFailedLine("0")).toBeNull();
    expect(parseOptionalFilterValue("bill_item")).toBe("bill_item");
    expect(parseOptionalFilterValue("")).toBeNull();
  });

  test("updates job status search params for failure filters", () => {
    expect(
      buildNextJobStatusSearchParams({
        currentSearch: "status=failed&failureResourceType=bill_item&failureAction=create&failedLine=4",
        action: "setFailureReason",
        value: "missing_field",
      }).toString(),
    ).toBe("status=failed&failureReason=missing_field");

    expect(
      buildNextJobStatusSearchParams({
        currentSearch: "status=failed&failureReason=missing_field&failedLine=4",
        action: "setFailureResourceType",
        value: "bill_item",
      }).toString(),
    ).toBe("status=failed&failureReason=missing_field&failureResourceType=bill_item");

    expect(
      buildNextJobStatusSearchParams({
        currentSearch: "status=failed&failureReason=missing_field&failureResourceType=bill_item&failureAction=create&failedLine=4",
        action: "clearFailureSubfilters",
      }).toString(),
    ).toBe("status=failed&failureReason=missing_field");
  });

  test("builds recent processing link input for copied job status links", () => {
    expect(
      buildRecentJobStatusProcessingLinkInput({
        projectId: "project-001",
        search: "status=failed&failureReason=missing_field",
        label: "任务状态处理入口",
        collaborationUnitLabel: "缺少必填字段",
        batchEntries: [{ id: "failed-line-4", label: "第 4 条", path: "/jobs" }],
        selectedFailedItem: {
          lineNo: 4,
          reasonLabel: "缺少必填字段",
        },
      }),
    ).toEqual({
      projectId: "project-001",
      path: "/projects/project-001/jobs?status=failed&failureReason=missing_field",
      label: "任务状态处理入口",
      collaborationUnitLabel: "缺少必填字段",
      sourceLabel: "任务状态页",
      batchEntries: [{ id: "failed-line-4", label: "第 4 条", path: "/jobs" }],
      highlightedBatchEntryId: "failed-line-4",
      highlightedBatchEntryLabel: "第 4 条 · 缺少必填字段",
      highlightedBatchEntryPath:
        "/projects/project-001/jobs?status=failed&failureReason=missing_field&failedLine=4",
    });
  });

  test("builds job status return params for retry and project links", () => {
    expect(
      buildJobStatusReturnParams({
        target: "inbox",
        failureReasonCode: "missing_field",
      }),
    ).toBe("focus=import&refresh=jobs&failureReason=missing_field");

    expect(
      buildJobStatusReturnParams({
        target: "project",
        failureReasonCode: "missing_field",
      }),
    ).toBe("refresh=jobs&failureReason=missing_field");
  });

  test("builds job status view urls and suggested report filenames", () => {
    expect(
      buildCurrentJobStatusViewUrl({
        origin: "http://localhost",
        projectId: "project-001",
        statusFilter: "failed",
        failureReasonCode: "missing_field",
        failureResourceType: "bill_item",
        failureAction: "create",
        failedLine: 4,
      }),
    ).toBe(
      "http://localhost/projects/project-001/jobs?status=failed&failureReason=missing_field&failureResourceType=bill_item&failureAction=create&failedLine=4",
    );

    expect(
      buildSuggestedErrorReportFileName({
        importTaskId: "import-task-001",
        failureReasonCode: "missing_field",
        failureResourceType: "bill_item",
        failureAction: "create",
        hasFailureSubsetFilters: true,
      }),
    ).toBe(
      "import-task-001-error-report-current-subset-missing_field-resource-bill_item-action-create.json",
    );
    expect(buildErrorReportActionKey("filtered", "csv")).toBe("filtered:csv");
  });

  test("builds current failure subset download content", () => {
    const failedItems = [
      {
        lineNo: 4,
        reasonCode: "missing_field",
        reasonLabel: "缺少必填字段",
        errorMessage: "缺少工程量",
        projectId: "project-001",
        resourceType: "bill_item",
        action: "create",
        keys: ["projectId", "resourceType"],
        retryEventSnapshot: { projectId: "project-001" },
      },
    ];

    const jsonDownload = buildFailureSubsetDownload({
      taskId: "import-task-001",
      format: "json",
      failureReasonCode: "missing_field",
      failureResourceType: "bill_item",
      failureAction: "create",
      failedItems,
    });
    expect(jsonDownload.fileName).toBe(
      "import-task-001-error-report-current-subset-missing_field-resource-bill_item-action-create.json",
    );
    expect(jsonDownload.mimeType).toBe("application/json; charset=utf-8");
    expect(JSON.parse(jsonDownload.content).failureSnapshots).toHaveLength(1);

    const csvDownload = buildFailureSubsetDownload({
      taskId: "import-task-001",
      format: "csv",
      failureReasonCode: "missing_field",
      failureResourceType: null,
      failureAction: null,
      failedItems,
    });
    expect(csvDownload.fileName).toBe(
      "import-task-001-error-report-current-subset-missing_field.csv",
    );
    expect(csvDownload.mimeType).toBe("text/csv; charset=utf-8");
    expect(csvDownload.content).toContain("lineNo,reasonCode");
    expect(csvDownload.content).toContain("4,missing_field");
  });

  test("matches import tasks and jobs by latestJobId or payload importTaskId", () => {
    const task = {
      id: "import-task-001",
      projectId: "project-001",
      sourceType: "audit_log",
      sourceLabel: "审计日志筛选导入",
      status: "failed",
      requestedBy: "user-001",
      totalItemCount: 1,
      importedItemCount: 0,
      memoryItemCount: 0,
      failedItemCount: 1,
      latestJobId: "job-001",
      latestErrorMessage: "失败",
      failureDetails: ["失败"],
      retryCount: 0,
      retryLimit: 3,
      canRetry: true,
      metadata: {},
      createdAt: "2026-04-24T10:00:00.000Z",
      completedAt: null,
    } as ImportTask;
    const jobs = [
      {
        id: "job-001",
        jobType: "knowledge_extraction",
        status: "failed",
        requestedBy: "user-001",
        payload: {},
        createdAt: "2026-04-24T10:00:00.000Z",
      },
      {
        id: "job-002",
        jobType: "knowledge_extraction",
        status: "failed",
        requestedBy: "user-001",
        payload: { importTaskId: "import-task-002" },
        createdAt: "2026-04-24T10:01:00.000Z",
      },
    ] as BackgroundJob[];

    expect(findMatchingJobIdForImportTask(task, jobs)).toBe("job-001");
    expect(
      findMatchingImportTaskIdForJob(
        {
          id: "job-002",
          jobType: "knowledge_extraction",
          status: "failed",
          requestedBy: "user-001",
          payload: { importTaskId: "import-task-002" },
          createdAt: "2026-04-24T10:01:00.000Z",
        } as BackgroundJob,
        [
          {
            id: "import-task-001",
            projectId: "project-001",
            sourceType: "audit_log",
            sourceLabel: "审计日志筛选导入",
            status: "failed",
            requestedBy: "user-001",
            totalItemCount: 1,
            importedItemCount: 0,
            memoryItemCount: 0,
            failedItemCount: 1,
            latestJobId: "job-001",
            latestErrorMessage: "失败",
            failureDetails: ["失败"],
            retryCount: 0,
            retryLimit: 3,
            canRetry: true,
            metadata: {},
            createdAt: "2026-04-24T10:00:00.000Z",
            completedAt: null,
          },
          {
            id: "import-task-002",
            projectId: "project-001",
            sourceType: "audit_log",
            sourceLabel: "审计日志筛选导入",
            status: "failed",
            requestedBy: "user-001",
            totalItemCount: 1,
            importedItemCount: 0,
            memoryItemCount: 0,
            failedItemCount: 1,
            latestJobId: null,
            latestErrorMessage: "失败",
            failureDetails: ["失败"],
            retryCount: 0,
            retryLimit: 3,
            canRetry: true,
            metadata: {},
            createdAt: "2026-04-24T10:01:00.000Z",
            completedAt: null,
          },
        ] as ImportTask[],
      ),
    ).toBe("import-task-002");
  });

  test("resolves selected import task and job with focused and preferred ids", () => {
    const importTasks = [
      {
        id: "import-task-001",
        latestJobId: "job-001",
      },
      {
        id: "import-task-002",
        latestJobId: "job-002",
      },
    ] as ImportTask[];
    const jobs = [
      {
        id: "job-001",
        jobType: "knowledge_extraction",
        status: "failed",
        requestedBy: "user-001",
        payload: { importTaskId: "import-task-001" },
        createdAt: "2026-04-24T10:00:00.000Z",
      },
      {
        id: "job-002",
        jobType: "knowledge_extraction",
        status: "failed",
        requestedBy: "user-001",
        payload: { importTaskId: "import-task-002" },
        createdAt: "2026-04-24T10:01:00.000Z",
      },
    ] as BackgroundJob[];

    expect(
      resolveJobStatusSelection({
        importTasks,
        jobs,
        focusedImportTaskId: "import-task-001",
        focusedJobId: null,
        selectedImportTaskId: null,
        selectedJobId: null,
        preferredImportTaskId: "import-task-002",
        preferredJobId: null,
      }),
    ).toEqual({
      selectedImportTaskId: "import-task-002",
      selectedJobId: "job-002",
    });

    expect(
      resolveJobStatusSelection({
        importTasks,
        jobs,
        focusedImportTaskId: null,
        focusedJobId: "job-001",
        selectedImportTaskId: null,
        selectedJobId: null,
      }),
    ).toEqual({
      selectedImportTaskId: "import-task-001",
      selectedJobId: "job-001",
    });
  });

  test("builds csv lines and triggers client downloads", () => {
    expect(buildCsvLine(["a,b", 'c"d', "plain"])).toBe('"a,b","c""d",plain');

    triggerClientDownload({
      content: '{"ok":true}',
      fileName: "job-status.json",
      mimeType: "application/json",
    });

    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:job-status");
  });

  test("reads selected files through File.text when available", async () => {
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    await expect(readSelectedFile(file)).resolves.toBe("hello");
  });
});
