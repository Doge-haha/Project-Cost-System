import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { BackgroundJob, ImportTask } from "../src/lib/types";
import {
  buildCsvLine,
  findMatchingImportTaskIdForJob,
  findMatchingJobIdForImportTask,
  parseFailedLine,
  parseOptionalFilterValue,
  parseStatusFilter,
  readSelectedFile,
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
