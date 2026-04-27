import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ProjectJobStatusPage } from "../src/features/projects/project-job-status-page";
import { saveRecentProcessingLink } from "../src/features/projects/recent-processing-link";

function createJsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

describe("ProjectJobStatusPage", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const clipboardWriteText = vi.fn<(value: string) => Promise<void>>();
  const createObjectUrl = vi.fn<(input: Blob) => string>();
  const revokeObjectUrl = vi.fn<(value: string) => void>();
  const anchorClick = vi.fn();
  const scrollIntoViewMock = vi.fn();
  const downloadedFiles: string[] = [];

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: clipboardWriteText,
      },
    });
    Object.defineProperty(window.URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrl,
    });
    Object.defineProperty(window.URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrl,
    });
    createObjectUrl.mockReturnValue("blob:mock-error-report");
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function click(
      this: HTMLAnchorElement,
    ) {
      downloadedFiles.push(this.download);
      anchorClick();
    });
    vi.stubGlobal(
      "location",
      new URL("http://localhost/projects/project-001/jobs?status=failed"),
    );
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    clipboardWriteText.mockReset();
    createObjectUrl.mockReset();
    revokeObjectUrl.mockReset();
    anchorClick.mockReset();
    scrollIntoViewMock.mockReset();
    downloadedFiles.length = 0;
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  test("renders failed jobs and retries from the job status page", async () => {
    saveRecentProcessingLink({
      projectId: "project-001",
      path: "/projects/project-001/process-documents?documentId=doc-001&action=approve",
      label: "过程单据处理入口",
      sourceLabel: "过程单据页",
    });

    let jobStatus = "failed";
    let jobError = "计算失败";
    let importTasks: any[] = [
      {
        id: "import-task-001",
        projectId: "project-001",
        sourceType: "audit_log",
        sourceLabel: "审计日志筛选导入",
        sourceFileName: "review-events.xlsx",
        sourceBatchNo: "audit-20260418-001",
        status: "failed",
        requestedBy: "user-001",
        totalItemCount: 8,
        importedItemCount: 0,
        memoryItemCount: 0,
        failedItemCount: 8,
        latestJobId: "job-001",
        latestErrorMessage: "计算失败",
        failureDetails: ["计算失败"],
        retryCount: 2,
        retryLimit: 3,
        canRetry: true,
        metadata: {
          createdFrom: "audit_log",
          sourceFileName: "review-events.xlsx",
          sourceBatchNo: "audit-20260418-001",
          failureDetails: ["计算失败"],
          retryCount: 2,
          retryLimit: 3,
          parseSummary: {
            totalEventCount: 8,
            fieldKeys: ["projectId", "resourceType", "action"],
            resourceTypes: ["review_submission"],
            actions: ["reject"],
            missingProjectIdCount: 0,
            missingActionCount: 0,
          },
          previewItems: [
            {
              lineNo: 1,
              projectId: "project-001",
              resourceType: "review_submission",
              action: "reject",
              keys: ["projectId", "resourceType", "action"],
            },
            {
              lineNo: 2,
              projectId: "project-001",
              resourceType: "review_submission",
              action: null,
              keys: ["projectId", "resourceType"],
            },
            {
              lineNo: 4,
              projectId: "project-001",
              resourceType: "bill_item",
              action: "create",
              keys: ["projectId", "resourceType", "action"],
            },
          ],
          retryHistory: [
            {
              attempt: 2,
              operatorId: "user-001",
              triggeredAt: "2026-04-18T13:20:00.000Z",
              previousStatus: "failed",
            },
          ],
          failureSummary: [
            {
              reasonCode: "missing_field",
              reasonLabel: "缺少必填字段",
              count: 2,
            },
            {
              reasonCode: "invalid_value",
              reasonLabel: "字段值非法",
              count: 1,
            },
          ],
          failedItems: [
            {
              lineNo: 2,
              reasonCode: "missing_field",
              reasonLabel: "缺少必填字段",
              errorMessage: "缺少 action",
              projectId: "project-001",
              resourceType: "review_submission",
              action: null,
              keys: ["projectId", "resourceType"],
            },
            {
              lineNo: 4,
              reasonCode: "missing_field",
              reasonLabel: "缺少必填字段",
              errorMessage: "缺少工程量",
              projectId: "project-001",
              resourceType: "bill_item",
              action: "create",
              keys: ["projectId", "resourceType", "action", "name"],
            },
            {
              lineNo: 5,
              reasonCode: "invalid_value",
              reasonLabel: "字段值非法",
              errorMessage: "amount 必须是数字",
              projectId: "project-001",
              resourceType: "bill_item",
              action: "update",
              keys: ["projectId", "resourceType", "action", "amount"],
            },
          ],
        },
        createdAt: "2026-04-18T13:00:00.000Z",
        completedAt: "2026-04-18T13:10:00.000Z",
      },
    ];

    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse({
          project: {
            id: "project-001",
            code: "PRJ-001",
            name: "新点造价项目",
            status: "draft",
          },
          currentStage: null,
          availableStages: [],
          disciplines: [],
          billVersions: [],
          todoSummary: {
            totalCount: 0,
            pendingReviewCount: 0,
            pendingProcessDocumentCount: 0,
            draftProcessDocumentCount: 0,
            items: [],
          },
          riskSummary: {
            totalCount: 1,
            rejectedReviewCount: 0,
            rejectedProcessDocumentCount: 0,
            failedJobCount: 1,
            items: ["1 个异步任务执行失败"],
          },
          importStatus: {
            mode: "import_task",
            totalCount: 1,
            queuedCount: 0,
            processingCount: 0,
            completedCount: 0,
            failedCount: 1,
            latestTask: {
              id: "import-task-001",
              sourceType: "audit_log",
              sourceLabel: "审计日志筛选导入",
              status: jobStatus,
              createdAt: "2026-04-18T13:00:00.000Z",
            },
            note: "导入状态已切换为正式导入任务模型，工作台摘要与导入任务记录保持一致。",
          },
          currentUser: {
            userId: "user-001",
            displayName: "Owner User",
            memberId: "member-001",
            permissionSummary: {
              roleCode: "project_owner",
              roleLabel: "项目负责人",
              canManageProject: true,
              canEditProject: true,
              scopeSummary: ["项目全部范围"],
              visibleStageCodes: [],
              visibleDisciplineCodes: [],
            },
          },
        });
      }

      if (
        url.pathname === "/v1/projects/project-001/import-tasks"
      ) {
        return createJsonResponse({
          items: importTasks,
          summary: {
            totalCount: importTasks.length,
            statusCounts: {
              queued: importTasks.filter((task) => task.status === "queued").length,
              processing: 0,
              completed: importTasks.filter((task) => task.status === "completed").length,
              failed: importTasks.filter((task) => task.status === "failed").length,
            },
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/import-tasks/upload") {
        importTasks = [
          {
            id: "import-task-002",
            projectId: "project-001",
            sourceType: "file_upload",
            sourceLabel: "文件导入：import-events.json",
            sourceFileName: "import-events.json",
            sourceBatchNo: "upload-20260421093045",
            status: "queued",
            requestedBy: "user-001",
            totalItemCount: 2,
            importedItemCount: 0,
            memoryItemCount: 0,
            failedItemCount: 0,
            latestJobId: "job-002",
            latestErrorMessage: null,
            failureDetails: [],
            retryCount: 0,
            retryLimit: 3,
            canRetry: true,
            metadata: {
              createdFrom: "project_file_upload",
              sourceFileName: "import-events.json",
              sourceBatchNo: "upload-20260421093045",
              detectedFormat: "json_array",
              failureDetails: [],
              retryCount: 0,
              retryLimit: 3,
              parseSummary: {
                totalEventCount: 2,
                fieldKeys: ["projectId", "action"],
                resourceTypes: [],
                actions: ["submit"],
                missingProjectIdCount: 0,
                missingActionCount: 1,
              },
              previewItems: [
                {
                  lineNo: 1,
                  projectId: "project-001",
                  resourceType: null,
                  action: null,
                  keys: ["projectId"],
                },
                {
                  lineNo: 2,
                  projectId: "project-001",
                  resourceType: null,
                  action: "submit",
                  keys: ["projectId", "action"],
                },
              ],
              retryHistory: [],
            },
            createdAt: "2026-04-21T09:30:45.000Z",
            completedAt: null,
          },
          ...importTasks,
        ];
        return createJsonResponse({
          task: importTasks[0],
          job: {
            id: "job-002",
          },
          eventCount: 2,
        });
      }

      if (
        url.pathname ===
        "/v1/projects/project-001/import-tasks/import-task-001/error-report"
      ) {
        const failureReason = url.searchParams.get("failureReason");
        const format = url.searchParams.get("format");
        return new Response(
          format === "csv"
            ? "lineNo,reasonCode\n5,invalid_value\n"
            : JSON.stringify({
                taskId: "import-task-001",
                failedItems: (importTasks[0]?.metadata.failedItems ?? []).filter((item: any) =>
                  failureReason ? item.reasonCode === failureReason : true,
                ),
              }),
          {
            status: 200,
            headers: {
              "content-type":
                format === "csv"
                  ? "text/csv; charset=utf-8"
                  : "application/json; charset=utf-8",
              "content-disposition":
                format === "csv"
                  ? `attachment; filename="import-task-001-error-report-${
                      failureReason
                        ? `current-filter-${failureReason}`
                        : "all-failed-items"
                    }.csv"`
                  : `attachment; filename="import-task-001-error-report-${
                      failureReason
                        ? `current-filter-${failureReason}`
                        : "all-failed-items"
                    }.json"`,
            },
          },
        );
      }

      if (
        url.pathname === "/v1/jobs" &&
        url.searchParams.get("projectId") === "project-001" &&
        url.searchParams.get("status") === "failed"
      ) {
        return createJsonResponse({
          items: [
            {
              id: "job-001",
              jobType: "project_recalculate",
              status: jobStatus,
              requestedBy: "user-001",
              projectId: "project-001",
              payload: {
                projectId: "project-001",
              },
              result: null,
              errorMessage: jobError,
              createdAt: "2026-04-18T13:00:00.000Z",
              completedAt: "2026-04-18T13:10:00.000Z",
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              queued: 0,
              processing: 0,
              completed: 0,
              failed: 1,
            },
            jobTypeCounts: {
              report_export: 0,
              project_recalculate: 1,
              knowledge_extraction: 0,
            },
          },
        });
      }

      if (url.pathname === "/v1/jobs/job-001/retry") {
        jobStatus = "queued";
        jobError = null as unknown as string;
        return createJsonResponse({
          id: "job-001",
          status: "queued",
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter
        initialEntries={[
          "/projects/project-001/jobs?status=failed&failureReason=missing_field",
        ]}
      >
        <Routes>
          <Route
            path="/projects/:projectId/jobs"
            element={
              <>
                <ProjectJobStatusPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByRole("heading", { name: "任务状态页" }).length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText("项目重算 · failed")).toHaveLength(2);
    expect(screen.getAllByText("审计日志筛选导入 · 失败")).toHaveLength(2);
    expect(
      screen.getAllByText("文件 review-events.xlsx · 批次 audit-20260418-001").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("重试 2/3 · 仍可重试")).toBeInTheDocument();
    expect(screen.getByText("错误信息：计算失败")).toBeInTheDocument();
    expect(screen.getByText("批次详情")).toBeInTheDocument();
    expect(screen.getByText("来源 审计日志导入 · 格式 系统未记录")).toBeInTheDocument();
    expect(screen.getByText("关联任务：job-001")).toBeInTheDocument();
    expect(
      screen.getByText("共 8 条事件 · 资源类型 review_submission · 动作 reject"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "第 1 条 · 项目 project-001 · 资源 review_submission · 动作 reject · 字段 projectId、resourceType、action",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/第 2 次 · 由 user-001 发起 · 来自状态 failed/)).toBeInTheDocument();
    expect(screen.getByText("失败原因归类")).toBeInTheDocument();
    expect(screen.getByText("缺少必填字段 · 2 条")).toBeInTheDocument();
    expect(screen.getByText("字段值非法 · 1 条")).toBeInTheDocument();
    expect(screen.getByText("当前协作视角：缺少必填字段")).toBeInTheDocument();
    expect(screen.getByText("最近协作动作：过程单据页复制了过程单据处理入口")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "回到过程单据页" })).toHaveAttribute(
      "href",
      "/projects/project-001/process-documents?documentId=doc-001&action=approve",
    );
    expect(screen.queryByRole("link", { name: "打开最近协作入口" })).not.toBeInTheDocument();
    expect(screen.getByText("当前筛选运营摘要")).toBeInTheDocument();
    expect(screen.getByText("当前范围：缺少必填字段 · 共 2 条")).toBeInTheDocument();
    expect(
      screen.getByText("缺字段相关：2 条 · 可回看原始预览：2 条 · 可重建快照：0 条"),
    ).toBeInTheDocument();
    expect(screen.getByText("批量动作建议")).toBeInTheDocument();
    expect(
      screen.getByText("当前有 2 条缺字段相关失败，建议优先回源补字段后再重新导入。"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("当前问题集中在 bill_item / create，建议优先检查这一类导入映射和字段装配规则。"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("当前子集都保留了原始预览，适合逐条复核后再决定是否回源修数。"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("当前仍是“缺少必填字段”的大范围视角，可继续按资源类型或动作收束后再处理。"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "复制给协作同事" }));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(
        [
          "当前处理范围：缺少必填字段",
          "失败条目数：2",
          "缺字段相关：2 条",
          "可回看原始预览：2 条",
          "可重建快照：0 条",
          "主要资源类型：bill_item",
          "主要动作：create",
          "建议动作：",
          "- 当前有 2 条缺字段相关失败，建议优先回源补字段后再重新导入。",
          "- 当前问题集中在 bill_item / create，建议优先检查这一类导入映射和字段装配规则。",
          "- 当前子集都保留了原始预览，适合逐条复核后再决定是否回源修数。",
          "当前链接：http://localhost/projects/project-001/jobs?status=failed&failureReason=missing_field",
        ].join("\n"),
      );
    });
    expect(
      screen.getByText("已复制协作同事版处理摘要，可直接发给当前跟进同事。"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "复制给上游数据方" }));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(
        [
          "需要协助排查的数据范围：缺少必填字段",
          "涉及失败条目：2 条",
          "其中缺字段相关：2 条",
          "当前保留原始预览：2 条",
          "当前可重建快照：0 条",
          "主要对象类型：bill_item",
          "主要动作类型：create",
          "优先请核对是否缺少必填字段，或字段名与约定不一致。",
          "当前系统建议：当前有 2 条缺字段相关失败，建议优先回源补字段后再重新导入。",
          "建议对应导出文件：import-task-001-error-report-current-filter-missing_field.json",
          "当前链接：http://localhost/projects/project-001/jobs?status=failed&failureReason=missing_field",
        ].join("\n"),
      );
    });
    expect(
      screen.getAllByText("已复制上游数据方版处理摘要，可直接发给上游排查。").length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "bill_item · 1 条" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "review_submission · 1 条" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "create · 1 条" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "未提供 · 1 条" })).toBeInTheDocument();
    expect(screen.getByText("失败条目")).toBeInTheDocument();
    expect(screen.getByText(/第 2 条 · 缺少必填字段 · 缺少 action/)).toBeInTheDocument();
    expect(screen.queryByText(/第 5 条 · 字段值非法 · amount 必须是数字/)).not.toBeInTheDocument();
    expect(screen.getByText("当前筛选：缺少必填字段")).toBeInTheDocument();
    expect(screen.getByText(/第 4 条 · 缺少必填字段 · 缺少工程量/)).toBeInTheDocument();
    expect(screen.getByText("可点击任一失败条目进入单条回看，复制链接时会保留当前定位。")).toBeInTheDocument();
    expect(screen.getByText("当前筛选缺少完整可重建输入，本次将按整条任务重新入队。")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "重试任务" }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "bill_item · 1 条" }));
    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "?status=failed&failureReason=missing_field&failureResourceType=bill_item",
    );
    expect(screen.getByText("当前范围：缺少必填字段 · 共 1 条")).toBeInTheDocument();
    expect(screen.getByText("当前收束：资源 bill_item · 动作未收束")).toBeInTheDocument();
    expect(screen.queryByText(/第 2 条 · 缺少必填字段 · 缺少 action/)).not.toBeInTheDocument();
    expect(screen.getByText(/第 4 条 · 缺少必填字段 · 缺少工程量/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "create · 1 条" }));
    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "?status=failed&failureReason=missing_field&failureResourceType=bill_item&failureAction=create",
    );
    expect(screen.getByText("当前收束：资源 bill_item · 动作 create")).toBeInTheDocument();
    expect(screen.getByText("当前范围：缺少必填字段 · 共 1 条")).toBeInTheDocument();
    expect(
      screen.getByText("导出当前子集将包含：缺少必填字段 · 资源 bill_item · 动作 create；导出整批将包含：全部失败条目。"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("当前已经收束到较小子集，适合直接导出当前子集并作为协作处理单元。"),
    ).toBeInTheDocument();
    expect(screen.getByText("当前失败子集处理单")).toBeInTheDocument();
    expect(
      screen.getByText("建议将当前子集作为一个独立处理单元交接，避免再次口头解释范围。"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("处理范围：缺少必填字段 · 资源 bill_item · 动作 create"),
    ).toBeInTheDocument();
    expect(screen.getByText("失败条目：1 条")).toBeInTheDocument();
    expect(screen.getByText("可重建快照：0 条")).toBeInTheDocument();
    expect(screen.getByText("建议导出文件：import-task-001-error-report-current-subset-missing_field-resource-bill_item-action-create.json")).toBeInTheDocument();
    expect(
      screen.getByText("建议动作：当前有 1 条缺字段相关失败，建议优先回源补字段后再重新导入。"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("处理链接：http://localhost/projects/project-001/jobs?status=failed&failureReason=missing_field&failureResourceType=bill_item&failureAction=create"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "复制当前处理单" }));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(
        [
          "失败子集处理单",
          "处理范围：缺少必填字段 · 资源 bill_item · 动作 create",
          "失败条目：1 条",
          "可重建快照：0 条",
          "主要资源类型：bill_item",
          "主要动作：create",
          "建议动作：当前有 1 条缺字段相关失败，建议优先回源补字段后再重新导入。",
          "建议导出文件：import-task-001-error-report-current-subset-missing_field-resource-bill_item-action-create.json",
          "处理链接：http://localhost/projects/project-001/jobs?status=failed&failureReason=missing_field&failureResourceType=bill_item&failureAction=create",
        ].join("\n"),
      );
    });
    expect(screen.getByText("已复制当前失败子集处理单，可直接作为协作处理单元转交。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "复制给协作同事" }));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(
        [
          "当前处理范围：缺少必填字段 · 资源 bill_item · 动作 create",
          "失败条目数：1",
          "缺字段相关：1 条",
          "可回看原始预览：1 条",
          "可重建快照：0 条",
          "主要资源类型：bill_item",
          "主要动作：create",
          "建议动作：",
          "- 当前有 1 条缺字段相关失败，建议优先回源补字段后再重新导入。",
          "- 当前问题集中在 bill_item / create，建议优先检查这一类导入映射和字段装配规则。",
          "- 当前子集都保留了原始预览，适合逐条复核后再决定是否回源修数。",
          "当前链接：http://localhost/projects/project-001/jobs?status=failed&failureReason=missing_field&failureResourceType=bill_item&failureAction=create",
        ].join("\n"),
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "复制给上游数据方" }));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(
        [
          "需要协助排查的数据范围：缺少必填字段 · 资源 bill_item · 动作 create",
          "涉及失败条目：1 条",
          "其中缺字段相关：1 条",
          "当前保留原始预览：1 条",
          "当前可重建快照：0 条",
          "主要对象类型：bill_item",
          "主要动作类型：create",
          "优先请核对是否缺少必填字段，或字段名与约定不一致。",
          "当前系统建议：当前有 1 条缺字段相关失败，建议优先回源补字段后再重新导入。",
          "建议对应导出文件：import-task-001-error-report-current-subset-missing_field-resource-bill_item-action-create.json",
          "当前链接：http://localhost/projects/project-001/jobs?status=failed&failureReason=missing_field&failureResourceType=bill_item&failureAction=create",
        ].join("\n"),
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "复制当前处理链接" }));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(
        "http://localhost/projects/project-001/jobs?status=failed&failureReason=missing_field&failureResourceType=bill_item&failureAction=create",
      );
    });
    expect(
      screen.getAllByText("已复制当前处理链接，可直接发给协作同事。").at(-1),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "打开刚复制入口" })).toHaveAttribute(
      "href",
      "/projects/project-001/jobs?status=failed&failureReason=missing_field&failureResourceType=bill_item&failureAction=create",
    );
    expect(screen.getAllByText("导出当前子集").at(-1)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导出当前子集（JSON）" })).toBeInTheDocument();

    const fetchCallCountBeforeSubsetExport = fetchMock.mock.calls.length;
    fireEvent.click(screen.getAllByRole("button", { name: "导出当前子集（JSON）" }).at(-1)!);
    expect(fetchMock.mock.calls).toHaveLength(fetchCallCountBeforeSubsetExport);
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:mock-error-report");
    expect(downloadedFiles[0]).toBe(
      "import-task-001-error-report-current-subset-missing_field-resource-bill_item-action-create.json",
    );
    expect(
      screen.getByText("已导出当前子集（缺少必填字段 · 资源 bill_item · 动作 create，JSON）。"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "去重新导入修复文件" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "去重新导入修复文件" }));
    expect(scrollIntoViewMock).toHaveBeenCalled();
    expect(
      screen.getByText(
        "已定位到上传区。修复“缺少必填字段 · 资源 bill_item · 动作 create”后，可直接上传新的 JSON/JSONL 文件重新导入。",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查看当前原因下全部条目" }));
    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "?status=failed&failureReason=missing_field",
    );
    expect(screen.queryByText("当前收束：资源 bill_item · 动作 create")).not.toBeInTheDocument();
    expect(screen.getByText("当前范围：缺少必填字段 · 共 2 条")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "第 4 条 · 缺少必填字段 · 缺少工程量 · 项目 project-001 · 资源 bill_item · 动作 create · 字段 projectId、resourceType、action、name",
      }),
    );
    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "?status=failed&failureReason=missing_field&failedLine=4",
    );
    expect(screen.getByText("当前定位：第 4 条 · 缺少必填字段")).toBeInTheDocument();
    expect(screen.getByText("单条回看")).toBeInTheDocument();
    expect(screen.getByText("当前进度：第 2 / 2 条")).toBeInTheDocument();
    expect(screen.getByText("错误信息：缺少工程量")).toBeInTheDocument();
    expect(
      screen.getByText("当前链接已保留该条定位，便于协作同事打开后直接回看同一条失败记录。"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("本条已具备可重建快照，可直接纳入当前子集重试。"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("原始条目预览")).toBeInTheDocument();
    expect(
      screen.getByText("第 4 条 · 项目 project-001 · 资源 bill_item · 动作 create"),
    ).toBeInTheDocument();
    expect(screen.getByText("原始字段：projectId、resourceType、action")).toBeInTheDocument();
    expect(
      screen.getByText("失败条目字段：projectId、resourceType、action、name"),
    ).toBeInTheDocument();
    expect(screen.getByText("缺少关键字段：name")).toBeInTheDocument();
    expect(screen.getByText("仅原始条目存在的字段：未发现")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "上一条失败记录" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "下一条失败记录" })).toBeDisabled();
    fireEvent.click(screen.getAllByRole("button", { name: "复制当前处理链接" }).at(-1)!);
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(
        "http://localhost/projects/project-001/jobs?status=failed&failureReason=missing_field&failedLine=4",
      );
    });
    expect(screen.getByText("已复制当前处理链接，可直接发给协作同事。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "打开刚复制入口" })).toHaveAttribute(
      "href",
      "/projects/project-001/jobs?status=failed&failureReason=missing_field&failedLine=4",
    );

    fireEvent.click(screen.getByRole("button", { name: "上一条失败记录" }));
    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "?status=failed&failureReason=missing_field&failedLine=2",
    );
    expect(screen.getByText("当前定位：第 2 条 · 缺少必填字段")).toBeInTheDocument();
    expect(screen.getByText("当前进度：第 1 / 2 条")).toBeInTheDocument();
    expect(
      screen.getByText("第 2 条 · 项目 project-001 · 资源 review_submission · 动作 未提供"),
    ).toBeInTheDocument();
    expect(screen.getByText("缺少关键字段：未发现")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "上一条失败记录" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "下一条失败记录" })).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "下一条失败记录" }));
    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "?status=failed&failureReason=missing_field&failedLine=4",
    );
    expect(screen.getByText("当前定位：第 4 条 · 缺少必填字段")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "返回失败列表" }));
    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "?status=failed&failureReason=missing_field",
    );
    expect(screen.queryByText("单条回看")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole("button", { name: "重试任务" }).at(-1)!,
    );

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([input, init]) =>
            String(input).includes("/v1/jobs/job-001/retry") &&
            init?.method === "POST" &&
            (() => {
              const payload =
                typeof init?.body === "string"
                  ? (JSON.parse(init.body) as Record<string, unknown>)
                  : null;

              return !payload?.failureReason;
            })(),
        ),
      ).toBe(true);
    });
    await waitFor(() => {
      expect(screen.getAllByText(/失败任务已重新入队/).length).toBeGreaterThan(0);
    });

    expect(screen.getByRole("link", { name: "返回项目工作台" })).toHaveAttribute(
      "href",
      "/projects/project-001?refresh=jobs&failureReason=missing_field",
    );
    expect(screen.getAllByRole("link", { name: "返回待办页" })[0]).toHaveAttribute(
      "href",
      "/projects/project-001/inbox?focus=import&refresh=jobs&failureReason=missing_field",
    );

    fireEvent.click(screen.getByRole("button", { name: "查看全部失败条目" }));
    expect(screen.getByTestId("location-search")).toHaveTextContent("?status=failed");
    expect(screen.queryByText("当前筛选：缺少必填字段")).not.toBeInTheDocument();
    expect(screen.queryByText("当前定位：第 4 条 · 缺少必填字段")).not.toBeInTheDocument();
    expect(screen.getByText(/第 5 条 · 字段值非法 · amount 必须是数字/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "字段值非法 · 1 条" }));
    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "?status=failed&failureReason=invalid_value",
    );
    expect(screen.getByText("当前协作视角：字段值非法")).toBeInTheDocument();
    expect(screen.getByText("当前筛选：字段值非法")).toBeInTheDocument();
    expect(screen.getByText("当前范围：字段值非法 · 共 1 条")).toBeInTheDocument();
    expect(
      screen.getByText("缺字段相关：0 条 · 可回看原始预览：0 条 · 可重建快照：0 条"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("当前问题集中在 bill_item / update，建议优先检查这一类导入映射和字段装配规则。"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("当前子集没有原始预览，建议优先导出当前范围并交给上游数据提供方排查。"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("当前仍是“字段值非法”的大范围视角，可继续按资源类型或动作收束后再处理。"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "复制给协作同事" }));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(
        [
          "当前处理范围：字段值非法",
          "失败条目数：1",
          "缺字段相关：0 条",
          "可回看原始预览：0 条",
          "可重建快照：0 条",
          "主要资源类型：bill_item",
          "主要动作：update",
          "建议动作：",
          "- 当前问题集中在 bill_item / update，建议优先检查这一类导入映射和字段装配规则。",
          "- 当前子集没有原始预览，建议优先导出当前范围并交给上游数据提供方排查。",
          "- 当前仍是“字段值非法”的大范围视角，可继续按资源类型或动作收束后再处理。",
          "当前链接：http://localhost/projects/project-001/jobs?status=failed&failureReason=invalid_value",
        ].join("\n"),
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "复制给上游数据方" }));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(
        [
          "需要协助排查的数据范围：字段值非法",
          "涉及失败条目：1 条",
          "其中缺字段相关：0 条",
          "当前保留原始预览：0 条",
          "当前可重建快照：0 条",
          "主要对象类型：bill_item",
          "主要动作类型：update",
          "当前没有可回看的原始预览，请优先补充原始数据样例或导出源文件。",
          "当前系统建议：当前问题集中在 bill_item / update，建议优先检查这一类导入映射和字段装配规则。",
          "建议对应导出文件：import-task-001-error-report-current-filter-invalid_value.json",
          "当前链接：http://localhost/projects/project-001/jobs?status=failed&failureReason=invalid_value",
        ].join("\n"),
      );
    });
    expect(screen.getByRole("button", { name: "bill_item · 1 条" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "update · 1 条" })).toBeInTheDocument();
    expect(
      screen.getByText("导出当前筛选将包含：字段值非法；导出整批将包含：全部失败条目。"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("导出当前筛选").at(-1)).toBeInTheDocument();
    expect(screen.getAllByText("导出整批失败条目").at(-1)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "复制当前筛选链接" })[0]!);
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(
        "http://localhost/projects/project-001/jobs?status=failed&failureReason=invalid_value",
      );
    });
    expect(screen.getByText("已复制当前筛选链接，可直接发给协作同事。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "打开刚复制入口" })).toHaveAttribute(
      "href",
      "/projects/project-001/jobs?status=failed&failureReason=invalid_value",
    );
    expect(screen.getByRole("button", { name: "继续查看当前筛选" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "继续查看当前筛选" }));
    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "?status=failed&failureReason=invalid_value",
    );
    fireEvent.click(screen.getByRole("button", { name: "导出当前筛选（JSON）" }));
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes(
            "/v1/projects/project-001/import-tasks/import-task-001/error-report?failureReason=invalid_value",
          ),
        ),
      ).toBe(true);
    });
    expect(createObjectUrl).toHaveBeenCalledTimes(2);
    expect(anchorClick).toHaveBeenCalledTimes(2);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:mock-error-report");
    expect(downloadedFiles[1]).toBe(
      "import-task-001-error-report-current-filter-invalid_value.json",
    );
    expect(screen.getByText("已导出当前筛选（字段值非法，JSON）。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "继续查看字段值非法" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "继续查看字段值非法" }));
    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "?status=failed&failureReason=invalid_value",
    );
    fireEvent.click(screen.getByRole("button", { name: "导出当前筛选（CSV）" }));
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes(
            "/v1/projects/project-001/import-tasks/import-task-001/error-report?failureReason=invalid_value&format=csv",
          ),
        ),
      ).toBe(true);
    });
    expect(createObjectUrl).toHaveBeenCalledTimes(3);
    expect(anchorClick).toHaveBeenCalledTimes(3);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:mock-error-report");
    fireEvent.click(screen.getByRole("button", { name: "导出整批（JSON）" }));
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes(
            "/v1/projects/project-001/import-tasks/import-task-001/error-report",
          ) && !String(input).includes("failureReason="),
        ),
      ).toBe(true);
    });
    expect(createObjectUrl).toHaveBeenCalledTimes(4);
    expect(anchorClick).toHaveBeenCalledTimes(4);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:mock-error-report");
    fireEvent.click(screen.getByRole("button", { name: "导出整批（CSV）" }));
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes(
            "/v1/projects/project-001/import-tasks/import-task-001/error-report?format=csv",
          ),
        ),
      ).toBe(true);
    });
    expect(createObjectUrl).toHaveBeenCalledTimes(5);
    expect(anchorClick).toHaveBeenCalledTimes(5);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:mock-error-report");
    expect(downloadedFiles[4]).toBe(
      "import-task-001-error-report-all-failed-items.csv",
    );
    expect(screen.getByText("已导出整批失败条目（CSV）。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "清除协作视角" }));
    expect(screen.getByTestId("location-search")).toHaveTextContent("?status=failed");
    expect(screen.queryByText("当前协作视角：字段值非法")).not.toBeInTheDocument();
    expect(
      screen.getByText("当前可导出范围：全部失败条目。"),
    ).toBeInTheDocument();
    expect(screen.queryAllByText("导出当前筛选")).toHaveLength(0);
    expect(screen.getAllByText("导出整批失败条目").at(-1)).toBeInTheDocument();
    expect(screen.queryByText("已复制当前筛选链接，可直接发给协作同事。")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看全部失败条目" }));
    const file = new File(
      ['[{"projectId":"project-001"},{"projectId":"project-001","action":"submit"}]'],
      "import-events.json",
      {
        type: "application/json",
      },
    );
    fireEvent.change(screen.getAllByLabelText("选择文件").at(-1)!, {
      target: {
        files: [file],
      },
    });

    await waitFor(() => {
      expect(screen.getByText("当前文件：import-events.json")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "上传并创建导入批次" }),
      ).not.toBeDisabled();
    });

    fireEvent.click(
      screen.getAllByRole("button", { name: "上传并创建导入批次" }).at(-1)!,
    );

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([input, init]) =>
            String(input).includes("/v1/projects/project-001/import-tasks/upload") &&
            init?.method === "POST",
        ),
      ).toBe(true);
    });

    expect(
      screen.getByText("已上传 import-events.json，生成 2 条导入事件。"),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: /回到刚才失败范围/ })
        .some(
          (link) =>
            link.getAttribute("href") ===
            "/projects/project-001/jobs?status=failed&importTaskId=import-task-001",
        ),
    ).toBe(true);
    expect(
      screen.getByText(
        "当前已切到新上传批次 import-events.json · import-task-002，可与刚才失败范围交替核对。",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("文件导入：import-events.json · 排队中").length).toBeGreaterThan(0);
    expect(screen.getAllByText("import-events.json · upload-20260421093045").length).toBeGreaterThan(0);
    expect(screen.getAllByText("审计日志筛选导入 · 失败").length).toBeGreaterThan(0);
  }, 30000);

  test("keeps the selected import task context after retry when the API only returns bare job fields", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse({
          project: {
            id: "project-001",
            code: "PRJ-001",
            name: "新点造价项目",
            status: "draft",
          },
          currentStage: null,
          availableStages: [],
          disciplines: [],
          billVersions: [],
          todoSummary: {
            totalCount: 0,
            pendingReviewCount: 0,
            pendingProcessDocumentCount: 0,
            draftProcessDocumentCount: 0,
            items: [],
          },
          riskSummary: {
            totalCount: 1,
            rejectedReviewCount: 0,
            rejectedProcessDocumentCount: 0,
            failedJobCount: 1,
            items: ["1 个异步任务执行失败"],
          },
          importStatus: {
            mode: "import_task",
            totalCount: 1,
            queuedCount: 0,
            processingCount: 0,
            completedCount: 0,
            failedCount: 1,
            latestTask: {
              id: "import-task-001",
              sourceType: "audit_log",
              sourceLabel: "审计日志筛选导入",
              status: "failed",
              createdAt: "2026-04-18T13:00:00.000Z",
            },
            note: "导入状态已切换为正式导入任务模型，工作台摘要与导入任务记录保持一致。",
          },
          currentUser: {
            userId: "user-001",
            displayName: "Owner User",
            memberId: "member-001",
            permissionSummary: {
              roleCode: "project_owner",
              roleLabel: "项目负责人",
              canManageProject: true,
              canEditProject: true,
              scopeSummary: ["项目全部范围"],
              visibleStageCodes: [],
              visibleDisciplineCodes: [],
            },
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/import-tasks") {
        return createJsonResponse({
          items: [
            {
              id: "import-task-001",
              projectId: "project-001",
              sourceType: "audit_log",
              sourceLabel: "审计日志筛选导入",
              sourceFileName: "review-events.xlsx",
              sourceBatchNo: "audit-20260418-001",
              status: "failed",
              requestedBy: "user-001",
              totalItemCount: 2,
              importedItemCount: 0,
              memoryItemCount: 0,
              failedItemCount: 1,
              latestJobId: "job-001",
              latestErrorMessage: "计算失败",
              failureDetails: ["计算失败"],
              retryCount: 1,
              retryLimit: 3,
              canRetry: true,
              metadata: {
                retryHistory: [],
                failureSummary: [
                  {
                    reasonCode: "missing_field",
                    reasonLabel: "缺少必填字段",
                    count: 1,
                  },
                ],
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
                  },
                ],
              },
              createdAt: "2026-04-18T13:00:00.000Z",
              completedAt: "2026-04-18T13:10:00.000Z",
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              queued: 0,
              processing: 0,
              completed: 0,
              failed: 1,
            },
          },
        });
      }

      if (url.pathname === "/v1/jobs") {
        return createJsonResponse({
          items: [
            {
              id: "job-001",
              jobType: "knowledge_extraction",
              status: "failed",
              requestedBy: "user-001",
              payload: {
                projectId: "project-001",
                source: "audit_log",
                importTaskId: "import-task-001",
                events: [],
              },
              result: null,
              errorMessage: "计算失败",
              createdAt: "2026-04-18T13:00:00.000Z",
              completedAt: "2026-04-18T13:10:00.000Z",
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              queued: 0,
              processing: 0,
              completed: 0,
              failed: 1,
            },
            jobTypeCounts: {
              knowledge_extraction: 1,
            },
          },
        });
      }

      if (url.pathname === "/v1/jobs/job-001/retry") {
        return createJsonResponse({
          id: "job-001",
          status: "queued",
          errorMessage: null,
          completedAt: null,
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter
        initialEntries={["/projects/project-001/jobs?status=failed&failureReason=missing_field"]}
      >
        <Routes>
          <Route path="/projects/:projectId/jobs" element={<ProjectJobStatusPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("文件 review-events.xlsx · 批次 audit-20260418-001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: "重试任务" }).at(-1)!);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([input, init]) =>
            String(input).includes("/v1/jobs/job-001/retry") && init?.method === "POST",
        ),
      ).toBe(true);
    });

    await waitFor(() => {
      expect(screen.getAllByText(/失败任务已重新入队/).length).toBeGreaterThan(0);
    });

    expect(screen.getByText("文件 review-events.xlsx · 批次 audit-20260418-001")).toBeInTheDocument();
    expect(screen.getByText("当前筛选：缺少必填字段")).toBeInTheDocument();
    expect(screen.queryByText("任务状态加载失败，请检查 API 连通性。")).not.toBeInTheDocument();
  });

  test("keeps the scoped failure filters when upload success offers a return link", async () => {
    let importTasks: any[] = [
      {
        id: "import-task-001",
        projectId: "project-001",
        sourceType: "audit_log",
        sourceLabel: "审计日志筛选导入",
        sourceFileName: "review-events.xlsx",
        sourceBatchNo: "audit-20260418-001",
        status: "failed",
        requestedBy: "user-001",
        totalItemCount: 3,
        importedItemCount: 0,
        memoryItemCount: 0,
        failedItemCount: 3,
        latestJobId: "job-001",
        latestErrorMessage: "计算失败",
        failureDetails: ["计算失败"],
        retryCount: 0,
        retryLimit: 3,
        canRetry: true,
        metadata: {
          failureSummary: [
            {
              reasonCode: "missing_field",
              reasonLabel: "缺少必填字段",
              count: 2,
            },
          ],
          failedItems: [
            {
              lineNo: 2,
              reasonCode: "missing_field",
              reasonLabel: "缺少必填字段",
              errorMessage: "缺少 action",
              projectId: "project-001",
              resourceType: "review_submission",
              action: null,
              keys: ["projectId", "resourceType"],
            },
            {
              lineNo: 4,
              reasonCode: "missing_field",
              reasonLabel: "缺少必填字段",
              errorMessage: "缺少工程量",
              projectId: "project-001",
              resourceType: "bill_item",
              action: "create",
              keys: ["projectId", "resourceType", "action", "name"],
            },
          ],
        },
        createdAt: "2026-04-18T13:00:00.000Z",
        completedAt: "2026-04-18T13:10:00.000Z",
      },
    ];

    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse({
          project: {
            id: "project-001",
            code: "PRJ-001",
            name: "新点造价项目",
            status: "draft",
          },
          currentStage: null,
          availableStages: [],
          disciplines: [],
          billVersions: [],
          todoSummary: {
            totalCount: 0,
            pendingReviewCount: 0,
            pendingProcessDocumentCount: 0,
            draftProcessDocumentCount: 0,
            items: [],
          },
          riskSummary: {
            totalCount: 1,
            rejectedReviewCount: 0,
            rejectedProcessDocumentCount: 0,
            failedJobCount: 1,
            items: ["1 个异步任务执行失败"],
          },
          importStatus: {
            mode: "import_task",
            totalCount: 1,
            queuedCount: 0,
            processingCount: 0,
            completedCount: 0,
            failedCount: 1,
            latestTask: {
              id: "import-task-001",
              sourceType: "audit_log",
              sourceLabel: "审计日志筛选导入",
              status: "failed",
              createdAt: "2026-04-18T13:00:00.000Z",
            },
            note: "导入状态已切换为正式导入任务模型，工作台摘要与导入任务记录保持一致。",
          },
          currentUser: {
            userId: "user-001",
            displayName: "Owner User",
            memberId: "member-001",
            permissionSummary: {
              roleCode: "project_owner",
              roleLabel: "项目负责人",
              canManageProject: true,
              canEditProject: true,
              scopeSummary: ["项目全部范围"],
              visibleStageCodes: [],
              visibleDisciplineCodes: [],
            },
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/import-tasks") {
        return createJsonResponse({
          items: importTasks,
          summary: {
            totalCount: importTasks.length,
            statusCounts: {
              queued: importTasks.filter((task) => task.status === "queued").length,
              processing: 0,
              completed: 0,
              failed: importTasks.filter((task) => task.status === "failed").length,
            },
          },
        });
      }

      if (url.pathname === "/v1/jobs") {
        return createJsonResponse({
          items: [
            {
              id: "job-001",
              jobType: "knowledge_extraction",
              status: "failed",
              requestedBy: "user-001",
              payload: {
                projectId: "project-001",
                source: "audit_log",
                importTaskId: "import-task-001",
                events: [],
              },
              result: null,
              errorMessage: "计算失败",
              createdAt: "2026-04-18T13:00:00.000Z",
              completedAt: "2026-04-18T13:10:00.000Z",
            },
            {
              id: "job-002",
              jobType: "knowledge_extraction",
              status: "queued",
              requestedBy: "user-001",
              payload: {
                projectId: "project-001",
                source: "file_upload",
                importTaskId: "import-task-002",
                events: [],
              },
              result: null,
              errorMessage: null,
              createdAt: "2026-04-21T09:30:45.000Z",
              completedAt: null,
            },
          ],
          summary: {
            totalCount: 2,
            statusCounts: {
              queued: 1,
              processing: 0,
              completed: 0,
              failed: 1,
            },
            jobTypeCounts: {
              knowledge_extraction: 2,
            },
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/import-tasks/upload") {
        expect(init?.method).toBe("POST");
        importTasks = [
          {
            id: "import-task-002",
            projectId: "project-001",
            sourceType: "file_upload",
            sourceLabel: "文件导入：fix-events.json",
            sourceFileName: "fix-events.json",
            sourceBatchNo: "upload-20260424092000",
            status: "queued",
            requestedBy: "user-001",
            totalItemCount: 1,
            importedItemCount: 0,
            memoryItemCount: 0,
            failedItemCount: 0,
            latestJobId: "job-002",
            latestErrorMessage: null,
            failureDetails: [],
            retryCount: 0,
            retryLimit: 3,
            canRetry: true,
            metadata: {},
            createdAt: "2026-04-24T09:20:00.000Z",
            completedAt: null,
          },
          ...importTasks,
        ];
        return createJsonResponse({
          task: {
            id: "import-task-002",
          },
          job: {
            id: "job-002",
          },
          eventCount: 1,
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter
        initialEntries={[
          "/projects/project-001/jobs?status=failed&failureReason=missing_field&failureResourceType=bill_item&failureAction=create",
        ]}
      >
        <Routes>
          <Route
            path="/projects/:projectId/jobs"
            element={
              <>
                <ProjectJobStatusPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("当前收束：资源 bill_item · 动作 create")).toBeInTheDocument();
    });

    const file = new File(['[{"projectId":"project-001","action":"create"}]'], "fix-events.json", {
      type: "application/json",
    });
    fireEvent.change(screen.getAllByLabelText("选择文件").at(-1)!, {
      target: {
        files: [file],
      },
    });

    await waitFor(() => {
      expect(screen.getAllByText("当前文件：fix-events.json").length).toBeGreaterThan(0);
    });

    fireEvent.click(
      screen.getAllByRole("button", { name: "上传并创建导入批次" }).at(-1)!,
    );

    await waitFor(() => {
      expect(
        screen
          .getAllByRole("link", { name: /回到刚才失败范围/ })
          .some(
            (link) =>
              (link.getAttribute("href") ?? "").includes("importTaskId=import-task-001"),
          ),
      ).toBe(true);
    });
  });

  test("does not show a comparison summary while the new uploaded batch is still processing", async () => {
    let importTasks: any[] = [
      {
        id: "import-task-001",
        projectId: "project-001",
        sourceType: "audit_log",
        sourceLabel: "审计日志筛选导入",
        sourceFileName: "review-events.xlsx",
        sourceBatchNo: "audit-20260418-001",
        status: "failed",
        requestedBy: "user-001",
        totalItemCount: 2,
        importedItemCount: 0,
        memoryItemCount: 0,
        failedItemCount: 2,
        latestJobId: "job-001",
        latestErrorMessage: "计算失败",
        failureDetails: ["计算失败"],
        retryCount: 0,
        retryLimit: 3,
        canRetry: true,
        metadata: {
          failureSummary: [
            {
              reasonCode: "missing_field",
              reasonLabel: "缺少必填字段",
              count: 2,
            },
          ],
          failedItems: [
            {
              lineNo: 2,
              reasonCode: "missing_field",
              reasonLabel: "缺少必填字段",
              errorMessage: "缺少 action",
              projectId: "project-001",
              resourceType: "review_submission",
              action: null,
              keys: ["projectId", "resourceType"],
            },
            {
              lineNo: 4,
              reasonCode: "missing_field",
              reasonLabel: "缺少必填字段",
              errorMessage: "缺少工程量",
              projectId: "project-001",
              resourceType: "bill_item",
              action: "create",
              keys: ["projectId", "resourceType", "action", "name"],
            },
          ],
        },
        createdAt: "2026-04-18T13:00:00.000Z",
        completedAt: "2026-04-18T13:10:00.000Z",
      },
    ];

    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse({
          project: {
            id: "project-001",
            code: "PRJ-001",
            name: "新点造价项目",
            status: "draft",
          },
          currentStage: null,
          availableStages: [],
          disciplines: [],
          billVersions: [],
          todoSummary: {
            totalCount: 0,
            pendingReviewCount: 0,
            pendingProcessDocumentCount: 0,
            draftProcessDocumentCount: 0,
            items: [],
          },
          riskSummary: {
            totalCount: 1,
            rejectedReviewCount: 0,
            rejectedProcessDocumentCount: 0,
            failedJobCount: 1,
            items: ["1 个异步任务执行失败"],
          },
          importStatus: {
            mode: "import_task",
            totalCount: importTasks.length,
            queuedCount: 0,
            processingCount: importTasks.filter((task) => task.status === "processing").length,
            completedCount: 0,
            failedCount: importTasks.filter((task) => task.status === "failed").length,
            latestTask: {
              id: importTasks[0].id,
              sourceType: importTasks[0].sourceType,
              sourceLabel: importTasks[0].sourceLabel,
              status: importTasks[0].status,
              createdAt: importTasks[0].createdAt,
            },
            note: "导入状态已切换为正式导入任务模型，工作台摘要与导入任务记录保持一致。",
          },
          currentUser: {
            userId: "user-001",
            displayName: "Owner User",
            memberId: "member-001",
            permissionSummary: {
              roleCode: "project_owner",
              roleLabel: "项目负责人",
              canManageProject: true,
              canEditProject: true,
              scopeSummary: ["项目全部范围"],
              visibleStageCodes: [],
              visibleDisciplineCodes: [],
            },
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/import-tasks") {
        return createJsonResponse({
          items: importTasks,
          summary: {
            totalCount: importTasks.length,
            statusCounts: {
              queued: 0,
              processing: importTasks.filter((task) => task.status === "processing").length,
              completed: 0,
              failed: importTasks.filter((task) => task.status === "failed").length,
            },
          },
        });
      }

      if (url.pathname === "/v1/jobs") {
        return createJsonResponse({
          items: [
            {
              id: "job-001",
              jobType: "knowledge_extraction",
              status: "failed",
              requestedBy: "user-001",
              payload: {
                projectId: "project-001",
                source: "audit_log",
                importTaskId: "import-task-001",
                events: [],
              },
              result: null,
              errorMessage: "计算失败",
              createdAt: "2026-04-18T13:00:00.000Z",
              completedAt: "2026-04-18T13:10:00.000Z",
            },
            {
              id: "job-002",
              jobType: "knowledge_extraction",
              status: "processing",
              requestedBy: "user-001",
              payload: {
                projectId: "project-001",
                source: "file_upload",
                importTaskId: "import-task-002",
                events: [],
              },
              result: null,
              errorMessage: null,
              createdAt: "2026-04-24T09:30:45.000Z",
              completedAt: null,
            },
          ],
          summary: {
            totalCount: 2,
            statusCounts: {
              queued: 0,
              processing: 1,
              completed: 0,
              failed: 1,
            },
            jobTypeCounts: {
              knowledge_extraction: 2,
            },
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/import-tasks/upload") {
        expect(init?.method).toBe("POST");
        importTasks = [
          {
            id: "import-task-002",
            projectId: "project-001",
            sourceType: "file_upload",
            sourceLabel: "文件导入：processing-events.json",
            sourceFileName: "processing-events.json",
            sourceBatchNo: "upload-20260424101000",
            status: "processing",
            requestedBy: "user-001",
            totalItemCount: 2,
            importedItemCount: 0,
            memoryItemCount: 0,
            failedItemCount: 0,
            latestJobId: "job-002",
            latestErrorMessage: null,
            failureDetails: [],
            retryCount: 0,
            retryLimit: 3,
            canRetry: true,
            metadata: {},
            createdAt: "2026-04-24T10:10:00.000Z",
            completedAt: null,
          },
          ...importTasks,
        ];
        return createJsonResponse({
          task: {
            id: "import-task-002",
          },
          job: {
            id: "job-002",
          },
          eventCount: 2,
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter
        initialEntries={["/projects/project-001/jobs?status=failed&failureReason=missing_field"]}
      >
        <Routes>
          <Route path="/projects/:projectId/jobs" element={<ProjectJobStatusPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText("当前筛选：缺少必填字段").length).toBeGreaterThan(0);
    });

    const file = new File(
      ['[{"projectId":"project-001","resourceType":"review_submission"},{"projectId":"project-001","resourceType":"bill_item","action":"create","name":"某清单项"}]'],
      "processing-events.json",
      {
        type: "application/json",
      },
    );
    fireEvent.change(screen.getAllByLabelText("选择文件").at(-1)!, {
      target: {
        files: [file],
      },
    });

    await waitFor(() => {
      expect(screen.getAllByText("当前文件：processing-events.json").length).toBeGreaterThan(0);
    });

    fireEvent.click(
      screen.getAllByRole("button", { name: "上传并创建导入批次" }).at(-1)!,
    );

    await waitFor(() => {
      expect(
        screen
          .getAllByRole("link", { name: /回到刚才失败范围/ })
          .some((link) => (link.getAttribute("href") ?? "").includes("importTaskId=import-task-001")),
      ).toBe(true);
    });
    expect(screen.queryByText(/对照结果：原失败范围中仍命中/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "这条对照会把旧失败是否被新批次消化、以及当前批次是否引入新的失败，拆开给你看。",
      ),
    ).not.toBeInTheDocument();
  });

  test("falls back to the existing failed batch when the uploaded batch is missing from the refresh result", async () => {
    let importTasks: any[] = [
      {
        id: "import-task-001",
        projectId: "project-001",
        sourceType: "audit_log",
        sourceLabel: "审计日志筛选导入",
        sourceFileName: "review-events.xlsx",
        sourceBatchNo: "audit-20260418-001",
        status: "failed",
        requestedBy: "user-001",
        totalItemCount: 2,
        importedItemCount: 0,
        memoryItemCount: 0,
        failedItemCount: 2,
        latestJobId: "job-001",
        latestErrorMessage: "计算失败",
        failureDetails: ["计算失败"],
        retryCount: 0,
        retryLimit: 3,
        canRetry: true,
        metadata: {
          failureSummary: [
            {
              reasonCode: "missing_field",
              reasonLabel: "缺少必填字段",
              count: 2,
            },
          ],
          failedItems: [
            {
              lineNo: 2,
              reasonCode: "missing_field",
              reasonLabel: "缺少必填字段",
              errorMessage: "缺少 action",
              projectId: "project-001",
              resourceType: "review_submission",
              action: null,
              keys: ["projectId", "resourceType"],
            },
            {
              lineNo: 4,
              reasonCode: "missing_field",
              reasonLabel: "缺少必填字段",
              errorMessage: "缺少工程量",
              projectId: "project-001",
              resourceType: "bill_item",
              action: "create",
              keys: ["projectId", "resourceType", "action", "name"],
            },
          ],
        },
        createdAt: "2026-04-18T13:00:00.000Z",
        completedAt: "2026-04-18T13:10:00.000Z",
      },
    ];
    let uploadedBatchEvicted = false;

    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse({
          project: {
            id: "project-001",
            code: "PRJ-001",
            name: "新点造价项目",
            status: "draft",
          },
          currentStage: null,
          availableStages: [],
          disciplines: [],
          billVersions: [],
          todoSummary: {
            totalCount: 0,
            pendingReviewCount: 0,
            pendingProcessDocumentCount: 0,
            draftProcessDocumentCount: 0,
            items: [],
          },
          riskSummary: {
            totalCount: 1,
            rejectedReviewCount: 0,
            rejectedProcessDocumentCount: 0,
            failedJobCount: 1,
            items: ["1 个异步任务执行失败"],
          },
          importStatus: {
            mode: "import_task",
            totalCount: importTasks.length,
            queuedCount: importTasks.filter((task) => task.status === "queued").length,
            processingCount: 0,
            completedCount: 0,
            failedCount: importTasks.filter((task) => task.status === "failed").length,
            latestTask: {
              id: importTasks[0].id,
              sourceType: importTasks[0].sourceType,
              sourceLabel: importTasks[0].sourceLabel,
              status: importTasks[0].status,
              createdAt: importTasks[0].createdAt,
            },
            note: "导入状态已切换为正式导入任务模型，工作台摘要与导入任务记录保持一致。",
          },
          currentUser: {
            userId: "user-001",
            displayName: "Owner User",
            memberId: "member-001",
            permissionSummary: {
              roleCode: "project_owner",
              roleLabel: "项目负责人",
              canManageProject: true,
              canEditProject: true,
              scopeSummary: ["项目全部范围"],
              visibleStageCodes: [],
              visibleDisciplineCodes: [],
            },
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/import-tasks") {
        const result = uploadedBatchEvicted ? importTasks.slice(1) : importTasks;
        uploadedBatchEvicted = true;
        return createJsonResponse({
          items: result,
          summary: {
            totalCount: result.length,
            statusCounts: {
              queued: result.filter((task) => task.status === "queued").length,
              processing: 0,
              completed: 0,
              failed: result.filter((task) => task.status === "failed").length,
            },
          },
        });
      }

      if (url.pathname === "/v1/jobs") {
        return createJsonResponse({
          items: [
            {
              id: "job-001",
              jobType: "knowledge_extraction",
              status: "failed",
              requestedBy: "user-001",
              payload: {
                projectId: "project-001",
                source: "audit_log",
                importTaskId: "import-task-001",
                events: [],
              },
              result: null,
              errorMessage: "计算失败",
              createdAt: "2026-04-18T13:00:00.000Z",
              completedAt: "2026-04-18T13:10:00.000Z",
            },
            {
              id: "job-002",
              jobType: "knowledge_extraction",
              status: "queued",
              requestedBy: "user-001",
              payload: {
                projectId: "project-001",
                source: "file_upload",
                importTaskId: "import-task-002",
                events: [],
              },
              result: null,
              errorMessage: null,
              createdAt: "2026-04-24T10:30:45.000Z",
              completedAt: null,
            },
          ],
          summary: {
            totalCount: 2,
            statusCounts: {
              queued: 1,
              processing: 0,
              completed: 0,
              failed: 1,
            },
            jobTypeCounts: {
              knowledge_extraction: 2,
            },
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/import-tasks/upload") {
        expect(init?.method).toBe("POST");
        importTasks = [
          {
            id: "import-task-002",
            projectId: "project-001",
            sourceType: "file_upload",
            sourceLabel: "文件导入：evicted-events.json",
            sourceFileName: "evicted-events.json",
            sourceBatchNo: "upload-20260424103045",
            status: "queued",
            requestedBy: "user-001",
            totalItemCount: 2,
            importedItemCount: 0,
            memoryItemCount: 0,
            failedItemCount: 0,
            latestJobId: "job-002",
            latestErrorMessage: null,
            failureDetails: [],
            retryCount: 0,
            retryLimit: 3,
            canRetry: true,
            metadata: {},
            createdAt: "2026-04-24T10:30:45.000Z",
            completedAt: null,
          },
          ...importTasks,
        ];
        return createJsonResponse({
          task: {
            id: "import-task-002",
          },
          job: {
            id: "job-002",
          },
          eventCount: 2,
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter
        initialEntries={["/projects/project-001/jobs?status=failed&failureReason=missing_field"]}
      >
        <Routes>
          <Route path="/projects/:projectId/jobs" element={<ProjectJobStatusPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText("当前筛选：缺少必填字段").length).toBeGreaterThan(0);
    });

    const file = new File(
      ['[{"projectId":"project-001","resourceType":"review_submission"},{"projectId":"project-001","resourceType":"bill_item","action":"create","name":"某清单项"}]'],
      "evicted-events.json",
      {
        type: "application/json",
      },
    );
    fireEvent.change(screen.getAllByLabelText("选择文件").at(-1)!, {
      target: {
        files: [file],
      },
    });

    await waitFor(() => {
      expect(screen.getByText("当前文件：evicted-events.json")).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getAllByRole("button", { name: "上传并创建导入批次" }).at(-1)!,
    );

    await waitFor(() => {
      expect(
        screen.getAllByText("文件 review-events.xlsx · 批次 audit-20260418-001").length,
      ).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("当前筛选：缺少必填字段").length).toBeGreaterThan(0);
    expect(screen.queryByText("文件 evicted-events.json · 批次 upload-20260424103045")).not.toBeInTheDocument();
    expect(screen.queryByText("任务状态加载失败，请检查 API 连通性。")).not.toBeInTheDocument();
  });

  test("shows the uploaded batch context after the refresh completes", async () => {
    let importTasks: any[] = [
      {
        id: "import-task-001",
        projectId: "project-001",
        sourceType: "audit_log",
        sourceLabel: "审计日志筛选导入",
        sourceFileName: "review-events.xlsx",
        sourceBatchNo: "audit-20260418-001",
        status: "failed",
        requestedBy: "user-001",
        totalItemCount: 3,
        importedItemCount: 0,
        memoryItemCount: 0,
        failedItemCount: 3,
        latestJobId: "job-001",
        latestErrorMessage: "计算失败",
        failureDetails: ["计算失败"],
        retryCount: 0,
        retryLimit: 3,
        canRetry: true,
        metadata: {
          failureSummary: [
            {
              reasonCode: "missing_field",
              reasonLabel: "缺少必填字段",
              count: 2,
            },
          ],
          failedItems: [
            {
              lineNo: 2,
              reasonCode: "missing_field",
              reasonLabel: "缺少必填字段",
              errorMessage: "缺少 action",
              projectId: "project-001",
              resourceType: "review_submission",
              action: null,
              keys: ["projectId", "resourceType"],
            },
            {
              lineNo: 4,
              reasonCode: "missing_field",
              reasonLabel: "缺少必填字段",
              errorMessage: "缺少工程量",
              projectId: "project-001",
              resourceType: "bill_item",
              action: "create",
              keys: ["projectId", "resourceType", "action", "name"],
            },
          ],
        },
        createdAt: "2026-04-18T13:00:00.000Z",
        completedAt: "2026-04-18T13:10:00.000Z",
      },
    ];

    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse({
          project: {
            id: "project-001",
            code: "PRJ-001",
            name: "新点造价项目",
            status: "draft",
          },
          currentStage: null,
          availableStages: [],
          disciplines: [],
          billVersions: [],
          todoSummary: {
            totalCount: 0,
            pendingReviewCount: 0,
            pendingProcessDocumentCount: 0,
            draftProcessDocumentCount: 0,
            items: [],
          },
          riskSummary: {
            totalCount: 1,
            rejectedReviewCount: 0,
            rejectedProcessDocumentCount: 0,
            failedJobCount: 1,
            items: ["1 个异步任务执行失败"],
          },
          importStatus: {
            mode: "import_task",
            totalCount: importTasks.length,
            queuedCount: importTasks.filter((task) => task.status === "queued").length,
            processingCount: 0,
            completedCount: 0,
            failedCount: importTasks.filter((task) => task.status === "failed").length,
            latestTask: {
              id: importTasks[0].id,
              sourceType: importTasks[0].sourceType,
              sourceLabel: importTasks[0].sourceLabel,
              status: importTasks[0].status,
              createdAt: importTasks[0].createdAt,
            },
            note: "导入状态已切换为正式导入任务模型，工作台摘要与导入任务记录保持一致。",
          },
          currentUser: {
            userId: "user-001",
            displayName: "Owner User",
            memberId: "member-001",
            permissionSummary: {
              roleCode: "project_owner",
              roleLabel: "项目负责人",
              canManageProject: true,
              canEditProject: true,
              scopeSummary: ["项目全部范围"],
              visibleStageCodes: [],
              visibleDisciplineCodes: [],
            },
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/import-tasks") {
        return createJsonResponse({
          items: importTasks,
          summary: {
            totalCount: importTasks.length,
            statusCounts: {
              queued: importTasks.filter((task) => task.status === "queued").length,
              processing: 0,
              completed: 0,
              failed: importTasks.filter((task) => task.status === "failed").length,
            },
          },
        });
      }

      if (url.pathname === "/v1/jobs") {
        return createJsonResponse({
          items: [
            {
              id: "job-001",
              jobType: "knowledge_extraction",
              status: "failed",
              requestedBy: "user-001",
              payload: {
                projectId: "project-001",
                source: "audit_log",
                importTaskId: "import-task-001",
                events: [],
              },
              result: null,
              errorMessage: "计算失败",
              createdAt: "2026-04-18T13:00:00.000Z",
              completedAt: "2026-04-18T13:10:00.000Z",
            },
            {
              id: "job-002",
              jobType: "knowledge_extraction",
              status: "failed",
              requestedBy: "user-001",
              payload: {
                projectId: "project-001",
                source: "file_upload",
                importTaskId: "import-task-002",
                events: [],
              },
              result: null,
              errorMessage: "新批次仍有失败",
              createdAt: "2026-04-24T09:30:45.000Z",
              completedAt: "2026-04-24T09:32:00.000Z",
            },
          ],
          summary: {
            totalCount: 2,
            statusCounts: {
              queued: 0,
              processing: 0,
              completed: 0,
              failed: 2,
            },
            jobTypeCounts: {
              knowledge_extraction: 2,
            },
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/import-tasks/upload") {
        expect(init?.method).toBe("POST");
        importTasks = [
          {
            id: "import-task-002",
            projectId: "project-001",
            sourceType: "file_upload",
            sourceLabel: "文件导入：fix-events.json",
            sourceFileName: "fix-events.json",
            sourceBatchNo: "upload-20260424093045",
            status: "failed",
            requestedBy: "user-001",
            totalItemCount: 2,
            importedItemCount: 0,
            memoryItemCount: 0,
            failedItemCount: 1,
            latestJobId: "job-002",
            latestErrorMessage: "新批次仍有失败",
            failureDetails: ["新批次仍有失败"],
            retryCount: 0,
            retryLimit: 3,
            canRetry: true,
            metadata: {
              failureSummary: [
                {
                  reasonCode: "missing_field",
                  reasonLabel: "缺少必填字段",
                  count: 1,
                },
              ],
              failedItems: [
                {
                  lineNo: 10,
                  reasonCode: "missing_field",
                  reasonLabel: "缺少必填字段",
                  errorMessage: "缺少工程量",
                  projectId: "project-001",
                  resourceType: "bill_item",
                  action: "create",
                  keys: ["projectId", "resourceType", "action", "name"],
                },
              ],
            },
            createdAt: "2026-04-24T09:30:45.000Z",
            completedAt: "2026-04-24T09:32:00.000Z",
          },
          ...importTasks,
        ];
        return createJsonResponse({
          task: {
            id: "import-task-002",
          },
          job: {
            id: "job-002",
          },
          eventCount: 2,
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter
        initialEntries={["/projects/project-001/jobs?status=failed&failureReason=missing_field"]}
      >
        <Routes>
          <Route path="/projects/:projectId/jobs" element={<ProjectJobStatusPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText("当前筛选：缺少必填字段").length).toBeGreaterThan(0);
    });

    const file = new File(
      ['[{"projectId":"project-001","resourceType":"review_submission"},{"projectId":"project-001","resourceType":"bill_item","action":"create","name":"某清单项"}]'],
      "fix-events.json",
      {
        type: "application/json",
      },
    );
    fireEvent.change(screen.getAllByLabelText("选择文件").at(-1)!, {
      target: {
        files: [file],
      },
    });

    await waitFor(() => {
      expect(screen.getAllByText("当前文件：fix-events.json").length).toBeGreaterThan(0);
    });

    fireEvent.click(
      screen.getAllByRole("button", { name: "上传并创建导入批次" }).at(-1)!,
    );

    await waitFor(() => {
      expect(
        screen
          .getAllByRole("link", { name: /回到刚才失败范围/ })
          .some((link) => (link.getAttribute("href") ?? "").includes("importTaskId=import-task-001")),
      ).toBe(true);
    });
    await waitFor(() => {
      expect(
        screen.getByText(
          "当前已切到新上传批次 import-events.json · import-task-002，可与刚才失败范围交替核对。",
        ),
      ).toBeInTheDocument();
    });
  }, 25000);

  test("removes invalid failureReason from job status URL", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse({
          project: {
            id: "project-001",
            code: "PRJ-001",
            name: "新点造价项目",
            status: "draft",
          },
          currentStage: null,
          availableStages: [],
          disciplines: [],
          billVersions: [],
          todoSummary: {
            totalCount: 0,
            pendingReviewCount: 0,
            pendingProcessDocumentCount: 0,
            draftProcessDocumentCount: 0,
            items: [],
          },
          riskSummary: {
            totalCount: 0,
            rejectedReviewCount: 0,
            rejectedProcessDocumentCount: 0,
            failedJobCount: 0,
            items: [],
          },
          importStatus: {
            mode: "import_task",
            totalCount: 0,
            queuedCount: 0,
            processingCount: 0,
            completedCount: 0,
            failedCount: 0,
            latestTask: null,
            note: "导入状态已切换为正式导入任务模型，工作台摘要与导入任务记录保持一致。",
          },
          currentUser: {
            userId: "user-001",
            displayName: "Owner User",
            memberId: "member-001",
            permissionSummary: {
              roleCode: "project_owner",
              roleLabel: "项目负责人",
              canManageProject: true,
              canEditProject: true,
              scopeSummary: ["项目全部范围"],
              visibleStageCodes: [],
              visibleDisciplineCodes: [],
            },
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/import-tasks") {
        return createJsonResponse({
          items: [],
          summary: {
            totalCount: 0,
            statusCounts: {
              queued: 0,
              processing: 0,
              completed: 0,
              failed: 0,
            },
          },
        });
      }

      if (url.pathname === "/v1/jobs") {
        return createJsonResponse({
          items: [],
          summary: {
            totalCount: 0,
            statusCounts: {
              queued: 0,
              processing: 0,
              completed: 0,
              failed: 0,
            },
            jobTypeCounts: {},
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001/jobs?failureReason=broken_code"]}>
        <Routes>
          <Route
            path="/projects/:projectId/jobs"
            element={
              <>
                <ProjectJobStatusPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByRole("heading", { name: "任务状态页" }).length).toBeGreaterThan(0);
    });

    expect(screen.getAllByTestId("location-search").at(-1)).toHaveTextContent("");
  });

  test("removes invalid failedLine from job status URL", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse({
          project: {
            id: "project-001",
            code: "PRJ-001",
            name: "新点造价项目",
            status: "draft",
          },
          currentStage: null,
          availableStages: [],
          disciplines: [],
          billVersions: [],
          todoSummary: {
            totalCount: 0,
            pendingReviewCount: 0,
            pendingProcessDocumentCount: 0,
            draftProcessDocumentCount: 0,
            items: [],
          },
          riskSummary: {
            totalCount: 1,
            rejectedReviewCount: 0,
            rejectedProcessDocumentCount: 0,
            failedJobCount: 1,
            items: ["1 个异步任务执行失败"],
          },
          importStatus: {
            mode: "import_task",
            totalCount: 1,
            queuedCount: 0,
            processingCount: 0,
            completedCount: 0,
            failedCount: 1,
            latestTask: {
              id: "import-task-001",
              sourceType: "audit_log",
              sourceLabel: "审计日志筛选导入",
              status: "failed",
              createdAt: "2026-04-18T13:00:00.000Z",
            },
            note: "导入状态已切换为正式导入任务模型，工作台摘要与导入任务记录保持一致。",
          },
          currentUser: {
            userId: "user-001",
            displayName: "Owner User",
            memberId: "member-001",
            permissionSummary: {
              roleCode: "project_owner",
              roleLabel: "项目负责人",
              canManageProject: true,
              canEditProject: true,
              scopeSummary: ["项目全部范围"],
              visibleStageCodes: [],
              visibleDisciplineCodes: [],
            },
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/import-tasks") {
        return createJsonResponse({
          items: [
            {
              id: "import-task-001",
              projectId: "project-001",
              sourceType: "audit_log",
              sourceLabel: "审计日志筛选导入",
              sourceFileName: "review-events.xlsx",
              sourceBatchNo: "audit-20260418-001",
              status: "failed",
              requestedBy: "user-001",
              totalItemCount: 8,
              importedItemCount: 0,
              memoryItemCount: 0,
              failedItemCount: 3,
              latestJobId: "job-001",
              latestErrorMessage: "计算失败",
              failureDetails: ["计算失败"],
              retryCount: 1,
              retryLimit: 3,
              canRetry: true,
              metadata: {
                failureSummary: [
                  {
                    reasonCode: "missing_field",
                    reasonLabel: "缺少必填字段",
                    count: 2,
                  },
                ],
                failedItems: [
                  {
                    lineNo: 2,
                    reasonCode: "missing_field",
                    reasonLabel: "缺少必填字段",
                    errorMessage: "缺少 action",
                    projectId: "project-001",
                    resourceType: "review_submission",
                    action: null,
                    keys: ["projectId", "resourceType"],
                  },
                ],
              },
              createdAt: "2026-04-18T13:00:00.000Z",
              completedAt: "2026-04-18T13:10:00.000Z",
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              queued: 0,
              processing: 0,
              completed: 0,
              failed: 1,
            },
          },
        });
      }

      if (url.pathname === "/v1/jobs") {
        return createJsonResponse({
          items: [
            {
              id: "job-001",
              jobType: "project_recalculate",
              status: "failed",
              requestedBy: "user-001",
              payload: {},
              result: null,
              errorMessage: "计算失败",
              createdAt: "2026-04-18T13:00:00.000Z",
              completedAt: "2026-04-18T13:10:00.000Z",
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              queued: 0,
              processing: 0,
              completed: 0,
              failed: 1,
            },
            jobTypeCounts: {
              project_recalculate: 1,
            },
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter
        initialEntries={[
          "/projects/project-001/jobs?status=failed&failureReason=missing_field&failedLine=999",
        ]}
      >
        <Routes>
          <Route
            path="/projects/:projectId/jobs"
            element={
              <>
                <ProjectJobStatusPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByRole("heading", { name: "任务状态页" }).length).toBeGreaterThan(0);
    });

    expect(screen.getAllByTestId("location-search").at(-1)).toHaveTextContent(
      "?status=failed&failureReason=missing_field",
    );
    expect(screen.queryByText("单条回看")).not.toBeInTheDocument();
  });

  test("keeps valid failure subset params while import task data is still loading", async () => {
    const importTasksDeferred = createDeferred();

    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse({
          project: {
            id: "project-001",
            code: "PRJ-001",
            name: "新点造价项目",
            status: "draft",
          },
          currentStage: null,
          availableStages: [],
          disciplines: [],
          billVersions: [],
          todoSummary: {
            totalCount: 0,
            pendingReviewCount: 0,
            pendingProcessDocumentCount: 0,
            draftProcessDocumentCount: 0,
            items: [],
          },
          riskSummary: {
            totalCount: 1,
            rejectedReviewCount: 0,
            rejectedProcessDocumentCount: 0,
            failedJobCount: 1,
            items: ["1 个异步任务执行失败"],
          },
          importStatus: {
            mode: "import_task",
            totalCount: 1,
            queuedCount: 0,
            processingCount: 0,
            completedCount: 0,
            failedCount: 1,
            latestTask: null,
            note: "导入状态已切换为正式导入任务模型，工作台摘要与导入任务记录保持一致。",
          },
          currentUser: {
            userId: "user-001",
            displayName: "Owner User",
            memberId: "member-001",
            permissionSummary: {
              roleCode: "project_owner",
              roleLabel: "项目负责人",
              canManageProject: true,
              canEditProject: true,
              scopeSummary: ["项目全部范围"],
              visibleStageCodes: [],
              visibleDisciplineCodes: [],
            },
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/import-tasks") {
        await importTasksDeferred.promise;

        return createJsonResponse({
          items: [
            {
              id: "import-task-020",
              projectId: "project-001",
              sourceType: "audit_log",
              sourceLabel: "审计日志筛选导入",
              sourceFileName: "review-events.xlsx",
              sourceBatchNo: "audit-20260418-020",
              status: "failed",
              requestedBy: "user-001",
              totalItemCount: 2,
              importedItemCount: 0,
              memoryItemCount: 0,
              failedItemCount: 1,
              latestJobId: "job-020",
              latestErrorMessage: "计算失败",
              failureDetails: ["计算失败"],
              retryCount: 0,
              retryLimit: 3,
              canRetry: true,
              metadata: {
                retryHistory: [],
                failureSummary: [
                  {
                    reasonCode: "missing_field",
                    reasonLabel: "缺少必填字段",
                    count: 1,
                  },
                ],
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
                ],
              },
              createdAt: "2026-04-18T13:00:00.000Z",
              completedAt: "2026-04-18T13:10:00.000Z",
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              queued: 0,
              processing: 0,
              completed: 0,
              failed: 1,
            },
          },
        });
      }

      if (url.pathname === "/v1/jobs") {
        return createJsonResponse({
          items: [
            {
              id: "job-020",
              jobType: "knowledge_extraction",
              status: "failed",
              requestedBy: "user-001",
              payload: {
                projectId: "project-001",
                source: "audit_log",
                importTaskId: "import-task-020",
                events: [],
              },
              result: null,
              errorMessage: "计算失败",
              createdAt: "2026-04-18T13:00:00.000Z",
              completedAt: "2026-04-18T13:10:00.000Z",
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              queued: 0,
              processing: 0,
              completed: 0,
              failed: 1,
            },
            jobTypeCounts: {
              knowledge_extraction: 1,
            },
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter
        initialEntries={[
          "/projects/project-001/jobs?status=failed&failureReason=missing_field&failureResourceType=bill_item&failureAction=create",
        ]}
      >
        <Routes>
          <Route
            path="/projects/:projectId/jobs"
            element={
              <>
                <ProjectJobStatusPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByRole("heading", { name: "任务状态页" }).length).toBeGreaterThan(0);
    });

    expect(screen.getAllByTestId("location-search").at(-1)).toHaveTextContent(
      "?status=failed&failureReason=missing_field&failureResourceType=bill_item&failureAction=create",
    );

    importTasksDeferred.resolve();

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: "重试当前子集（缺少必填字段 · 资源 bill_item · 动作 create）",
        }),
      ).toBeInTheDocument();
    });

    expect(screen.getAllByTestId("location-search").at(-1)).toHaveTextContent(
      "?status=failed&failureReason=missing_field&failureResourceType=bill_item&failureAction=create",
    );
  });

  test("skips filtered export when the selected failureReason has no failed items", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse({
          project: {
            id: "project-001",
            code: "PRJ-001",
            name: "新点造价项目",
            status: "draft",
          },
          currentStage: null,
          availableStages: [],
          disciplines: [],
          billVersions: [],
          todoSummary: {
            totalCount: 0,
            pendingReviewCount: 0,
            pendingProcessDocumentCount: 0,
            draftProcessDocumentCount: 0,
            items: [],
          },
          riskSummary: {
            totalCount: 1,
            rejectedReviewCount: 0,
            rejectedProcessDocumentCount: 0,
            failedJobCount: 1,
            items: ["1 个异步任务执行失败"],
          },
          importStatus: {
            mode: "import_task",
            totalCount: 1,
            queuedCount: 0,
            processingCount: 0,
            completedCount: 0,
            failedCount: 1,
            latestTask: {
              id: "import-task-001",
              sourceType: "audit_log",
              sourceLabel: "审计日志筛选导入",
              status: "failed",
              createdAt: "2026-04-18T13:00:00.000Z",
            },
            note: "导入状态已切换为正式导入任务模型，工作台摘要与导入任务记录保持一致。",
          },
          currentUser: {
            userId: "user-001",
            displayName: "Owner User",
            memberId: "member-001",
            permissionSummary: {
              roleCode: "project_owner",
              roleLabel: "项目负责人",
              canManageProject: true,
              canEditProject: true,
              scopeSummary: ["项目全部范围"],
              visibleStageCodes: [],
              visibleDisciplineCodes: [],
            },
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/import-tasks") {
        return createJsonResponse({
          items: [
            {
              id: "import-task-001",
              projectId: "project-001",
              sourceType: "audit_log",
              sourceLabel: "审计日志筛选导入",
              sourceFileName: "review-events.xlsx",
              sourceBatchNo: "audit-20260418-001",
              status: "failed",
              requestedBy: "user-001",
              totalItemCount: 8,
              importedItemCount: 0,
              memoryItemCount: 0,
              failedItemCount: 8,
              latestJobId: "job-001",
              latestErrorMessage: "计算失败",
              failureDetails: ["计算失败"],
              retryCount: 2,
              retryLimit: 3,
              canRetry: true,
              metadata: {
                failureSummary: [
                  {
                    reasonCode: "invalid_value",
                    reasonLabel: "字段值非法",
                    count: 1,
                  },
                ],
                failedItems: [],
              },
              createdAt: "2026-04-18T13:00:00.000Z",
              completedAt: "2026-04-18T13:10:00.000Z",
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              queued: 0,
              processing: 0,
              completed: 0,
              failed: 1,
            },
          },
        });
      }

      if (url.pathname === "/v1/jobs") {
        return createJsonResponse({
          items: [
            {
              id: "job-001",
              jobType: "project_recalculate",
              status: "failed",
              requestedBy: "user-001",
              payload: {},
              result: null,
              errorMessage: "计算失败",
              createdAt: "2026-04-18T13:00:00.000Z",
              completedAt: "2026-04-18T13:10:00.000Z",
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              queued: 0,
              processing: 0,
              completed: 0,
              failed: 1,
            },
            jobTypeCounts: {
              project_recalculate: 1,
            },
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001/jobs?status=failed&failureReason=invalid_value"]}>
        <Routes>
          <Route path="/projects/:projectId/jobs" element={<ProjectJobStatusPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByRole("heading", { name: "任务状态页" }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole("button", { name: "导出当前筛选（JSON）" }).at(-1)!);

    expect(screen.getByText("当前筛选下没有失败条目，已跳过导出。")).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("/v1/projects/project-001/import-tasks/import-task-001/error-report"),
      ),
    ).toBe(false);
    expect(createObjectUrl).not.toHaveBeenCalled();
  });

  test("keeps full-batch export available while filtered export is downloading", async () => {
    const downloadDeferred = createDeferred();

    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse({
          project: {
            id: "project-001",
            code: "PRJ-001",
            name: "新点造价项目",
            status: "draft",
          },
          currentStage: null,
          availableStages: [],
          disciplines: [],
          billVersions: [],
          todoSummary: {
            totalCount: 0,
            pendingReviewCount: 0,
            pendingProcessDocumentCount: 0,
            draftProcessDocumentCount: 0,
            items: [],
          },
          riskSummary: {
            totalCount: 1,
            rejectedReviewCount: 0,
            rejectedProcessDocumentCount: 0,
            failedJobCount: 1,
            items: ["1 个异步任务执行失败"],
          },
          importStatus: {
            mode: "import_task",
            totalCount: 1,
            queuedCount: 0,
            processingCount: 0,
            completedCount: 0,
            failedCount: 1,
            latestTask: {
              id: "import-task-001",
              sourceType: "audit_log",
              sourceLabel: "审计日志筛选导入",
              status: "failed",
              createdAt: "2026-04-18T13:00:00.000Z",
            },
            note: "导入状态已切换为正式导入任务模型，工作台摘要与导入任务记录保持一致。",
          },
          currentUser: {
            userId: "user-001",
            displayName: "Owner User",
            memberId: "member-001",
            permissionSummary: {
              roleCode: "project_owner",
              roleLabel: "项目负责人",
              canManageProject: true,
              canEditProject: true,
              scopeSummary: ["项目全部范围"],
              visibleStageCodes: [],
              visibleDisciplineCodes: [],
            },
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/import-tasks") {
        return createJsonResponse({
          items: [
            {
              id: "import-task-001",
              projectId: "project-001",
              sourceType: "audit_log",
              sourceLabel: "审计日志筛选导入",
              sourceFileName: "review-events.xlsx",
              sourceBatchNo: "audit-20260418-001",
              status: "failed",
              requestedBy: "user-001",
              totalItemCount: 8,
              importedItemCount: 0,
              memoryItemCount: 0,
              failedItemCount: 8,
              latestJobId: "job-001",
              latestErrorMessage: "计算失败",
              failureDetails: ["计算失败"],
              retryCount: 2,
              retryLimit: 3,
              canRetry: true,
              metadata: {
                failureSummary: [
                  {
                    reasonCode: "invalid_value",
                    reasonLabel: "字段值非法",
                    count: 1,
                  },
                ],
                failedItems: [
                  {
                    lineNo: 5,
                    reasonCode: "invalid_value",
                    reasonLabel: "字段值非法",
                    errorMessage: "amount 必须是数字",
                    projectId: "project-001",
                    resourceType: "bill_item",
                    action: "update",
                    keys: ["projectId", "resourceType", "action", "amount"],
                  },
                ],
              },
              createdAt: "2026-04-18T13:00:00.000Z",
              completedAt: "2026-04-18T13:10:00.000Z",
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              queued: 0,
              processing: 0,
              completed: 0,
              failed: 1,
            },
          },
        });
      }

      if (url.pathname === "/v1/jobs") {
        return createJsonResponse({
          items: [
            {
              id: "job-001",
              jobType: "project_recalculate",
              status: "failed",
              requestedBy: "user-001",
              payload: {},
              result: null,
              errorMessage: "计算失败",
              createdAt: "2026-04-18T13:00:00.000Z",
              completedAt: "2026-04-18T13:10:00.000Z",
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              queued: 0,
              processing: 0,
              completed: 0,
              failed: 1,
            },
            jobTypeCounts: {
              project_recalculate: 1,
            },
          },
        });
      }

      if (
        url.pathname ===
        "/v1/projects/project-001/import-tasks/import-task-001/error-report"
      ) {
        await downloadDeferred.promise;
        return new Response(JSON.stringify({ taskId: "import-task-001", failedItems: [] }), {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "content-disposition":
              'attachment; filename="import-task-001-error-report-current-filter-invalid_value.json"',
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter
        initialEntries={["/projects/project-001/jobs?status=failed&failureReason=invalid_value"]}
      >
        <Routes>
          <Route path="/projects/:projectId/jobs" element={<ProjectJobStatusPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "导出当前筛选（JSON）" }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole("button", { name: "导出当前筛选（JSON）" }).at(-1)!);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "导出中" }).length).toBeGreaterThan(0);
    });
    expect(
      screen.getAllByRole("button", { name: "导出整批（JSON）" }).at(-1),
    ).not.toBeDisabled();
    expect(
      screen.getAllByRole("button", { name: "导出整批（CSV）" }).at(-1),
    ).not.toBeDisabled();

    downloadDeferred.resolve();

    await waitFor(() => {
      expect(screen.getByText("已导出当前筛选（字段值非法，JSON）。")).toBeInTheDocument();
    });
  });

  test("disables scoped retry when the selected job does not belong to the selected import task", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse({
          project: {
            id: "project-001",
            code: "PRJ-001",
            name: "新点造价项目",
            status: "draft",
          },
          currentStage: null,
          availableStages: [],
          disciplines: [],
          billVersions: [],
          todoSummary: {
            totalCount: 0,
            pendingReviewCount: 0,
            pendingProcessDocumentCount: 0,
            draftProcessDocumentCount: 0,
            items: [],
          },
          riskSummary: {
            totalCount: 1,
            rejectedReviewCount: 0,
            rejectedProcessDocumentCount: 0,
            failedJobCount: 1,
            items: ["1 个异步任务执行失败"],
          },
          importStatus: {
            mode: "import_task",
            totalCount: 1,
            queuedCount: 0,
            processingCount: 0,
            completedCount: 0,
            failedCount: 1,
            latestTask: null,
            note: "导入状态已切换为正式导入任务模型，工作台摘要与导入任务记录保持一致。",
          },
          currentUser: {
            userId: "user-001",
            displayName: "Owner User",
            memberId: "member-001",
            permissionSummary: {
              roleCode: "project_owner",
              roleLabel: "项目负责人",
              canManageProject: true,
              canEditProject: true,
              scopeSummary: ["项目全部范围"],
              visibleStageCodes: [],
              visibleDisciplineCodes: [],
            },
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/import-tasks") {
        return createJsonResponse({
          items: [
            {
              id: "import-task-010",
              projectId: "project-001",
              sourceType: "audit_log",
              sourceLabel: "审计日志筛选导入",
              sourceFileName: "review-events.xlsx",
              sourceBatchNo: "audit-20260418-010",
              status: "failed",
              requestedBy: "user-001",
              totalItemCount: 2,
              importedItemCount: 0,
              memoryItemCount: 0,
              failedItemCount: 2,
              latestJobId: "job-010",
              latestErrorMessage: "计算失败",
              failureDetails: ["计算失败"],
              retryCount: 0,
              retryLimit: 3,
              canRetry: true,
              metadata: {
                retryHistory: [],
                failureSummary: [
                  {
                    reasonCode: "missing_field",
                    reasonLabel: "缺少必填字段",
                    count: 2,
                  },
                ],
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
                  },
                ],
              },
              createdAt: "2026-04-18T13:00:00.000Z",
              completedAt: "2026-04-18T13:10:00.000Z",
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              queued: 0,
              processing: 0,
              completed: 0,
              failed: 1,
            },
          },
        });
      }

      if (url.pathname === "/v1/jobs") {
        return createJsonResponse({
          items: [
            {
              id: "job-011",
              jobType: "knowledge_extraction",
              status: "failed",
              requestedBy: "user-001",
              payload: {
                projectId: "project-001",
                source: "audit_log",
                importTaskId: "import-task-011",
                events: [],
              },
              result: null,
              errorMessage: "计算失败",
              createdAt: "2026-04-18T13:00:00.000Z",
              completedAt: "2026-04-18T13:10:00.000Z",
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              queued: 0,
              processing: 0,
              completed: 0,
              failed: 1,
            },
            jobTypeCounts: {
              knowledge_extraction: 1,
            },
          },
        });
      }

      if (url.pathname === "/v1/jobs/job-011/retry") {
        throw new Error(`retry should stay disabled: ${String(init?.body)}`);
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter
        initialEntries={[
          "/projects/project-001/jobs?status=failed&failureReason=missing_field&failureResourceType=bill_item&failureAction=create",
        ]}
      >
        <Routes>
          <Route path="/projects/:projectId/jobs" element={<ProjectJobStatusPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByRole("heading", { name: "任务状态页" }).at(-1)).toBeInTheDocument();
    });

    expect(
      screen
        .getAllByRole("button", { name: "重试任务" })
        .some((button) => button.hasAttribute("disabled")),
    ).toBe(true);
  });

  test("switches the selected import task when the user selects a linked job", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse({
          project: {
            id: "project-001",
            code: "PRJ-001",
            name: "新点造价项目",
            status: "draft",
          },
          currentStage: null,
          availableStages: [],
          disciplines: [],
          billVersions: [],
          todoSummary: {
            totalCount: 0,
            pendingReviewCount: 0,
            pendingProcessDocumentCount: 0,
            draftProcessDocumentCount: 0,
            items: [],
          },
          riskSummary: {
            totalCount: 2,
            rejectedReviewCount: 0,
            rejectedProcessDocumentCount: 0,
            failedJobCount: 2,
            items: ["2 个异步任务执行失败"],
          },
          importStatus: {
            mode: "import_task",
            totalCount: 2,
            queuedCount: 0,
            processingCount: 0,
            completedCount: 0,
            failedCount: 2,
            latestTask: null,
            note: "导入状态已切换为正式导入任务模型，工作台摘要与导入任务记录保持一致。",
          },
          currentUser: {
            userId: "user-001",
            displayName: "Owner User",
            memberId: "member-001",
            permissionSummary: {
              roleCode: "project_owner",
              roleLabel: "项目负责人",
              canManageProject: true,
              canEditProject: true,
              scopeSummary: ["项目全部范围"],
              visibleStageCodes: [],
              visibleDisciplineCodes: [],
            },
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/import-tasks") {
        return createJsonResponse({
          items: [
            {
              id: "import-task-020",
              projectId: "project-001",
              sourceType: "audit_log",
              sourceLabel: "审计日志筛选导入",
              sourceFileName: "review-events-a.xlsx",
              sourceBatchNo: "audit-20260418-020",
              status: "failed",
              requestedBy: "user-001",
              totalItemCount: 2,
              importedItemCount: 0,
              memoryItemCount: 0,
              failedItemCount: 1,
              latestJobId: "job-020",
              latestErrorMessage: "计算失败",
              failureDetails: ["计算失败"],
              retryCount: 0,
              retryLimit: 3,
              canRetry: true,
              metadata: {
                failureSummary: [],
                failedItems: [],
              },
              createdAt: "2026-04-18T13:00:00.000Z",
              completedAt: "2026-04-18T13:10:00.000Z",
            },
            {
              id: "import-task-021",
              projectId: "project-001",
              sourceType: "audit_log",
              sourceLabel: "审计日志筛选导入（第二批）",
              sourceFileName: "review-events-b.xlsx",
              sourceBatchNo: "audit-20260418-021",
              status: "failed",
              requestedBy: "user-001",
              totalItemCount: 3,
              importedItemCount: 0,
              memoryItemCount: 0,
              failedItemCount: 2,
              latestJobId: "job-021",
              latestErrorMessage: "字段校验失败",
              failureDetails: ["字段校验失败"],
              retryCount: 0,
              retryLimit: 3,
              canRetry: true,
              metadata: {
                failureSummary: [],
                failedItems: [],
              },
              createdAt: "2026-04-18T14:00:00.000Z",
              completedAt: "2026-04-18T14:10:00.000Z",
            },
          ],
          summary: {
            totalCount: 2,
            statusCounts: {
              queued: 0,
              processing: 0,
              completed: 0,
              failed: 2,
            },
          },
        });
      }

      if (url.pathname === "/v1/jobs") {
        return createJsonResponse({
          items: [
            {
              id: "job-020",
              jobType: "knowledge_extraction",
              status: "failed",
              requestedBy: "user-001",
              payload: {
                projectId: "project-001",
                source: "audit_log",
                importTaskId: "import-task-020",
                events: [],
              },
              result: null,
              errorMessage: "计算失败",
              createdAt: "2026-04-18T13:00:00.000Z",
              completedAt: "2026-04-18T13:10:00.000Z",
            },
            {
              id: "job-021",
              jobType: "knowledge_extraction",
              status: "failed",
              requestedBy: "user-001",
              payload: {
                projectId: "project-001",
                source: "audit_log",
                importTaskId: "import-task-021",
                events: [],
              },
              result: null,
              errorMessage: "字段校验失败",
              createdAt: "2026-04-18T14:00:00.000Z",
              completedAt: "2026-04-18T14:10:00.000Z",
            },
          ],
          summary: {
            totalCount: 2,
            statusCounts: {
              queued: 0,
              processing: 0,
              completed: 0,
              failed: 2,
            },
            jobTypeCounts: {
              knowledge_extraction: 2,
            },
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001/jobs?status=failed"]}>
        <Routes>
          <Route path="/projects/:projectId/jobs" element={<ProjectJobStatusPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("文件 review-events-a.xlsx · 批次 audit-20260418-020")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /知识提取 · failed.*job-021/s }));

    await waitFor(() => {
      expect(screen.getByText("文件 review-events-b.xlsx · 批次 audit-20260418-021")).toBeInTheDocument();
    });
    expect(screen.getByText("关联任务：job-021")).toBeInTheDocument();
    expect(screen.getByText("最近错误：字段校验失败")).toBeInTheDocument();
  });

  test("enables scoped retry when the selected knowledge extraction job matches the import task and all failed items have retry snapshots", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse({
          project: {
            id: "project-001",
            code: "PRJ-001",
            name: "新点造价项目",
            status: "draft",
          },
          currentStage: null,
          availableStages: [],
          disciplines: [],
          billVersions: [],
          todoSummary: {
            totalCount: 0,
            pendingReviewCount: 0,
            pendingProcessDocumentCount: 0,
            draftProcessDocumentCount: 0,
            items: [],
          },
          riskSummary: {
            totalCount: 1,
            rejectedReviewCount: 0,
            rejectedProcessDocumentCount: 0,
            failedJobCount: 1,
            items: ["1 个异步任务执行失败"],
          },
          importStatus: {
            mode: "import_task",
            totalCount: 1,
            queuedCount: 0,
            processingCount: 0,
            completedCount: 0,
            failedCount: 1,
            latestTask: null,
            note: "导入状态已切换为正式导入任务模型，工作台摘要与导入任务记录保持一致。",
          },
          currentUser: {
            userId: "user-001",
            displayName: "Owner User",
            memberId: "member-001",
            permissionSummary: {
              roleCode: "project_owner",
              roleLabel: "项目负责人",
              canManageProject: true,
              canEditProject: true,
              scopeSummary: ["项目全部范围"],
              visibleStageCodes: [],
              visibleDisciplineCodes: [],
            },
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/import-tasks") {
        return createJsonResponse({
          items: [
            {
              id: "import-task-020",
              projectId: "project-001",
              sourceType: "audit_log",
              sourceLabel: "审计日志筛选导入",
              sourceFileName: "review-events.xlsx",
              sourceBatchNo: "audit-20260418-020",
              status: "failed",
              requestedBy: "user-001",
              totalItemCount: 2,
              importedItemCount: 0,
              memoryItemCount: 0,
              failedItemCount: 2,
              latestJobId: "job-020",
              latestErrorMessage: "计算失败",
              failureDetails: ["计算失败"],
              retryCount: 0,
              retryLimit: 3,
              canRetry: true,
              metadata: {
                retryHistory: [],
                failureSummary: [
                  {
                    reasonCode: "missing_field",
                    reasonLabel: "缺少必填字段",
                    count: 2,
                  },
                ],
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
                ],
              },
              createdAt: "2026-04-18T13:00:00.000Z",
              completedAt: "2026-04-18T13:10:00.000Z",
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              queued: 0,
              processing: 0,
              completed: 0,
              failed: 1,
            },
          },
        });
      }

      if (url.pathname === "/v1/jobs") {
        return createJsonResponse({
          items: [
            {
              id: "job-020",
              jobType: "knowledge_extraction",
              status: "failed",
              requestedBy: "user-001",
              payload: {
                projectId: "project-001",
                source: "audit_log",
                importTaskId: "import-task-020",
                events: [],
              },
              result: null,
              errorMessage: "计算失败",
              createdAt: "2026-04-18T13:00:00.000Z",
              completedAt: "2026-04-18T13:10:00.000Z",
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              queued: 0,
              processing: 0,
              completed: 0,
              failed: 1,
            },
            jobTypeCounts: {
              knowledge_extraction: 1,
            },
          },
        });
      }

      if (url.pathname === "/v1/jobs/job-020/retry") {
        return createJsonResponse({
          id: "job-020",
          status: "queued",
          errorMessage: null,
          completedAt: null,
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter
        initialEntries={[
          "/projects/project-001/jobs?status=failed&failureReason=missing_field&failureResourceType=bill_item&failureAction=create",
        ]}
      >
        <Routes>
          <Route path="/projects/:projectId/jobs" element={<ProjectJobStatusPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByRole("heading", { name: "任务状态页" }).at(-1)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(
        screen.getAllByText("当前子集已具备可重建输入，本次会只重试该失败子集。").length,
      ).toBeGreaterThan(0);
    });
    await waitFor(() => {
      expect(
        screen
          .getAllByRole("button", {
            name: "重试当前子集（缺少必填字段 · 资源 bill_item · 动作 create）",
          })
          .some((button) => !button.hasAttribute("disabled")),
      ).toBe(true);
    });
    expect(
      screen.getAllByRole("button", {
        name: /第 4 条 · 缺少必填字段 · 缺少工程量 .* 可重建快照已就绪/,
      }).length,
    ).toBeGreaterThan(0);
    fireEvent.click(
      screen.getAllByRole("button", {
        name: /第 4 条 · 缺少必填字段 · 缺少工程量 .* 可重建快照已就绪/,
      }).at(-1)!,
    );
    expect(screen.getAllByText("单条回看").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("本条已具备可重建快照，可直接纳入当前子集重试。").length,
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: "导出当前子集（JSON）" }).at(-1)!);

    await waitFor(() => {
      expect(createObjectUrl).toHaveBeenCalledTimes(1);
    });
    expect(downloadedFiles[0]).toBe(
      "import-task-020-error-report-current-subset-missing_field-resource-bill_item-action-create.json",
    );
  });

  test("enables scoped retry when retry snapshots are provided only through formal failureSnapshots metadata", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse({
          project: {
            id: "project-001",
            code: "PRJ-001",
            name: "新点造价项目",
            status: "draft",
          },
          currentStage: null,
          availableStages: [],
          disciplines: [],
          billVersions: [],
          todoSummary: {
            totalCount: 0,
            pendingReviewCount: 0,
            pendingProcessDocumentCount: 0,
            draftProcessDocumentCount: 0,
            items: [],
          },
          riskSummary: {
            totalCount: 1,
            rejectedReviewCount: 0,
            rejectedProcessDocumentCount: 0,
            failedJobCount: 1,
            items: ["1 个异步任务执行失败"],
          },
          importStatus: {
            mode: "import_task",
            totalCount: 1,
            queuedCount: 0,
            processingCount: 0,
            completedCount: 0,
            failedCount: 1,
            latestTask: null,
            note: "导入状态已切换为正式导入任务模型，工作台摘要与导入任务记录保持一致。",
          },
          currentUser: {
            userId: "user-001",
            displayName: "Owner User",
            memberId: "member-001",
            permissionSummary: {
              roleCode: "project_owner",
              roleLabel: "项目负责人",
              canManageProject: true,
              canEditProject: true,
              scopeSummary: ["项目全部范围"],
              visibleStageCodes: [],
              visibleDisciplineCodes: [],
            },
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/import-tasks") {
        return createJsonResponse({
          items: [
            {
              id: "import-task-022",
              projectId: "project-001",
              sourceType: "audit_log",
              sourceLabel: "审计日志筛选导入",
              sourceFileName: "review-events.xlsx",
              sourceBatchNo: "audit-20260418-022",
              status: "failed",
              requestedBy: "user-001",
              totalItemCount: 2,
              importedItemCount: 0,
              memoryItemCount: 0,
              failedItemCount: 1,
              latestJobId: "job-022",
              latestErrorMessage: "计算失败",
              failureDetails: ["计算失败"],
              retryCount: 0,
              retryLimit: 3,
              canRetry: true,
              metadata: {
                retryHistory: [],
                failureSummary: [
                  {
                    reasonCode: "missing_field",
                    reasonLabel: "缺少必填字段",
                    count: 1,
                  },
                ],
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
                ],
              },
              createdAt: "2026-04-18T13:00:00.000Z",
              completedAt: "2026-04-18T13:10:00.000Z",
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              queued: 0,
              processing: 0,
              completed: 0,
              failed: 1,
            },
          },
        });
      }

      if (url.pathname === "/v1/jobs") {
        return createJsonResponse({
          items: [
            {
              id: "job-022",
              jobType: "knowledge_extraction",
              status: "failed",
              requestedBy: "user-001",
              payload: {
                projectId: "project-001",
                source: "audit_log",
                importTaskId: "import-task-022",
                events: [],
              },
              result: null,
              errorMessage: "计算失败",
              createdAt: "2026-04-18T13:00:00.000Z",
              completedAt: "2026-04-18T13:10:00.000Z",
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              queued: 0,
              processing: 0,
              completed: 0,
              failed: 1,
            },
            jobTypeCounts: {
              knowledge_extraction: 1,
            },
          },
        });
      }

      if (url.pathname === "/v1/jobs/job-022/retry") {
        return createJsonResponse({
          id: "job-022",
          status: "queued",
          errorMessage: null,
          completedAt: null,
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter
        initialEntries={[
          "/projects/project-001/jobs?status=failed&failureReason=missing_field&failureResourceType=bill_item&failureAction=create",
        ]}
      >
        <Routes>
          <Route path="/projects/:projectId/jobs" element={<ProjectJobStatusPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getAllByText("当前子集已具备可重建输入，本次会只重试该失败子集。").length,
      ).toBeGreaterThan(0);
    });
    await waitFor(() => {
      expect(
        screen
          .getAllByRole("button", {
            name: "重试当前子集（缺少必填字段 · 资源 bill_item · 动作 create）",
          })
          .some((button) => !button.hasAttribute("disabled")),
      ).toBe(true);
    });
    expect(
      screen.getAllByRole("button", {
        name: /第 4 条 · 缺少必填字段 · 缺少工程量 .* 可重建快照已就绪/,
      }).length,
    ).toBeGreaterThan(0);
  });

  test("shows a specific retry input error when the backend rejects an incomplete retry snapshot scope", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse({
          project: {
            id: "project-001",
            code: "PRJ-001",
            name: "新点造价项目",
            status: "draft",
          },
          currentStage: null,
          availableStages: [],
          disciplines: [],
          billVersions: [],
          todoSummary: {
            totalCount: 0,
            pendingReviewCount: 0,
            pendingProcessDocumentCount: 0,
            draftProcessDocumentCount: 0,
            items: [],
          },
          riskSummary: {
            totalCount: 1,
            rejectedReviewCount: 0,
            rejectedProcessDocumentCount: 0,
            failedJobCount: 1,
            items: ["1 个异步任务执行失败"],
          },
          importStatus: {
            mode: "import_task",
            totalCount: 1,
            queuedCount: 0,
            processingCount: 0,
            completedCount: 0,
            failedCount: 1,
            latestTask: null,
            note: "导入状态已切换为正式导入任务模型，工作台摘要与导入任务记录保持一致。",
          },
          currentUser: {
            userId: "user-001",
            displayName: "Owner User",
            memberId: "member-001",
            permissionSummary: {
              roleCode: "project_owner",
              roleLabel: "项目负责人",
              canManageProject: true,
              canEditProject: true,
              scopeSummary: ["项目全部范围"],
              visibleStageCodes: [],
              visibleDisciplineCodes: [],
            },
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/import-tasks") {
        return createJsonResponse({
          items: [
            {
              id: "import-task-021",
              projectId: "project-001",
              sourceType: "audit_log",
              sourceLabel: "审计日志筛选导入",
              sourceFileName: "review-events.xlsx",
              sourceBatchNo: "audit-20260418-021",
              status: "failed",
              requestedBy: "user-001",
              totalItemCount: 2,
              importedItemCount: 0,
              memoryItemCount: 0,
              failedItemCount: 2,
              latestJobId: "job-021",
              latestErrorMessage: "计算失败",
              failureDetails: ["计算失败"],
              retryCount: 0,
              retryLimit: 3,
              canRetry: true,
              metadata: {
                retryHistory: [],
                failureSummary: [
                  {
                    reasonCode: "missing_field",
                    reasonLabel: "缺少必填字段",
                    count: 2,
                  },
                ],
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
                  },
                ],
                failureSnapshots: [
                  {
                    lineNo: 4,
                    retryEventSnapshot: {
                      projectId: "project-001",
                      resourceType: "bill_item",
                      action: "create",
                      name: "某清单项",
                    },
                  },
                ],
              },
              createdAt: "2026-04-18T13:00:00.000Z",
              completedAt: "2026-04-18T13:10:00.000Z",
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              queued: 0,
              processing: 0,
              completed: 0,
              failed: 1,
            },
          },
        });
      }

      if (url.pathname === "/v1/jobs") {
        return createJsonResponse({
          items: [
            {
              id: "job-021",
              jobType: "knowledge_extraction",
              status: "failed",
              requestedBy: "user-001",
              payload: {
                projectId: "project-001",
                source: "audit_log",
                importTaskId: "import-task-021",
                events: [],
              },
              result: null,
              errorMessage: "计算失败",
              createdAt: "2026-04-18T13:00:00.000Z",
              completedAt: "2026-04-18T13:10:00.000Z",
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              queued: 0,
              processing: 0,
              completed: 0,
              failed: 1,
            },
            jobTypeCounts: {
              knowledge_extraction: 1,
            },
          },
        });
      }

      if (url.pathname === "/v1/jobs/job-021/retry") {
        return new Response(
          JSON.stringify({
            error: {
              code: "IMPORT_TASK_RETRY_INPUT_INCOMPLETE",
              message:
                "Some failed items in the selected subset do not have retryable event snapshots",
            },
          }),
          {
            status: 409,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter
        initialEntries={[
          "/projects/project-001/jobs?status=failed&failureReason=missing_field&failureResourceType=bill_item&failureAction=create",
        ]}
      >
        <Routes>
          <Route path="/projects/:projectId/jobs" element={<ProjectJobStatusPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByRole("heading", { name: "任务状态页" }).at(-1)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(
        screen.getAllByText("当前子集已具备可重建输入，本次会只重试该失败子集。").length,
      ).toBeGreaterThan(0);
    });
    await waitFor(() => {
      expect(
        screen
          .getAllByRole("button", {
            name: "重试当前子集（缺少必填字段 · 资源 bill_item · 动作 create）",
          })
          .some((button) => !button.hasAttribute("disabled")),
      ).toBe(true);
    });
    fireEvent.click(
      screen
        .getAllByRole("button", {
          name: "重试当前子集（缺少必填字段 · 资源 bill_item · 动作 create）",
        })
        .at(-1)!,
    );
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([input, init]) =>
            String(input).includes("/v1/jobs/job-021/retry") &&
            init?.method === "POST",
        ),
      ).toBe(true);
    });
    await waitFor(() => {
      expect(
        screen.getByText(
          "当前失败范围中有条目缺少可重建输入，请先导出当前范围或回源修数后再重新导入。",
        ),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "先导出当前子集（JSON）" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "继续查看当前失败范围" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", {
        name: /第 4 条 · 缺少必填字段 · 缺少工程量 .* 可重建快照已就绪/,
      }).length,
    ).toBeGreaterThan(0);
    fireEvent.click(
      screen.getAllByRole("button", {
        name: /第 4 条 · 缺少必填字段 · 缺少工程量 .* 可重建快照已就绪/,
      }).at(-1)!,
    );
    expect(screen.getAllByText("单条回看").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("本条已具备可重建快照，可直接纳入当前子集重试。").length,
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "继续查看当前失败范围" }));
    expect(
      screen.queryByText(
        "当前失败范围中有条目缺少可重建输入，请先导出当前范围或回源修数后再重新导入。",
      ),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen
        .getAllByRole("button", {
          name: "重试当前子集（缺少必填字段 · 资源 bill_item · 动作 create）",
        })
        .at(-1)!,
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "先导出当前子集（JSON）" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "先导出当前子集（JSON）" }));

    await waitFor(() => {
      expect(createObjectUrl).toHaveBeenCalledTimes(1);
    });
    expect(downloadedFiles[0]).toBe(
      "import-task-021-error-report-current-subset-missing_field-resource-bill_item-action-create.json",
    );
  });

  test("auto dismisses copied-link feedback on the job status page", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse({
          project: {
            id: "project-001",
            code: "PRJ-001",
            name: "新点造价项目",
            status: "draft",
          },
          currentStage: null,
          availableStages: [],
          disciplines: [],
          billVersions: [],
          todoSummary: {
            totalCount: 0,
            pendingReviewCount: 0,
            pendingProcessDocumentCount: 0,
            draftProcessDocumentCount: 0,
            items: [],
          },
          riskSummary: {
            totalCount: 0,
            rejectedReviewCount: 0,
            rejectedProcessDocumentCount: 0,
            failedJobCount: 0,
            items: [],
          },
          importStatus: {
            mode: "import_task",
            totalCount: 1,
            queuedCount: 0,
            processingCount: 0,
            completedCount: 0,
            failedCount: 1,
            latestTask: {
              id: "import-task-001",
              sourceType: "audit_log",
              sourceLabel: "审计日志筛选导入",
              status: "failed",
              createdAt: "2026-04-18T13:00:00.000Z",
            },
            note: "导入状态已切换为正式导入任务模型，工作台摘要与导入任务记录保持一致。",
          },
          currentUser: {
            userId: "user-001",
            displayName: "Owner User",
            memberId: "member-001",
            permissionSummary: {
              roleCode: "project_owner",
              roleLabel: "项目负责人",
              canManageProject: true,
              canEditProject: true,
              scopeSummary: ["项目全部范围"],
              visibleStageCodes: [],
              visibleDisciplineCodes: [],
            },
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/import-tasks") {
        return createJsonResponse({
          items: [
            {
              id: "import-task-001",
              projectId: "project-001",
              sourceType: "audit_log",
              sourceLabel: "审计日志筛选导入",
              sourceFileName: "review-events.xlsx",
              sourceBatchNo: "audit-20260418-001",
              status: "failed",
              requestedBy: "user-001",
              totalItemCount: 2,
              importedItemCount: 0,
              memoryItemCount: 0,
              failedItemCount: 2,
              latestJobId: "job-001",
              latestErrorMessage: "计算失败",
              failureDetails: ["计算失败"],
              retryCount: 0,
              retryLimit: 3,
              canRetry: true,
              metadata: {
                failureSummary: [
                  {
                    reasonCode: "invalid_value",
                    reasonLabel: "字段值非法",
                    count: 1,
                  },
                ],
                failedItems: [
                  {
                    lineNo: 1,
                    reasonCode: "invalid_value",
                    reasonLabel: "字段值非法",
                    errorMessage: "amount 必须是数字",
                    projectId: "project-001",
                    resourceType: "bill_item",
                    action: "update",
                    keys: ["amount"],
                  },
                ],
              },
              createdAt: "2026-04-18T13:00:00.000Z",
              completedAt: "2026-04-18T13:10:00.000Z",
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              queued: 0,
              processing: 0,
              completed: 0,
              failed: 1,
            },
          },
        });
      }

      if (url.pathname === "/v1/jobs") {
        return createJsonResponse({
          items: [],
          summary: {
            totalCount: 0,
            statusCounts: {
              queued: 0,
              processing: 0,
              completed: 0,
              failed: 0,
            },
            jobTypeCounts: {},
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001/jobs?failureReason=invalid_value"]}>
        <Routes>
          <Route
            path="/projects/:projectId/jobs"
            element={
              <>
                <ProjectJobStatusPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByRole("heading", { name: "任务状态页" }).at(-1)).toBeInTheDocument();
    });

    vi.useFakeTimers();

    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "复制当前筛选链接" })[0]!);
    });
    expect(screen.getByText("已复制当前筛选链接，可直接发给协作同事。")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2600);
    });
    expect(screen.queryByText("已复制当前筛选链接，可直接发给协作同事。")).not.toBeInTheDocument();
  });
});
