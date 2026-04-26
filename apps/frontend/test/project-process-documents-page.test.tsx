import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ProjectProcessDocumentsPage } from "../src/features/projects/project-process-documents-page";
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

describe("ProjectProcessDocumentsPage", () => {
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
      new URL(
        "http://localhost/projects/project-001/process-documents?documentId=doc-001&action=approve",
      ),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    clipboardWriteText.mockReset();
    window.sessionStorage.clear();
  });

  test("renders process document actions and submits approve flow", async () => {
    saveRecentProcessingLink({
      projectId: "project-001",
      path: "/projects/project-001/reviews?reviewId=review-001&action=approve",
      label: "审核处理入口",
      sourceLabel: "审核处理页",
    });

    let documentStatus = "submitted";
    let documentComment = "待审核";

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
            pendingReviewCount: 0,
            pendingProcessDocumentCount: 1,
            draftProcessDocumentCount: 0,
            items: ["1 条过程单据待审核"],
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
        url.pathname === "/v1/projects/project-001/process-documents" &&
        ((typeof init?.method === "string" && init.method === "GET") ||
          init?.method === undefined)
      ) {
        return createJsonResponse({
          items: [
            {
              id: "doc-001",
              stageCode: "estimate",
              disciplineCode: "building",
              documentType: "change_order",
              status: documentStatus,
              title: "设计变更单",
              referenceNo: "BG-001",
              amount: 1200,
              submittedBy: "user-002",
              submittedAt: "2026-04-18T10:30:00.000Z",
              lastComment: documentComment,
              stageName: "投资估算",
              disciplineName: "建筑工程",
              isEditable: false,
              isReviewable: documentStatus === "submitted",
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              draft: 0,
              submitted: documentStatus === "submitted" ? 1 : 0,
              approved: documentStatus === "approved" ? 1 : 0,
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

      if (
        url.pathname === "/v1/projects/project-001/process-documents/doc-001/status"
      ) {
        documentStatus = "approved";
        documentComment = "同意变更";
        return createJsonResponse({
          id: "doc-001",
          status: "approved",
          lastComment: documentComment,
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter
        initialEntries={[
          "/projects/project-001/process-documents?documentId=doc-001&action=approve",
        ]}
      >
        <Routes>
          <Route
            path="/projects/:projectId/process-documents"
            element={
              <>
                <ProjectProcessDocumentsPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "过程单据处理页" })).toBeInTheDocument();
    });

    expect(screen.getByText("最近协作动作：审核处理页复制了审核处理入口")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "回到审核处理页" })).toHaveAttribute(
      "href",
      "/projects/project-001/reviews?reviewId=review-001&action=approve",
    );
    expect(screen.queryByRole("link", { name: "打开最近协作入口" })).not.toBeInTheDocument();
    expect(screen.getByText("已提交，当前角色可直接审核。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "通过" }));
    fireEvent.click(screen.getByRole("button", { name: "复制当前处理链接" }));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(
        "http://localhost/projects/project-001/process-documents?documentId=doc-001&action=approve",
      );
    });
    expect(screen.getByText("已复制当前处理链接，可直接发给协作同事。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "打开刚复制入口" })).toHaveAttribute(
      "href",
      "/projects/project-001/process-documents?documentId=doc-001&action=approve",
    );

    fireEvent.change(screen.getByRole("textbox", { name: "备注" }), {
      target: { value: "同意变更" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认处理" }));

    await waitFor(() => {
      expect(screen.getByText("设计变更单 · approved")).toBeInTheDocument();
    });

    expect(screen.getByText("当前状态：approved")).toBeInTheDocument();
    expect(screen.getByText("当前备注：同意变更")).toBeInTheDocument();
    expect(screen.getByText("设计变更单 已完成本次处理，可回到工作台继续查看刷新后的摘要和最近动态。")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });

    expect(screen.getByRole("link", { name: "返回项目工作台" })).toHaveAttribute(
      "href",
      "/projects/project-001?refresh=process-documents&resultStatus=approved&resultName=%E8%AE%BE%E8%AE%A1%E5%8F%98%E6%9B%B4%E5%8D%95&resultKind=process-document&resultId=doc-001",
    );
    expect(screen.getByRole("link", { name: "返回待办页" })).toHaveAttribute(
      "href",
      "/projects/project-001/inbox?focus=risk&refresh=process-documents&resultStatus=approved&resultName=%E8%AE%BE%E8%AE%A1%E5%8F%98%E6%9B%B4%E5%8D%95&resultKind=process-document&resultId=doc-001",
    );
    expect(
      fetchMock.mock.calls.some(
        ([input, init]) =>
          String(input).includes(
            "/v1/projects/project-001/process-documents/doc-001/status",
          ) && init?.method === "PUT",
      ),
    ).toBe(true);
  });

  test("shows process document list summary and supports status filters", async () => {
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
            pendingReviewCount: 0,
            pendingProcessDocumentCount: 1,
            draftProcessDocumentCount: 0,
            items: ["1 条过程单据待审核"],
          },
          riskSummary: {
            totalCount: 1,
            rejectedReviewCount: 0,
            rejectedProcessDocumentCount: 1,
            failedJobCount: 0,
            items: ["1 条过程单据被退回"],
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
        url.pathname === "/v1/projects/project-001/process-documents" &&
        ((typeof init?.method === "string" && init.method === "GET") ||
          init?.method === undefined)
      ) {
        return createJsonResponse({
          items: [
            {
              id: "doc-000",
              stageCode: "estimate",
              disciplineCode: "building",
              documentType: "site_visa",
              status: "draft",
              title: "草稿签证单",
              referenceNo: "QZ-001",
              amount: 600,
              submittedBy: "user-003",
              submittedAt: "2026-04-16T10:30:00.000Z",
              lastComment: "待补充工程量",
              stageName: "投资估算",
              disciplineName: "建筑工程",
              isEditable: true,
              isReviewable: false,
            },
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
              stageCode: "budget",
              disciplineCode: "install",
              documentType: "site_visa",
              status: "rejected",
              title: "现场签证单",
              referenceNo: "QZ-002",
              amount: 800,
              submittedBy: "user-003",
              submittedAt: "2026-04-17T10:30:00.000Z",
              lastComment: "请补充工程量",
              stageName: "施工图预算",
              disciplineName: "安装工程",
              isEditable: false,
              isReviewable: false,
            },
          ],
          summary: {
            totalCount: 3,
            statusCounts: {
              draft: 1,
              submitted: 1,
              approved: 0,
              rejected: 1,
            },
            documentTypeCounts: {
              change_order: 1,
              site_visa: 2,
              progress_payment: 0,
            },
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001/process-documents"]}>
        <Routes>
          <Route
            path="/projects/:projectId/process-documents"
            element={
              <>
                <ProjectProcessDocumentsPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("设计变更单 · submitted")).toBeInTheDocument();
    });
    expect(screen.getByText("草稿签证单 · draft")).toBeInTheDocument();
    expect(screen.getByText("现场签证单 · rejected")).toBeInTheDocument();

    expect(screen.getByText(/共 3 条，待提交\s*1\s*条，\s*待审核\s*1\s*条/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "草稿 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "待审核 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "仅看我可处理 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "已退回 1" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "草稿 1" }));
    expect(screen.getByTestId("location-search")).toHaveTextContent("?filter=draft");
    expect(screen.getByText("草稿签证单 · draft")).toBeInTheDocument();
    expect(screen.queryByText("设计变更单 · submitted")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "待审核 1" }));
    expect(screen.getByTestId("location-search")).toHaveTextContent("?filter=submitted");
    expect(screen.getByText("设计变更单 · submitted")).toBeInTheDocument();
    expect(screen.queryByText("现场签证单 · rejected")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "已退回 1" }));
    expect(screen.getByTestId("location-search")).toHaveTextContent("?filter=rejected");
    expect(screen.getByText("现场签证单 · rejected")).toBeInTheDocument();
  });

  test("expands batch objects from recent collaboration summary", async () => {
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
        },
        {
          id: "doc-001",
          label: "设计变更单已通过",
          path: "/projects/project-001/process-documents?documentId=doc-001&action=approve",
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
            pendingReviewCount: 0,
            pendingProcessDocumentCount: 1,
            draftProcessDocumentCount: 0,
            items: ["1 条过程单据待审核"],
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
        url.pathname === "/v1/projects/project-001/process-documents" &&
        ((typeof init?.method === "string" && init.method === "GET") ||
          init?.method === undefined)
      ) {
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

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001/process-documents"]}>
        <Routes>
          <Route
            path="/projects/:projectId/process-documents"
            element={<ProjectProcessDocumentsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "最近协作动作：待办页记录了本轮已处理 2 条过程单据：现场签证单已通过、设计变更单已通过",
        ),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("本轮对象：2 条")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开本轮对象（2）" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "现场签证单已通过" })).not.toBeInTheDocument();
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
  });

  test("highlights and prioritizes the actionable process document from summary focus", async () => {
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
            pendingReviewCount: 0,
            pendingProcessDocumentCount: 2,
            draftProcessDocumentCount: 0,
            items: ["2 条过程单据待审核"],
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
        url.pathname === "/v1/projects/project-001/process-documents" &&
        ((typeof init?.method === "string" && init.method === "GET") ||
          init?.method === undefined)
      ) {
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
              lastComment: "普通待审核",
              stageName: "投资估算",
              disciplineName: "建筑工程",
              isEditable: false,
              isReviewable: false,
            },
            {
              id: "doc-002",
              stageCode: "budget",
              disciplineCode: "install",
              documentType: "site_visa",
              status: "submitted",
              title: "现场签证单",
              referenceNo: "QZ-002",
              amount: 800,
              submittedBy: "user-003",
              submittedAt: "2026-04-19T10:30:00.000Z",
              lastComment: "优先处理",
              stageName: "施工图预算",
              disciplineName: "安装工程",
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

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter
        initialEntries={[
          "/projects/project-001/process-documents?filter=submitted&summaryFocus=submitted",
        ]}
      >
        <Routes>
          <Route
            path="/projects/:projectId/process-documents"
            element={<ProjectProcessDocumentsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("现场签证单 · submitted")).toBeInTheDocument();
    });

    const cards = screen.getAllByText(/· submitted/).map((node) => node.closest(".list-card"));
    expect(cards[0]).toHaveTextContent("现场签证单 · submitted");
    expect(cards[0]).toHaveClass("selected");
  });

  test("automatically advances to the next actionable process document after processing", async () => {
    let documentStates = [
      {
        id: "doc-001",
        title: "设计变更单",
        status: "submitted",
        lastComment: "待审核",
        isEditable: false,
        isReviewable: true,
      },
      {
        id: "doc-002",
        title: "现场签证单",
        status: "submitted",
        lastComment: "继续审核",
        isEditable: false,
        isReviewable: true,
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
            pendingReviewCount: 0,
            pendingProcessDocumentCount: 2,
            draftProcessDocumentCount: 0,
            items: ["2 条过程单据待审核"],
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
        url.pathname === "/v1/projects/project-001/process-documents" &&
        ((typeof init?.method === "string" && init.method === "GET") ||
          init?.method === undefined)
      ) {
        return createJsonResponse({
          items: documentStates.map((document, index) => ({
            id: document.id,
            stageCode: index === 0 ? "estimate" : "budget",
            disciplineCode: index === 0 ? "building" : "install",
            documentType: index === 0 ? "change_order" : "site_visa",
            status: document.status,
            title: document.title,
            referenceNo: `REF-00${index + 1}`,
            amount: 1000 + index,
            submittedBy: `user-00${index + 2}`,
            submittedAt: `2026-04-1${index + 8}T10:30:00.000Z`,
            lastComment: document.lastComment,
            stageName: index === 0 ? "投资估算" : "施工图预算",
            disciplineName: index === 0 ? "建筑工程" : "安装工程",
            isEditable: document.isEditable,
            isReviewable: document.isReviewable,
          })),
          summary: {
            totalCount: documentStates.length,
            statusCounts: {
              draft: documentStates.filter((document) => document.status === "draft").length,
              submitted: documentStates.filter((document) => document.status === "submitted").length,
              approved: documentStates.filter((document) => document.status === "approved").length,
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

      if (url.pathname === "/v1/projects/project-001/process-documents/doc-001/status") {
        documentStates = documentStates.map((document) =>
          document.id === "doc-001"
            ? {
                ...document,
                status: "approved",
                lastComment: "同意变更",
                isReviewable: false,
              }
            : document,
        );
        return createJsonResponse({
          id: "doc-001",
          status: "approved",
          lastComment: "同意变更",
        });
      }

      if (url.pathname === "/v1/projects/project-001/process-documents/doc-002/status") {
        documentStates = documentStates.map((document) =>
          document.id === "doc-002"
            ? {
                ...document,
                status: "approved",
                lastComment: "继续通过",
                isReviewable: false,
              }
            : document,
        );
        return createJsonResponse({
          id: "doc-002",
          status: "approved",
          lastComment: "继续通过",
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter
        initialEntries={[
          "/projects/project-001/process-documents?documentId=doc-001&action=approve",
        ]}
      >
        <Routes>
          <Route
            path="/projects/:projectId/process-documents"
            element={
              <>
                <ProjectProcessDocumentsPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("当前处理：设计变更单 · approve")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole("textbox", { name: "备注" }), {
      target: { value: "同意变更" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认处理" }));

    await waitFor(() => {
      expect(screen.getByText("设计变更单 · approved")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText("当前处理：现场签证单 · approve")).toBeInTheDocument();
    });
    expect(screen.getByText("现场签证单 · submitted").closest(".list-card")).toHaveClass("selected");
    expect(screen.getByText("处理完成")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "备注" }), {
      target: { value: "继续通过" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认处理" }));

    await waitFor(() => {
      expect(screen.getByText("本轮已处理 2 条")).toBeInTheDocument();
    });
    expect(screen.getByText("现场签证单 · approved · 备注：继续通过")).toBeInTheDocument();
    expect(screen.getByText("设计变更单 · approved · 备注：同意变更")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回待办页" })).toHaveAttribute(
      "href",
      "/projects/project-001/inbox?focus=risk&refresh=process-documents&resultStatus=approved&resultName=%E7%8E%B0%E5%9C%BA%E7%AD%BE%E8%AF%81%E5%8D%95&resultKind=process-document&resultId=doc-002&batchCount=2&batchSummary=%E7%8E%B0%E5%9C%BA%E7%AD%BE%E8%AF%81%E5%8D%95%E5%B7%B2%E9%80%9A%E8%BF%87%E3%80%81%E8%AE%BE%E8%AE%A1%E5%8F%98%E6%9B%B4%E5%8D%95%E5%B7%B2%E9%80%9A%E8%BF%87&batchIds=doc-002%2Cdoc-001",
    );
  });
});
