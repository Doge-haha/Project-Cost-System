import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ProjectReviewsPage } from "../src/features/projects/project-reviews-page";
import { formatProjectDateTime } from "../src/features/projects/project-date-utils";
import { saveRecentProcessingLink } from "../src/features/projects/recent-processing-link";

function createJsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}

function LocationProbe() {
  const location = useLocation();

  return <div data-testid="location-search">{location.search}</div>;
}

describe("ProjectReviewsPage", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const clipboardWriteText = vi.fn<(value: string) => Promise<void>>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: clipboardWriteText,
      },
    });
    vi.stubGlobal(
      "location",
      new URL("http://localhost/projects/project-001/reviews?reviewId=review-001&action=approve"),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    clipboardWriteText.mockReset();
    window.sessionStorage.clear();
  });

  test("renders review actions and submits approve flow", async () => {
    saveRecentProcessingLink({
      projectId: "project-001",
      path: "/projects/project-001/jobs?status=failed&failureReason=missing_field",
      label: "任务状态处理入口",
      sourceLabel: "任务状态页",
    });

    let reviewStatus = "pending";

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
            totalCount: 1,
            pendingReviewCount: 1,
            pendingProcessDocumentCount: 0,
            draftProcessDocumentCount: 0,
            items: ["1 条审核待处理"],
          },
          riskSummary: {
            totalCount: 0,
            rejectedReviewCount: 0,
            rejectedProcessDocumentCount: 0,
            failedJobCount: 0,
            items: ["当前没有显式风险项"],
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

      if (
        url.pathname === "/v1/projects/project-001/reviews" &&
        ((typeof init?.method === "string" && init.method === "GET") ||
          init?.method === undefined)
      ) {
        return createJsonResponse({
          items: [
            {
              id: "review-001",
              billVersionId: "version-001",
              stageCode: "estimate",
              disciplineCode: "building",
              status: reviewStatus,
              submittedBy: "user-002",
              submittedAt: "2026-04-18T11:00:00.000Z",
              submissionComment: "待审核",
              reviewComment: reviewStatus === "approved" ? "同意通过" : null,
              rejectionReason: null,
              billVersionSummary: {
                versionName: "估算版 V1",
                versionNo: 1,
                versionStatus: reviewStatus === "approved" ? "approved" : "submitted",
              },
              canApprove: reviewStatus === "pending",
              canReject: reviewStatus === "pending",
              canCancel: false,
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              pending: reviewStatus === "pending" ? 1 : 0,
              approved: reviewStatus === "approved" ? 1 : 0,
              rejected: 0,
              cancelled: 0,
            },
            actionableCount: reviewStatus === "pending" ? 1 : 0,
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/reviews/review-001/approve") {
        reviewStatus = "approved";
        return createJsonResponse({
          id: "review-001",
          status: "approved",
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter
        initialEntries={["/projects/project-001/reviews?reviewId=review-001&action=approve"]}
      >
        <Routes>
          <Route
            path="/projects/:projectId/reviews"
            element={
              <>
                <ProjectReviewsPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "审核处理页" })).toBeInTheDocument();
    });

    expect(screen.getByText("最近协作动作：任务状态页复制了任务状态处理入口")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "回到任务状态页（失败）" })).toHaveAttribute(
      "href",
      "/projects/project-001/jobs?status=failed&failureReason=missing_field",
    );
    expect(screen.queryByRole("link", { name: "打开最近协作入口" })).not.toBeInTheDocument();
    expect(screen.getByText("待审核，可由当前角色执行通过或驳回。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "通过" }));
    expect(screen.getByText("提交对象：估算版 V1 · estimate · building")).toBeInTheDocument();
    expect(screen.getByText("提交人：user-002")).toBeInTheDocument();
    expect(
      screen.getByText(`提交时间：${formatProjectDateTime("2026-04-18T11:00:00.000Z")}`),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "复制当前处理链接" }));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(
        "http://localhost/projects/project-001/reviews?reviewId=review-001&action=approve",
      );
    });
    expect(screen.getByText("已复制当前处理链接，可直接发给协作同事。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "打开刚复制入口" })).toHaveAttribute(
      "href",
      "/projects/project-001/reviews?reviewId=review-001&action=approve",
    );

    fireEvent.change(screen.getByRole("textbox", { name: "备注" }), {
      target: { value: "同意通过" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认处理" }));

    await waitFor(() => {
      expect(screen.getByText("估算版 V1 · approved")).toBeInTheDocument();
    });

    expect(screen.getByText("当前状态：approved")).toBeInTheDocument();
    expect(screen.getByText("当前备注：同意通过")).toBeInTheDocument();
    expect(screen.getByText("估算版 V1 已完成本次处理，可回到工作台继续查看刷新后的摘要和最近动态。")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });

    expect(screen.getByRole("link", { name: "返回项目工作台" })).toHaveAttribute(
      "href",
      "/projects/project-001?refresh=reviews&resultStatus=approved&resultName=%E4%BC%B0%E7%AE%97%E7%89%88+V1&resultKind=review&resultId=review-001",
    );
    expect(screen.getByRole("link", { name: "返回待办页" })).toHaveAttribute(
      "href",
      "/projects/project-001/inbox?focus=todo&refresh=reviews&resultStatus=approved&resultName=%E4%BC%B0%E7%AE%97%E7%89%88+V1&resultKind=review&resultId=review-001",
    );
    expect(
      fetchMock.mock.calls.some(
        ([input, init]) =>
          String(input).includes(
            "/v1/projects/project-001/reviews/review-001/approve",
          ) && init?.method === "POST",
      ),
    ).toBe(true);
  });

  test("shows review list summary without legacy filter chips", async () => {
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
            totalCount: 2,
            pendingReviewCount: 1,
            pendingProcessDocumentCount: 0,
            draftProcessDocumentCount: 0,
            items: ["1 条审核待处理"],
          },
          riskSummary: {
            totalCount: 1,
            rejectedReviewCount: 1,
            rejectedProcessDocumentCount: 0,
            failedJobCount: 0,
            items: ["1 条审核被驳回"],
          },
          importStatus: {
            mode: "import_task",
            totalCount: 0,
            queuedCount: 0,
            processingCount: 0,
            completedCount: 0,
            failedCount: 0,
            latestTask: null,
            note: "note",
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
        url.pathname === "/v1/projects/project-001/reviews" &&
        ((typeof init?.method === "string" && init.method === "GET") ||
          init?.method === undefined)
      ) {
        return createJsonResponse({
          items: [
            {
              id: "review-001",
              billVersionId: "version-001",
              stageCode: "estimate",
              disciplineCode: "building",
              status: "pending",
              submittedBy: "user-002",
              submittedAt: "2026-04-18T11:00:00.000Z",
              submissionComment: "待审核",
              reviewComment: null,
              rejectionReason: null,
              billVersionSummary: {
                versionName: "估算版 V1",
                versionNo: 1,
                versionStatus: "submitted",
              },
              canApprove: true,
              canReject: true,
              canCancel: false,
            },
            {
              id: "review-002",
              billVersionId: "version-002",
              stageCode: "budget",
              disciplineCode: "install",
              status: "rejected",
              submittedBy: "user-003",
              submittedAt: "2026-04-17T11:00:00.000Z",
              submissionComment: "待补充",
              reviewComment: "请补充依据",
              rejectionReason: "单价依据不足",
              billVersionSummary: {
                versionName: "预算版 V2",
                versionNo: 2,
                versionStatus: "editing",
              },
              canApprove: false,
              canReject: false,
              canCancel: false,
            },
          ],
          summary: {
            totalCount: 2,
            statusCounts: {
              pending: 1,
              approved: 0,
              rejected: 1,
              cancelled: 0,
            },
            actionableCount: 1,
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001/reviews"]}>
        <Routes>
          <Route
            path="/projects/:projectId/reviews"
            element={
              <>
                <ProjectReviewsPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("估算版 V1 · pending")).toBeInTheDocument();
    });
    expect(screen.getByText("预算版 V2 · rejected")).toBeInTheDocument();

    expect(screen.getByText("共 2 条，待处理 1 条")).toBeInTheDocument();
    expect(screen.getByText("估算版 V1 · pending")).toBeInTheDocument();
    expect(screen.getByText("预算版 V2 · rejected")).toBeInTheDocument();
    expect(screen.getByTestId("location-search")).toHaveTextContent("");
  });

  test.each([
    {
      status: "processing",
      actionLabel: "回到任务状态页（处理中）",
      path: "/projects/project-001/jobs?status=processing",
      label: "任务状态处理中入口",
    },
    {
      status: "completed",
      actionLabel: "回到任务状态页（已完成）",
      path: "/projects/project-001/jobs?status=completed",
      label: "任务状态已完成入口",
    },
  ])("shows semantic source action for $status job status summaries", async ({ actionLabel, path, label }) => {
    saveRecentProcessingLink({
      projectId: "project-001",
      path,
      label,
      sourceLabel: "任务状态页",
    });

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
            totalCount: 1,
            pendingReviewCount: 1,
            pendingProcessDocumentCount: 0,
            draftProcessDocumentCount: 0,
            items: ["1 条审核待处理"],
          },
          riskSummary: {
            totalCount: 0,
            rejectedReviewCount: 0,
            rejectedProcessDocumentCount: 0,
            failedJobCount: 0,
            items: ["当前没有显式风险项"],
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

      if (url.pathname === "/v1/projects/project-001/reviews") {
        return createJsonResponse({
          items: [
            {
              id: "review-001",
              billVersionId: "version-001",
              stageCode: "estimate",
              disciplineCode: "building",
              status: "pending",
              submittedBy: "user-002",
              submittedAt: "2026-04-18T11:00:00.000Z",
              submissionComment: "请审批",
              reviewComment: null,
              rejectionReason: null,
              billVersionSummary: {
                versionName: "估算版 V1",
                versionNo: 1,
                versionStatus: "submitted",
              },
              canApprove: true,
              canReject: true,
              canCancel: false,
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              pending: 1,
              approved: 0,
              rejected: 0,
              cancelled: 0,
            },
            actionableCount: 1,
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001/reviews"]}>
        <Routes>
          <Route path="/projects/:projectId/reviews" element={<ProjectReviewsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(`最近协作动作：任务状态页复制了${label}`)).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: actionLabel })).toHaveAttribute("href", path);
  });

  test("expands batch objects from recent collaboration summary", async () => {
    saveRecentProcessingLink({
      projectId: "project-001",
      path: "/projects/project-001/inbox?focus=todo&refresh=reviews&resultStatus=approved&resultName=%E9%A2%84%E7%AE%97%E7%89%88+V2&resultKind=review&resultId=review-002&batchCount=2&batchSummary=%E9%A2%84%E7%AE%97%E7%89%88+V2%E5%B7%B2%E9%80%9A%E8%BF%87%E3%80%81%E4%BC%B0%E7%AE%97%E7%89%88+V1%E5%B7%B2%E9%80%9A%E8%BF%87&batchIds=review-002%2Creview-001",
      label: "本轮已处理 2 条审核：预算版 V2已通过、估算版 V1已通过",
      sourceLabel: "待办页",
      actionType: "batch-refresh",
      batchEntries: [
        {
          id: "review-002",
          label: "预算版 V2已通过",
          path: "/projects/project-001/reviews?reviewId=review-002&action=approve",
        },
        {
          id: "review-001",
          label: "估算版 V1已通过",
          path: "/projects/project-001/reviews?reviewId=review-001&action=approve",
        },
      ],
    });

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
            totalCount: 1,
            pendingReviewCount: 1,
            pendingProcessDocumentCount: 0,
            draftProcessDocumentCount: 0,
            items: ["1 条审核待处理"],
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
            note: "note",
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
        url.pathname === "/v1/projects/project-001/reviews" &&
        ((typeof init?.method === "string" && init.method === "GET") ||
          init?.method === undefined)
      ) {
        return createJsonResponse({
          items: [
            {
              id: "review-001",
              billVersionId: "version-001",
              stageCode: "estimate",
              disciplineCode: "building",
              status: "pending",
              submittedBy: "user-002",
              submittedAt: "2026-04-18T11:00:00.000Z",
              submissionComment: "待审核",
              reviewComment: null,
              rejectionReason: null,
              billVersionSummary: {
                versionName: "估算版 V1",
                versionNo: 1,
                versionStatus: "submitted",
              },
              canApprove: true,
              canReject: true,
              canCancel: false,
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              pending: 1,
              approved: 0,
              rejected: 0,
              cancelled: 0,
            },
            actionableCount: 1,
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001/reviews"]}>
        <Routes>
          <Route path="/projects/:projectId/reviews" element={<ProjectReviewsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("最近协作动作：待办页记录了本轮已处理 2 条审核：预算版 V2已通过、估算版 V1已通过")).toBeInTheDocument();
    });
    expect(screen.getByText("本轮对象：2 条")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "回到待办页（待办）" })).toHaveAttribute(
      "href",
      "/projects/project-001/inbox?focus=todo&refresh=reviews&resultStatus=approved&resultName=%E9%A2%84%E7%AE%97%E7%89%88+V2&resultKind=review&resultId=review-002&batchCount=2&batchSummary=%E9%A2%84%E7%AE%97%E7%89%88+V2%E5%B7%B2%E9%80%9A%E8%BF%87%E3%80%81%E4%BC%B0%E7%AE%97%E7%89%88+V1%E5%B7%B2%E9%80%9A%E8%BF%87&batchIds=review-002%2Creview-001",
    );
    expect(screen.getByRole("button", { name: "展开本轮对象（2）" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("link", { name: "预算版 V2已通过" })).not.toBeInTheDocument();
  });

  test("highlights and prioritizes the actionable review from summary focus", async () => {
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
            totalCount: 2,
            pendingReviewCount: 2,
            pendingProcessDocumentCount: 0,
            draftProcessDocumentCount: 0,
            items: ["2 条审核待处理"],
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
            note: "note",
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
        url.pathname === "/v1/projects/project-001/reviews" &&
        ((typeof init?.method === "string" && init.method === "GET") ||
          init?.method === undefined)
      ) {
        return createJsonResponse({
          items: [
            {
              id: "review-001",
              billVersionId: "version-001",
              stageCode: "estimate",
              disciplineCode: "building",
              status: "pending",
              submittedBy: "user-002",
              submittedAt: "2026-04-18T11:00:00.000Z",
              submissionComment: "普通待审核",
              reviewComment: null,
              rejectionReason: null,
              billVersionSummary: {
                versionName: "估算版 V1",
                versionNo: 1,
                versionStatus: "submitted",
              },
              canApprove: false,
              canReject: false,
              canCancel: false,
            },
            {
              id: "review-002",
              billVersionId: "version-002",
              stageCode: "budget",
              disciplineCode: "install",
              status: "pending",
              submittedBy: "user-003",
              submittedAt: "2026-04-19T11:00:00.000Z",
              submissionComment: "优先处理",
              reviewComment: null,
              rejectionReason: null,
              billVersionSummary: {
                versionName: "预算版 V2",
                versionNo: 2,
                versionStatus: "submitted",
              },
              canApprove: true,
              canReject: true,
              canCancel: false,
            },
          ],
          summary: {
            totalCount: 2,
            statusCounts: {
              pending: 2,
              approved: 0,
              rejected: 0,
              cancelled: 0,
            },
            actionableCount: 1,
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    saveRecentProcessingLink({
      projectId: "project-001",
      path: "/projects/project-001/reviews?filter=pending&summaryFocus=pending",
      label: "审核待处理入口",
      sourceLabel: "审核处理页",
    });

    render(
      <MemoryRouter
        initialEntries={["/projects/project-001/reviews?filter=pending&summaryFocus=pending"]}
      >
        <Routes>
          <Route path="/projects/:projectId/reviews" element={<ProjectReviewsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("预算版 V2 · pending")).toBeInTheDocument();
    });

    expect(
      screen.getByText((_, element) => element?.textContent === "来源入口：已在此处"),
    ).toBeInTheDocument();
    const cards = screen.getAllByText(/· pending/).map((node) => node.closest(".list-card"));
    expect(cards[0]).toHaveTextContent("预算版 V2 · pending");
    expect(cards[0]).toHaveClass("selected");
  });

  test("automatically advances to the next actionable review after processing", async () => {
    let reviewStates = [
      {
        id: "review-001",
        versionName: "估算版 V1",
        status: "pending",
        reviewComment: null as string | null,
        canApprove: true,
        canReject: true,
        canCancel: false,
      },
      {
        id: "review-002",
        versionName: "预算版 V2",
        status: "pending",
        reviewComment: null as string | null,
        canApprove: true,
        canReject: true,
        canCancel: false,
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
            totalCount: 2,
            pendingReviewCount: 2,
            pendingProcessDocumentCount: 0,
            draftProcessDocumentCount: 0,
            items: ["2 条审核待处理"],
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
            note: "note",
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
        url.pathname === "/v1/projects/project-001/reviews" &&
        ((typeof init?.method === "string" && init.method === "GET") ||
          init?.method === undefined)
      ) {
        return createJsonResponse({
          items: reviewStates.map((review, index) => ({
            id: review.id,
            billVersionId: `version-00${index + 1}`,
            stageCode: index === 0 ? "estimate" : "budget",
            disciplineCode: index === 0 ? "building" : "install",
            status: review.status,
            submittedBy: `user-00${index + 2}`,
            submittedAt: `2026-04-1${index + 8}T11:00:00.000Z`,
            submissionComment: "待审核",
            reviewComment: review.reviewComment,
            rejectionReason: null,
            billVersionSummary: {
              versionName: review.versionName,
              versionNo: index + 1,
              versionStatus: review.status === "approved" ? "approved" : "submitted",
            },
            canApprove: review.canApprove,
            canReject: review.canReject,
            canCancel: review.canCancel,
          })),
          summary: {
            totalCount: reviewStates.length,
            statusCounts: {
              pending: reviewStates.filter((review) => review.status === "pending").length,
              approved: reviewStates.filter((review) => review.status === "approved").length,
              rejected: 0,
              cancelled: 0,
            },
            actionableCount: reviewStates.filter((review) => review.canApprove || review.canReject || review.canCancel).length,
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/reviews/review-001/approve") {
        reviewStates = reviewStates.map((review) =>
          review.id === "review-001"
            ? {
                ...review,
                status: "approved",
                reviewComment: "同意通过",
                canApprove: false,
                canReject: false,
                canCancel: false,
              }
            : review,
        );
        return createJsonResponse({
          id: "review-001",
          status: "approved",
        });
      }

      if (url.pathname === "/v1/projects/project-001/reviews/review-002/approve") {
        reviewStates = reviewStates.map((review) =>
          review.id === "review-002"
            ? {
                ...review,
                status: "approved",
                reviewComment: "继续通过",
                canApprove: false,
                canReject: false,
                canCancel: false,
              }
            : review,
        );
        return createJsonResponse({
          id: "review-002",
          status: "approved",
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter
        initialEntries={["/projects/project-001/reviews?reviewId=review-001&action=approve"]}
      >
        <Routes>
          <Route
            path="/projects/:projectId/reviews"
            element={
              <>
                <ProjectReviewsPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("当前处理：估算版 V1 · approve")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole("textbox", { name: "备注" }), {
      target: { value: "同意通过" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认处理" }));

    await waitFor(() => {
      expect(screen.getByText("估算版 V1 · approved")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText("当前处理：预算版 V2 · approve")).toBeInTheDocument();
    });
    expect(screen.getByText("预算版 V2 · pending").closest(".list-card")).toHaveClass("selected");
    expect(screen.getByText("处理完成")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "备注" }), {
      target: { value: "继续通过" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认处理" }));

    await waitFor(() => {
      expect(screen.getByText("本轮已处理 2 条")).toBeInTheDocument();
    });
    expect(screen.getByText("预算版 V2 · approved · 备注：继续通过")).toBeInTheDocument();
    expect(screen.getByText("估算版 V1 · approved · 备注：同意通过")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回项目工作台" })).toHaveAttribute(
      "href",
      "/projects/project-001?refresh=reviews&resultStatus=approved&resultName=%E9%A2%84%E7%AE%97%E7%89%88+V2&resultKind=review&resultId=review-002&batchCount=2&batchSummary=%E9%A2%84%E7%AE%97%E7%89%88+V2%E5%B7%B2%E9%80%9A%E8%BF%87%E3%80%81%E4%BC%B0%E7%AE%97%E7%89%88+V1%E5%B7%B2%E9%80%9A%E8%BF%87&batchIds=review-002%2Creview-001",
    );
  });
});
