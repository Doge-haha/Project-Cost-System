import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ProjectWorkspaceInboxPage } from "../src/features/projects/project-workspace-inbox-page";
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

describe("ProjectWorkspaceInboxPage", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const clipboardWriteText = vi.fn<(value: string) => Promise<void>>();
  const scrollIntoViewMock = vi.fn();

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
      new URL("http://localhost/projects/project-001/inbox?focus=import&refresh=jobs"),
    );
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    clipboardWriteText.mockReset();
    scrollIntoViewMock.mockReset();
    window.sessionStorage.clear();
  });

  test("renders aggregated inbox sections for todo, risk, and import follow-up", async () => {
    saveRecentProcessingLink({
      projectId: "project-001",
      path: "/projects/project-001/jobs?status=failed&failureReason=missing_field",
      label: "任务状态处理入口",
      collaborationUnitLabel: "缺少必填字段 · 资源 bill_item · 动作 create",
      sourceLabel: "任务状态页",
    });

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
          currentStage: {
            id: "stage-001",
            stageCode: "estimate",
            stageName: "投资估算",
            status: "active",
            sequenceNo: 1,
          },
          availableStages: [],
          disciplines: [],
          billVersions: [
            {
              id: "version-001",
              versionName: "估算版 V1",
              stageCode: "estimate",
              disciplineCode: "building",
              versionStatus: "editable",
            },
          ],
          todoSummary: {
            totalCount: 2,
            pendingReviewCount: 1,
            pendingProcessDocumentCount: 1,
            draftProcessDocumentCount: 0,
            items: ["1 条审核待处理", "1 条过程单据待审核"],
          },
          riskSummary: {
            totalCount: 2,
            rejectedReviewCount: 1,
            rejectedProcessDocumentCount: 1,
            failedJobCount: 0,
            items: ["1 条审核被驳回", "1 条过程单据被退回"],
          },
          importStatus: {
            mode: "import_task",
            totalCount: 1,
            queuedCount: 0,
            processingCount: 1,
            completedCount: 0,
            failedCount: 0,
            latestTask: {
              id: "import-task-001",
              sourceType: "audit_log",
              sourceLabel: "审计日志筛选导入",
              status: "processing",
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
              visibleStageCodes: ["estimate"],
              visibleDisciplineCodes: ["building"],
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
              submissionComment: "待审核",
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

      if (url.pathname === "/v1/projects/project-001/process-documents") {
        return createJsonResponse({
          items: [
            {
              id: "doc-001",
              stageCode: "estimate",
              disciplineCode: "building",
              documentType: "change_order",
              status: "submitted",
              title: "设计变更单",
              referenceNo: "BG-001",
              amount: 1200,
              submittedBy: "user-002",
              submittedAt: "2026-04-18T10:30:00.000Z",
              lastComment: "待审核",
              stageName: "投资估算",
              disciplineName: "建筑工程",
              isEditable: false,
              isReviewable: true,
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              draft: 0,
              submitted: 1,
              approved: 0,
              rejected: 0,
            },
            documentTypeCounts: {
              change_order: 1,
              site_visa: 0,
              progress_payment: 0,
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
              status: "processing",
              requestedBy: "user-001",
              projectId: "project-001",
              payload: {
                projectId: "project-001",
              },
              result: null,
              errorMessage: null,
              createdAt: "2026-04-18T13:00:00.000Z",
              completedAt: null,
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              queued: 0,
              processing: 1,
              completed: 0,
              failed: 0,
            },
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter
        initialEntries={[
          "/projects/project-001/inbox?focus=import&refresh=jobs&failureReason=missing_field&failureResourceType=bill_item&failureAction=create",
        ]}
      >
        <Routes>
          <Route
            path="/projects/:projectId/inbox"
            element={
              <>
                <ProjectWorkspaceInboxPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "项目待办页" })).toBeInTheDocument();
    });

    expect(screen.getByText("审核待办")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "进入审核处理页" })).toHaveAttribute(
      "href",
      "/projects/project-001/reviews",
    );
    expect(screen.getByText("最近协作动作：任务状态页复制了任务状态处理入口")).toBeInTheDocument();
    expect(
      screen.getAllByText("当前协作处理单元：缺少必填字段 · 资源 bill_item · 动作 create").length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "回到任务状态页（失败）" })).toHaveAttribute(
      "href",
      "/projects/project-001/jobs?status=failed&failureReason=missing_field",
    );
    expect(screen.queryByRole("link", { name: "打开最近协作入口" })).not.toBeInTheDocument();
    expect(screen.getByText("估算版 V1 · pending")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "复制审核处理链接" }));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(
        "http://localhost/projects/project-001/reviews?reviewId=review-001&action=approve",
      );
    });
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "打开刚复制入口" })).toHaveAttribute(
        "href",
        "/projects/project-001/reviews?reviewId=review-001&action=approve",
      );
    });
    expect(screen.getByText("过程单据")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "进入过程单据处理页" })).toHaveAttribute(
      "href",
      "/projects/project-001/process-documents",
    );
    expect(screen.getByText("设计变更单 · submitted")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "复制过程单据处理链接" }));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(
        "http://localhost/projects/project-001/process-documents?documentId=doc-001&action=approve",
      );
    });
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "打开刚复制入口" })).toHaveAttribute(
        "href",
        "/projects/project-001/process-documents?documentId=doc-001&action=approve",
      );
    });
    expect(screen.getByText("异步任务状态")).toBeInTheDocument();
    expect(screen.getByText("任务状态已更新，导入与任务摘要已刷新。")).toBeInTheDocument();
    expect(screen.getByText("当前协作视角：缺少必填字段")).toBeInTheDocument();
    expect(screen.getByText("当前协作处理单元：缺少必填字段 · 资源 bill_item · 动作 create")).toBeInTheDocument();
    expect(
      screen.getByText("当前正跟进“缺少必填字段”相关失败条目，可继续回到任务状态页逐条定位。"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "复制当前回流链接" }));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(
        "http://localhost/projects/project-001/inbox?focus=import&refresh=jobs&failureReason=missing_field&failureResourceType=bill_item&failureAction=create",
      );
    });
    expect(screen.getByRole("link", { name: "进入任务状态页" })).toHaveAttribute(
      "href",
      "/projects/project-001/jobs?status=failed&failureReason=missing_field&failureResourceType=bill_item&failureAction=create",
    );
    expect(screen.getByText("知识提取 · processing")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回项目工作台 回到 workspace 总览继续切换版本和摘要。" })).toHaveAttribute(
      "href",
      "/projects/project-001?failureReason=missing_field&failureResourceType=bill_item&failureAction=create",
    );
    fireEvent.click(screen.getByRole("button", { name: "清除协作视角" }));
    expect(screen.getAllByTestId("location-search").at(-1)).toHaveTextContent(
      "?focus=import&refresh=jobs",
    );
    expect(screen.queryByText("当前协作视角：缺少必填字段")).not.toBeInTheDocument();
    expect(screen.queryByText("已复制当前回流链接，可直接发给协作同事。")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "清除最近协作记录" }));
    expect(screen.queryByText("最近协作动作：任务状态页复制了任务状态处理入口")).not.toBeInTheDocument();
  });

  test("shows detailed refresh notice for review and process document results", async () => {
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
              submissionComment: "待审核",
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
            statusCounts: { pending: 1, approved: 0, rejected: 0, cancelled: 0 },
            actionableCount: 1,
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/process-documents") {
        return createJsonResponse({
          items: [
            {
              id: "doc-001",
              stageCode: "estimate",
              disciplineCode: "building",
              documentType: "change_order",
              status: "submitted",
              title: "设计变更单",
              referenceNo: "BG-001",
              amount: 1200,
              submittedBy: "user-002",
              submittedAt: "2026-04-18T10:30:00.000Z",
              lastComment: "待审核",
              stageName: "投资估算",
              disciplineName: "建筑工程",
              isEditable: false,
              isReviewable: true,
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: { draft: 0, submitted: 1, approved: 0, rejected: 0 },
            documentTypeCounts: { change_order: 1, site_visa: 0, progress_payment: 0 },
          },
        });
      }

      if (url.pathname === "/v1/jobs") {
        return createJsonResponse({
          items: [],
          summary: {
            totalCount: 0,
            statusCounts: { queued: 0, processing: 0, completed: 0, failed: 0 },
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    const firstRender = render(
      <MemoryRouter
        initialEntries={[
          "/projects/project-001/inbox?focus=todo&refresh=reviews&resultStatus=approved&resultName=%E4%BC%B0%E7%AE%97%E7%89%88+V1&resultKind=review&resultId=review-001",
        ]}
      >
        <Routes>
          <Route path="/projects/:projectId/inbox" element={<ProjectWorkspaceInboxPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("估算版 V1 已通过，待办摘要已刷新。")).toBeInTheDocument();
    });
    expect(screen.getByText("共 1 条，待处理 0 条")).toBeInTheDocument();
    expect(screen.getByText("估算版 V1 · pending").closest(".list-card")).toHaveClass("selected");
    fireEvent.click(screen.getByRole("button", { name: "收起提示" }));
    await waitFor(() => {
      expect(screen.queryByText("估算版 V1 已通过，待办摘要已刷新。")).not.toBeInTheDocument();
    });

    firstRender.unmount();

    render(
      <MemoryRouter
        initialEntries={[
          "/projects/project-001/inbox?focus=risk&refresh=process-documents&resultStatus=approved&resultName=%E8%AE%BE%E8%AE%A1%E5%8F%98%E6%9B%B4%E5%8D%95&resultKind=process-document&resultId=doc-001",
        ]}
      >
        <Routes>
          <Route path="/projects/:projectId/inbox" element={<ProjectWorkspaceInboxPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("设计变更单 已通过，风险摘要已刷新。")).toBeInTheDocument();
    });
    expect(screen.getByText("共 1 条，待审核 0 条，退回 0 条")).toBeInTheDocument();
    expect(screen.getByText("设计变更单 · submitted").closest(".list-card")).toHaveClass("selected");
    fireEvent.click(screen.getByRole("button", { name: "收起提示" }));
    await waitFor(() => {
      expect(screen.queryByText("设计变更单 已通过，风险摘要已刷新。")).not.toBeInTheDocument();
    });
  });

  test("shows batch refresh notice for review and process document rounds", async () => {
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
              submissionComment: "待审核",
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
              stageCode: "estimate",
              disciplineCode: "building",
              status: "pending",
              submittedBy: "user-003",
              submittedAt: "2026-04-18T12:00:00.000Z",
              submissionComment: "待审核",
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
            actionableCount: 2,
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/process-documents") {
        return createJsonResponse({
          items: [
            {
              id: "doc-001",
              stageCode: "estimate",
              disciplineCode: "building",
              documentType: "change_order",
              status: "submitted",
              title: "设计变更单",
              referenceNo: "BG-001",
              amount: 1200,
              submittedBy: "user-002",
              submittedAt: "2026-04-18T10:30:00.000Z",
              lastComment: "待审核",
              stageName: "投资估算",
              disciplineName: "建筑工程",
              isEditable: false,
              isReviewable: true,
            },
            {
              id: "doc-002",
              stageCode: "estimate",
              disciplineCode: "building",
              documentType: "site_visa",
              status: "submitted",
              title: "现场签证单",
              referenceNo: "QZ-002",
              amount: 2600,
              submittedBy: "user-003",
              submittedAt: "2026-04-18T11:30:00.000Z",
              lastComment: "待审核",
              stageName: "投资估算",
              disciplineName: "建筑工程",
              isEditable: false,
              isReviewable: true,
            },
          ],
          summary: {
            totalCount: 2,
            statusCounts: {
              draft: 0,
              submitted: 2,
              approved: 0,
              rejected: 0,
            },
            documentTypeCounts: {
              change_order: 1,
              site_visa: 1,
              progress_payment: 0,
            },
          },
        });
      }

      if (url.pathname === "/v1/jobs") {
        return createJsonResponse({ items: [], summary: { totalCount: 0, statusCounts: { queued: 0, processing: 0, completed: 0, failed: 0 } } });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    const firstRender = render(
      <MemoryRouter
        initialEntries={[
          "/projects/project-001/inbox?focus=todo&refresh=reviews&resultStatus=approved&resultName=%E9%A2%84%E7%AE%97%E7%89%88+V2&resultKind=review&resultId=review-002&batchCount=2&batchSummary=%E9%A2%84%E7%AE%97%E7%89%88+V2%E5%B7%B2%E9%80%9A%E8%BF%87%E3%80%81%E4%BC%B0%E7%AE%97%E7%89%88+V1%E5%B7%B2%E9%80%9A%E8%BF%87&batchIds=review-002,review-001",
        ]}
      >
        <Routes>
          <Route path="/projects/:projectId/inbox" element={<ProjectWorkspaceInboxPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("本轮已处理 2 条审核：预算版 V2已通过、估算版 V1已通过，待办摘要已刷新。"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("本轮处理对象")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "预算版 V2已通过" })).toHaveAttribute(
      "href",
      "/projects/project-001/reviews?reviewId=review-002&action=approve",
    );
    expect(screen.getByRole("link", { name: "估算版 V1已通过" })).toHaveAttribute(
      "href",
      "/projects/project-001/reviews?reviewId=review-001&action=approve",
    );
    expect(screen.getByText("估算版 V1 · pending").closest(".list-card")).toHaveClass("selected");
    expect(screen.getByText("预算版 V2 · pending").closest(".list-card")).toHaveClass("selected");
    fireEvent.click(screen.getByRole("button", { name: "收起提示" }));
    await waitFor(() => {
      expect(
        screen.getByText("最近协作动作：待办页记录了本轮已处理 2 条审核：预算版 V2已通过、估算版 V1已通过"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("本轮对象：2 条")).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === "本轮来源：已在此处"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "待办页" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开本轮对象（2）" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "预算版 V2已通过" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "展开本轮对象（2）" }));
    expect(screen.getByRole("button", { name: "收起本轮对象（2）" })).toBeInTheDocument();
    expect(screen.getByText("审核对象：", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "预算版 V2已通过" })).toHaveAttribute(
      "href",
      "/projects/project-001/reviews?reviewId=review-002&action=approve",
    );
    expect(screen.getByRole("link", { name: "估算版 V1已通过" })).toHaveAttribute(
      "href",
      "/projects/project-001/reviews?reviewId=review-001&action=approve",
    );
    fireEvent.click(screen.getAllByRole("button", { name: "复制入口" }).at(0)!);
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(
        "http://localhost/projects/project-001/reviews?reviewId=review-002&action=approve",
      );
    });
    expect(screen.getByText("已复制预算版 V2已通过入口，可直接发给协作同事。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "打开刚复制入口" })).toHaveAttribute(
      "href",
      "/projects/project-001/reviews?reviewId=review-002&action=approve",
    );
    await waitFor(() => {
      expect(screen.getByText("最近复制对象：预算版 V2已通过")).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "打开最近复制对象" })).toHaveAttribute(
      "href",
      "/projects/project-001/reviews?reviewId=review-002&action=approve",
    );
    expect(screen.getByRole("link", { name: "打开最近复制对象" })).toHaveClass(
      "recent-processing-action-link-secondary",
    );
    fireEvent.click(screen.getByRole("button", { name: "收起本轮对象（2）" }));
    expect(screen.queryByRole("link", { name: "预算版 V2已通过" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "打开最近协作入口" })).toHaveAttribute(
      "href",
      "/projects/project-001/inbox?focus=todo&refresh=reviews&resultStatus=approved&resultName=%E9%A2%84%E7%AE%97%E7%89%88+V2&resultKind=review&resultId=review-002&batchCount=2&batchSummary=%E9%A2%84%E7%AE%97%E7%89%88+V2%E5%B7%B2%E9%80%9A%E8%BF%87%E3%80%81%E4%BC%B0%E7%AE%97%E7%89%88+V1%E5%B7%B2%E9%80%9A%E8%BF%87&batchIds=review-002%2Creview-001",
    );
    expect(screen.getByRole("link", { name: "打开最近协作入口" })).toHaveClass(
      "recent-processing-action-link-secondary",
    );

    firstRender.unmount();

    render(
      <MemoryRouter
        initialEntries={[
          "/projects/project-001/inbox?focus=risk&refresh=process-documents&resultStatus=approved&resultName=%E7%8E%B0%E5%9C%BA%E7%AD%BE%E8%AF%81%E5%8D%95&resultKind=process-document&resultId=doc-002&batchCount=2&batchSummary=%E7%8E%B0%E5%9C%BA%E7%AD%BE%E8%AF%81%E5%8D%95%E5%B7%B2%E9%80%9A%E8%BF%87%E3%80%81%E8%AE%BE%E8%AE%A1%E5%8F%98%E6%9B%B4%E5%8D%95%E5%B7%B2%E9%80%9A%E8%BF%87&batchIds=doc-002,doc-001",
        ]}
      >
        <Routes>
          <Route path="/projects/:projectId/inbox" element={<ProjectWorkspaceInboxPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("本轮已处理 2 条过程单据：现场签证单已通过、设计变更单已通过，风险摘要已刷新。"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("本轮处理对象")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "现场签证单已通过" })).toHaveAttribute(
      "href",
      "/projects/project-001/process-documents?documentId=doc-002&action=approve",
    );
    expect(screen.getByRole("link", { name: "设计变更单已通过" })).toHaveAttribute(
      "href",
      "/projects/project-001/process-documents?documentId=doc-001&action=approve",
    );
    expect(screen.getByText("设计变更单 · submitted").closest(".list-card")).toHaveClass("selected");
    expect(screen.getByText("现场签证单 · submitted").closest(".list-card")).toHaveClass("selected");
    fireEvent.click(screen.getByRole("button", { name: "收起提示" }));
    await waitFor(() => {
      expect(
        screen.getByText("最近协作动作：待办页记录了本轮已处理 2 条过程单据：现场签证单已通过、设计变更单已通过"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("本轮对象：2 条")).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === "本轮来源：已在此处"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "待办页" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开本轮对象（2）" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "展开本轮对象（2）" }));
    expect(screen.getByText("过程单据对象：", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "现场签证单已通过" })).toHaveAttribute(
      "href",
      "/projects/project-001/process-documents?documentId=doc-002&action=approve",
    );
    expect(screen.getByRole("link", { name: "设计变更单已通过" })).toHaveAttribute(
      "href",
      "/projects/project-001/process-documents?documentId=doc-001&action=approve",
    );
    expect(screen.getByRole("link", { name: "打开最近协作入口" })).toHaveAttribute(
      "href",
      "/projects/project-001/inbox?focus=risk&refresh=process-documents&resultStatus=approved&resultName=%E7%8E%B0%E5%9C%BA%E7%AD%BE%E8%AF%81%E5%8D%95&resultKind=process-document&resultId=doc-002&batchCount=2&batchSummary=%E7%8E%B0%E5%9C%BA%E7%AD%BE%E8%AF%81%E5%8D%95%E5%B7%B2%E9%80%9A%E8%BF%87%E3%80%81%E8%AE%BE%E8%AE%A1%E5%8F%98%E6%9B%B4%E5%8D%95%E5%B7%B2%E9%80%9A%E8%BF%87&batchIds=doc-002%2Cdoc-001",
    );
  });

  test("auto expands and highlights the most recently copied batch object", async () => {
    saveRecentProcessingLink({
      projectId: "project-001",
      path: "/projects/project-001/inbox?focus=todo&refresh=reviews&resultStatus=approved&resultName=%E9%A2%84%E7%AE%97%E7%89%88+V2&resultKind=review&resultId=review-002&batchCount=2&batchSummary=%E9%A2%84%E7%AE%97%E7%89%88+V2%E5%B7%B2%E9%80%9A%E8%BF%87%E3%80%81%E4%BC%B0%E7%AE%97%E7%89%88+V1%E5%B7%B2%E9%80%9A%E8%BF%87&batchIds=review-002%2Creview-001",
      label: "本轮已处理 2 条审核：预算版 V2已通过、估算版 V1已通过",
      sourceLabel: "待办页",
      actionType: "batch-refresh",
      batchEntriesExpandedPreference: false,
      highlightedBatchEntryId: "review-002",
      highlightedBatchEntryLabel: "预算版 V2已通过",
      highlightedBatchEntryPath: "/projects/project-001/reviews?reviewId=review-002&action=approve",
      batchEntries: [
        {
          id: "review-002",
          label: "预算版 V2已通过",
          path: "/projects/project-001/reviews?reviewId=review-002&action=approve",
          sourceType: "review",
        },
        {
          id: "review-001",
          label: "估算版 V1已通过",
          path: "/projects/project-001/reviews?reviewId=review-001&action=approve",
          sourceType: "review",
        },
      ],
    });

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

      if (url.pathname === "/v1/projects/project-001/reviews") {
        return createJsonResponse({
          items: [],
          summary: {
            totalCount: 0,
            statusCounts: {
              pending: 0,
              approved: 0,
              rejected: 0,
              cancelled: 0,
            },
            actionableCount: 0,
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/process-documents") {
        return createJsonResponse({
          items: [],
          summary: {
            totalCount: 0,
            statusCounts: {
              draft: 0,
              submitted: 0,
              approved: 0,
              rejected: 0,
            },
            documentTypeCounts: {
              change_order: 0,
              site_visa: 0,
              progress_payment: 0,
            },
          },
        });
      }

      if (url.pathname === "/v1/jobs") {
        return createJsonResponse({
          items: [],
          summary: {
            totalCount: 0,
            statusCounts: { queued: 0, processing: 0, completed: 0, failed: 0 },
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001/inbox?focus=todo"]}>
        <Routes>
          <Route path="/projects/:projectId/inbox" element={<ProjectWorkspaceInboxPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "收起本轮对象（2）" })).toBeInTheDocument();
    });
    expect(screen.getByText("最近复制对象：预算版 V2已通过")).toBeInTheDocument();
    expect(screen.getByText("（最近复制）")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "打开最近复制对象" })).toHaveAttribute(
      "href",
      "/projects/project-001/reviews?reviewId=review-002&action=approve",
    );
    expect(scrollIntoViewMock).toHaveBeenCalled();
  });

  test("shows recent failure-subset entries from task-status collaboration memory", async () => {
    saveRecentProcessingLink({
      projectId: "project-001",
      path: "/projects/project-001/jobs?status=failed&failureReason=missing_field&failureResourceType=bill_item&failureAction=create",
      label: "任务状态处理入口",
      collaborationUnitLabel: "缺少必填字段 · 资源 bill_item · 动作 create",
      sourceLabel: "任务状态页",
      actionType: "copied",
      batchEntriesExpandedPreference: true,
      highlightedBatchEntryId: "failed-line-4",
      highlightedBatchEntryLabel: "第 4 条 · 缺少必填字段",
      highlightedBatchEntryPath:
        "/projects/project-001/jobs?status=failed&failureReason=missing_field&failureResourceType=bill_item&failureAction=create&failedLine=4",
      batchEntries: [
        {
          id: "failed-line-4",
          label: "第 4 条 · 缺少必填字段",
          path: "/projects/project-001/jobs?status=failed&failureReason=missing_field&failureResourceType=bill_item&failureAction=create&failedLine=4",
          sourceType: "job",
        },
        {
          id: "failed-line-6",
          label: "第 6 条 · 缺少必填字段",
          path: "/projects/project-001/jobs?status=failed&failureReason=missing_field&failureResourceType=bill_item&failureAction=create&failedLine=6",
          sourceType: "job",
        },
      ],
    });

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

      if (url.pathname === "/v1/projects/project-001/reviews") {
        return createJsonResponse({
          items: [],
          summary: {
            totalCount: 0,
            statusCounts: {
              pending: 0,
              approved: 0,
              rejected: 0,
              cancelled: 0,
            },
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/process-documents") {
        return createJsonResponse({
          items: [],
          summary: {
            totalCount: 0,
            statusCounts: {
              draft: 0,
              submitted: 0,
              approved: 0,
              rejected: 0,
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
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001/inbox?focus=import"]}>
        <Routes>
          <Route path="/projects/:projectId/inbox" element={<ProjectWorkspaceInboxPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "项目待办页" })).toBeInTheDocument();
    });

    expect(screen.getByText("最近协作动作：任务状态页复制了任务状态处理入口")).toBeInTheDocument();
    expect(screen.getByText("当前协作处理单元：缺少必填字段 · 资源 bill_item · 动作 create")).toBeInTheDocument();
    expect(screen.getByText("本轮对象：2 条")).toBeInTheDocument();
    const expandButton = screen.queryByRole("button", { name: "展开本轮对象（2）" });
    if (expandButton) {
      fireEvent.click(expandButton);
    } else {
      expect(screen.getByRole("button", { name: "收起本轮对象（2）" })).toBeInTheDocument();
    }
    expect(screen.getByText("失败条目：", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "第 4 条 · 缺少必填字段" })).toHaveAttribute(
      "href",
      "/projects/project-001/jobs?status=failed&failureReason=missing_field&failureResourceType=bill_item&failureAction=create&failedLine=4",
    );
    expect(screen.getByText("最近复制对象：第 4 条 · 缺少必填字段")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "打开最近复制对象" })).toHaveAttribute(
      "href",
      "/projects/project-001/jobs?status=failed&failureReason=missing_field&failureResourceType=bill_item&failureAction=create&failedLine=4",
    );
  });

  test("restores the user's last manual batch-list preference when no copied object is highlighted", async () => {
    saveRecentProcessingLink({
      projectId: "project-001",
      path: "/projects/project-001/inbox?focus=todo&refresh=reviews&resultStatus=approved&resultName=%E9%A2%84%E7%AE%97%E7%89%88+V2&resultKind=review&resultId=review-002&batchCount=2&batchSummary=%E9%A2%84%E7%AE%97%E7%89%88+V2%E5%B7%B2%E9%80%9A%E8%BF%87%E3%80%81%E4%BC%B0%E7%AE%97%E7%89%88+V1%E5%B7%B2%E9%80%9A%E8%BF%87&batchIds=review-002%2Creview-001",
      label: "本轮已处理 2 条审核：预算版 V2已通过、估算版 V1已通过",
      sourceLabel: "待办页",
      actionType: "batch-refresh",
      batchEntriesExpandedPreference: true,
      batchEntries: [
        {
          id: "review-002",
          label: "预算版 V2已通过",
          path: "/projects/project-001/reviews?reviewId=review-002&action=approve",
          sourceType: "review",
        },
        {
          id: "review-001",
          label: "估算版 V1已通过",
          path: "/projects/project-001/reviews?reviewId=review-001&action=approve",
          sourceType: "review",
        },
      ],
    });

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

      if (url.pathname === "/v1/projects/project-001/reviews") {
        return createJsonResponse({
          items: [],
          summary: {
            totalCount: 0,
            statusCounts: {
              pending: 0,
              approved: 0,
              rejected: 0,
              cancelled: 0,
            },
            actionableCount: 0,
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/process-documents") {
        return createJsonResponse({
          items: [],
          summary: {
            totalCount: 0,
            statusCounts: {
              draft: 0,
              submitted: 0,
              approved: 0,
              rejected: 0,
            },
            documentTypeCounts: {
              change_order: 0,
              site_visa: 0,
              progress_payment: 0,
            },
          },
        });
      }

      if (url.pathname === "/v1/jobs") {
        return createJsonResponse({
          items: [],
          summary: {
            totalCount: 0,
            statusCounts: { queued: 0, processing: 0, completed: 0, failed: 0 },
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001/inbox?focus=todo"]}>
        <Routes>
          <Route path="/projects/:projectId/inbox" element={<ProjectWorkspaceInboxPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "收起本轮对象（2）" })).toBeInTheDocument();
    });
    expect(screen.getByText("审核对象：", { exact: false })).toBeInTheDocument();
    expect(screen.queryByText("最近复制对象：预算版 V2已通过")).not.toBeInTheDocument();
  });

  test("shows an explicit return action for the batch source when the source page is different", async () => {
    saveRecentProcessingLink({
      projectId: "project-001",
      path: "/projects/project-001?tab=workspace&refresh=reviews&resultStatus=approved&resultName=%E9%A2%84%E7%AE%97%E7%89%88+V2&resultKind=review&resultId=review-002&batchCount=2&batchSummary=%E9%A2%84%E7%AE%97%E7%89%88+V2%E5%B7%B2%E9%80%9A%E8%BF%87%E3%80%81%E4%BC%B0%E7%AE%97%E7%89%88+V1%E5%B7%B2%E9%80%9A%E8%BF%87&batchIds=review-002%2Creview-001",
      label: "本轮已处理 2 条审核：预算版 V2已通过、估算版 V1已通过",
      sourceLabel: "项目工作台",
      actionType: "batch-refresh",
      batchEntries: [
        {
          id: "review-002",
          label: "预算版 V2已通过",
          path: "/projects/project-001/reviews?reviewId=review-002&action=approve",
          sourceType: "review",
        },
        {
          id: "review-001",
          label: "估算版 V1已通过",
          path: "/projects/project-001/reviews?reviewId=review-001&action=approve",
          sourceType: "review",
        },
      ],
    });

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

      if (url.pathname === "/v1/projects/project-001/reviews") {
        return createJsonResponse({
          items: [],
          summary: {
            totalCount: 0,
            statusCounts: {
              pending: 0,
              approved: 0,
              rejected: 0,
              cancelled: 0,
            },
            actionableCount: 0,
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/process-documents") {
        return createJsonResponse({
          items: [],
          summary: {
            totalCount: 0,
            statusCounts: {
              draft: 0,
              submitted: 0,
              approved: 0,
              rejected: 0,
            },
            documentTypeCounts: {
              change_order: 0,
              site_visa: 0,
              progress_payment: 0,
            },
          },
        });
      }

      if (url.pathname === "/v1/jobs") {
        return createJsonResponse({
          items: [],
          summary: {
            totalCount: 0,
            statusCounts: { queued: 0, processing: 0, completed: 0, failed: 0 },
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001/inbox?focus=todo"]}>
        <Routes>
          <Route path="/projects/:projectId/inbox" element={<ProjectWorkspaceInboxPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("最近协作动作：项目工作台记录了本轮已处理 2 条审核：预算版 V2已通过、估算版 V1已通过")).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "回到项目工作台（审核摘要）" })).toHaveAttribute(
      "href",
      "/projects/project-001?tab=workspace&refresh=reviews&resultStatus=approved&resultName=%E9%A2%84%E7%AE%97%E7%89%88+V2&resultKind=review&resultId=review-002&batchCount=2&batchSummary=%E9%A2%84%E7%AE%97%E7%89%88+V2%E5%B7%B2%E9%80%9A%E8%BF%87%E3%80%81%E4%BC%B0%E7%AE%97%E7%89%88+V1%E5%B7%B2%E9%80%9A%E8%BF%87&batchIds=review-002%2Creview-001",
    );
  });

  test("resets the batch-list preference when a new batch summary replaces the previous round", async () => {
    saveRecentProcessingLink({
      projectId: "project-001",
      path: "/projects/project-001/inbox?focus=todo&refresh=reviews&resultStatus=approved&resultName=%E9%A2%84%E7%AE%97%E7%89%88+V2&resultKind=review&resultId=review-002&batchCount=2&batchSummary=%E9%A2%84%E7%AE%97%E7%89%88+V2%E5%B7%B2%E9%80%9A%E8%BF%87%E3%80%81%E4%BC%B0%E7%AE%97%E7%89%88+V1%E5%B7%B2%E9%80%9A%E8%BF%87&batchIds=review-002%2Creview-001",
      label: "本轮已处理 2 条审核：预算版 V2已通过、估算版 V1已通过",
      sourceLabel: "待办页",
      actionType: "batch-refresh",
      batchEntriesExpandedPreference: true,
      batchEntries: [
        {
          id: "review-002",
          label: "预算版 V2已通过",
          path: "/projects/project-001/reviews?reviewId=review-002&action=approve",
          sourceType: "review",
        },
        {
          id: "review-001",
          label: "估算版 V1已通过",
          path: "/projects/project-001/reviews?reviewId=review-001&action=approve",
          sourceType: "review",
        },
      ],
    });
    saveRecentProcessingLink({
      projectId: "project-001",
      path: "/projects/project-001/inbox?focus=risk&refresh=process-documents&resultStatus=approved&resultName=%E7%8E%B0%E5%9C%BA%E7%AD%BE%E8%AF%81%E5%8D%95&resultKind=process-document&resultId=doc-002&batchCount=2&batchSummary=%E7%8E%B0%E5%9C%BA%E7%AD%BE%E8%AF%81%E5%8D%95%E5%B7%B2%E9%80%9A%E8%BF%87%E3%80%81%E8%AE%BE%E8%AE%A1%E5%8F%98%E6%9B%B4%E5%8D%95%E5%B7%B2%E9%80%9A%E8%BF%87&batchIds=doc-002%2Cdoc-001",
      label: "本轮已处理 2 条过程单据：现场签证单已通过、设计变更单已通过",
      sourceLabel: "待办页",
      actionType: "batch-refresh",
      batchEntries: [
        {
          id: "doc-002",
          label: "现场签证单已通过",
          path: "/projects/project-001/process-documents?documentId=doc-002&action=approve",
          sourceType: "process-document",
        },
        {
          id: "doc-001",
          label: "设计变更单已通过",
          path: "/projects/project-001/process-documents?documentId=doc-001&action=approve",
          sourceType: "process-document",
        },
      ],
    });

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
            totalCount: 1,
            pendingReviewCount: 0,
            pendingProcessDocumentCount: 1,
            draftProcessDocumentCount: 0,
            items: ["1 条过程单据待处理"],
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

      if (url.pathname === "/v1/projects/project-001/reviews") {
        return createJsonResponse({
          items: [],
          summary: {
            totalCount: 0,
            statusCounts: {
              pending: 0,
              approved: 0,
              rejected: 0,
              cancelled: 0,
            },
            actionableCount: 0,
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/process-documents") {
        return createJsonResponse({
          items: [],
          summary: {
            totalCount: 0,
            statusCounts: {
              draft: 0,
              submitted: 0,
              approved: 0,
              rejected: 0,
            },
            documentTypeCounts: {
              change_order: 0,
              site_visa: 0,
              progress_payment: 0,
            },
          },
        });
      }

      if (url.pathname === "/v1/jobs") {
        return createJsonResponse({
          items: [],
          summary: {
            totalCount: 0,
            statusCounts: { queued: 0, processing: 0, completed: 0, failed: 0 },
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001/inbox?focus=todo"]}>
        <Routes>
          <Route path="/projects/:projectId/inbox" element={<ProjectWorkspaceInboxPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("最近协作动作：待办页记录了本轮已处理 2 条过程单据：现场签证单已通过、设计变更单已通过"),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "展开本轮对象（2）" })).toBeInTheDocument();
    expect(screen.queryByText("过程单据对象：", { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByText("审核对象：", { exact: false })).not.toBeInTheDocument();
  });

  test("clears only the highlighted copied batch object while keeping the batch summary", async () => {
    saveRecentProcessingLink({
      projectId: "project-001",
      path: "/projects/project-001/inbox?focus=todo&refresh=reviews&resultStatus=approved&resultName=%E9%A2%84%E7%AE%97%E7%89%88+V2&resultKind=review&resultId=review-002&batchCount=2&batchSummary=%E9%A2%84%E7%AE%97%E7%89%88+V2%E5%B7%B2%E9%80%9A%E8%BF%87%E3%80%81%E4%BC%B0%E7%AE%97%E7%89%88+V1%E5%B7%B2%E9%80%9A%E8%BF%87&batchIds=review-002%2Creview-001",
      label: "本轮已处理 2 条审核：预算版 V2已通过、估算版 V1已通过",
      sourceLabel: "待办页",
      actionType: "batch-refresh",
      highlightedBatchEntryId: "review-002",
      highlightedBatchEntryLabel: "预算版 V2已通过",
      highlightedBatchEntryPath: "/projects/project-001/reviews?reviewId=review-002&action=approve",
      batchEntries: [
        {
          id: "review-002",
          label: "预算版 V2已通过",
          path: "/projects/project-001/reviews?reviewId=review-002&action=approve",
          sourceType: "review",
        },
        {
          id: "review-001",
          label: "估算版 V1已通过",
          path: "/projects/project-001/reviews?reviewId=review-001&action=approve",
          sourceType: "review",
        },
      ],
    });

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

      if (url.pathname === "/v1/projects/project-001/reviews") {
        return createJsonResponse({
          items: [],
          summary: {
            totalCount: 0,
            statusCounts: {
              pending: 0,
              approved: 0,
              rejected: 0,
              cancelled: 0,
            },
            actionableCount: 0,
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/process-documents") {
        return createJsonResponse({
          items: [],
          summary: {
            totalCount: 0,
            statusCounts: {
              draft: 0,
              submitted: 0,
              approved: 0,
              rejected: 0,
            },
            documentTypeCounts: {
              change_order: 0,
              site_visa: 0,
              progress_payment: 0,
            },
          },
        });
      }

      if (url.pathname === "/v1/jobs") {
        return createJsonResponse({
          items: [],
          summary: {
            totalCount: 0,
            statusCounts: { queued: 0, processing: 0, completed: 0, failed: 0 },
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001/inbox?focus=todo"]}>
        <Routes>
          <Route path="/projects/:projectId/inbox" element={<ProjectWorkspaceInboxPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "收起本轮对象（2）" })).toBeInTheDocument();
    });
    expect(screen.getByText("最近复制对象：预算版 V2已通过")).toBeInTheDocument();
    expect(screen.getByText("（最近复制）")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "清除最近复制对象" }));

    expect(screen.queryByText("最近复制对象：预算版 V2已通过")).not.toBeInTheDocument();
    expect(screen.queryByText("（最近复制）")).not.toBeInTheDocument();
    expect(screen.getByText("最近协作动作：待办页记录了本轮已处理 2 条审核：预算版 V2已通过、估算版 V1已通过")).toBeInTheDocument();
    expect(screen.queryByText("审核对象：", { exact: false })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开本轮对象（2）" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "打开最近复制对象" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "打开最近协作入口" })).toHaveAttribute(
      "href",
      "/projects/project-001/inbox?focus=todo&refresh=reviews&resultStatus=approved&resultName=%E9%A2%84%E7%AE%97%E7%89%88+V2&resultKind=review&resultId=review-002&batchCount=2&batchSummary=%E9%A2%84%E7%AE%97%E7%89%88+V2%E5%B7%B2%E9%80%9A%E8%BF%87%E3%80%81%E4%BC%B0%E7%AE%97%E7%89%88+V1%E5%B7%B2%E9%80%9A%E8%BF%87&batchIds=review-002%2Creview-001",
    );
  });

  test("keeps the batch list expanded when the user manually expanded it before clearing the copied object", async () => {
    saveRecentProcessingLink({
      projectId: "project-001",
      path: "/projects/project-001/inbox?focus=todo&refresh=reviews&resultStatus=approved&resultName=%E9%A2%84%E7%AE%97%E7%89%88+V2&resultKind=review&resultId=review-002&batchCount=2&batchSummary=%E9%A2%84%E7%AE%97%E7%89%88+V2%E5%B7%B2%E9%80%9A%E8%BF%87%E3%80%81%E4%BC%B0%E7%AE%97%E7%89%88+V1%E5%B7%B2%E9%80%9A%E8%BF%87&batchIds=review-002%2Creview-001",
      label: "本轮已处理 2 条审核：预算版 V2已通过、估算版 V1已通过",
      sourceLabel: "待办页",
      actionType: "batch-refresh",
      highlightedBatchEntryId: "review-002",
      highlightedBatchEntryLabel: "预算版 V2已通过",
      highlightedBatchEntryPath: "/projects/project-001/reviews?reviewId=review-002&action=approve",
      batchEntries: [
        {
          id: "review-002",
          label: "预算版 V2已通过",
          path: "/projects/project-001/reviews?reviewId=review-002&action=approve",
          sourceType: "review",
        },
        {
          id: "review-001",
          label: "估算版 V1已通过",
          path: "/projects/project-001/reviews?reviewId=review-001&action=approve",
          sourceType: "review",
        },
      ],
    });

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

      if (url.pathname === "/v1/projects/project-001/reviews") {
        return createJsonResponse({
          items: [],
          summary: {
            totalCount: 0,
            statusCounts: {
              pending: 0,
              approved: 0,
              rejected: 0,
              cancelled: 0,
            },
            actionableCount: 0,
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/process-documents") {
        return createJsonResponse({
          items: [],
          summary: {
            totalCount: 0,
            statusCounts: {
              draft: 0,
              submitted: 0,
              approved: 0,
              rejected: 0,
            },
            documentTypeCounts: {
              change_order: 0,
              site_visa: 0,
              progress_payment: 0,
            },
          },
        });
      }

      if (url.pathname === "/v1/jobs") {
        return createJsonResponse({
          items: [],
          summary: {
            totalCount: 0,
            statusCounts: { queued: 0, processing: 0, completed: 0, failed: 0 },
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001/inbox?focus=todo"]}>
        <Routes>
          <Route path="/projects/:projectId/inbox" element={<ProjectWorkspaceInboxPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "收起本轮对象（2）" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "收起本轮对象（2）" }));
    expect(screen.getByRole("button", { name: "展开本轮对象（2）" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "展开本轮对象（2）" }));
    expect(screen.getByText("审核对象：", { exact: false })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "清除最近复制对象" }));

    expect(screen.queryByText("最近复制对象：预算版 V2已通过")).not.toBeInTheDocument();
    expect(screen.queryByText("（最近复制）")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "收起本轮对象（2）" })).toBeInTheDocument();
    expect(screen.getByText("审核对象：", { exact: false })).toBeInTheDocument();
  });

  test("removes invalid failureReason from inbox URL", async () => {
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

      if (url.pathname === "/v1/projects/project-001/reviews") {
        return createJsonResponse({
          items: [],
          summary: {
            totalCount: 0,
            statusCounts: {
              pending: 0,
              approved: 0,
              rejected: 0,
              cancelled: 0,
            },
            actionableCount: 0,
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/process-documents") {
        return createJsonResponse({
          items: [],
          summary: {
            totalCount: 0,
            statusCounts: {
              draft: 0,
              submitted: 0,
              approved: 0,
              rejected: 0,
            },
            documentTypeCounts: {
              change_order: 0,
              site_visa: 0,
              progress_payment: 0,
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
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001/inbox?failureReason=broken_code"]}>
        <Routes>
          <Route
            path="/projects/:projectId/inbox"
            element={
              <>
                <ProjectWorkspaceInboxPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "项目待办页" })).toBeInTheDocument();
    });

    expect(screen.getAllByTestId("location-search").at(-1)).toHaveTextContent("");
  });
});
