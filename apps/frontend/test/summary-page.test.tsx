import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { SummaryPage } from "../src/features/reports/summary-page";

function createJsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}

function createEmptyAiRecommendationResponse() {
  return createJsonResponse({
    items: [],
    summary: {
      totalCount: 0,
      statusCounts: {
        generated: 0,
        accepted: 0,
        ignored: 0,
        expired: 0,
      },
      typeCounts: {
        bill_recommendation: 0,
        quota_recommendation: 0,
        variance_warning: 0,
      },
    },
  });
}

function createWorkspaceResponse(options?: {
  canExportReports?: boolean;
  versions?: Array<{
    id: string;
    versionName: string;
    stageCode: string;
    disciplineCode: string;
    status: string;
  }>;
}) {
  return createJsonResponse({
    project: {
      id: "project-001",
      code: "XM-001",
      name: "新点造价项目",
      status: "active",
    },
    currentStage: null,
    availableStages: [],
    disciplines: [],
    billVersions:
      options?.versions ?? [
        {
          id: "version-001",
          versionName: "估算版 V1",
          stageCode: "estimate",
          disciplineCode: "building",
          status: "editable",
        },
      ],
    todoSummary: { totalCount: 0, pendingReviewCount: 0, pendingProcessDocumentCount: 0, draftProcessDocumentCount: 0, items: [] },
    riskSummary: { totalCount: 0, rejectedReviewCount: 0, rejectedProcessDocumentCount: 0, failedJobCount: 0, items: [] },
    importStatus: { mode: "background_job", totalCount: 0, queuedCount: 0, processingCount: 0, completedCount: 0, failedCount: 0, latestTask: null, note: "" },
    currentUser: {
      userId: "engineer-001",
      displayName: "Cost Engineer",
      memberId: "member-001",
      permissionSummary: {
        roleCode: "cost_engineer",
        roleLabel: "造价工程师",
        canManageProject: false,
        canEditProject: true,
        canExportReports: options?.canExportReports ?? true,
        scopeSummary: ["项目全部范围"],
        visibleStageCodes: ["estimate"],
        visibleDisciplineCodes: ["building"],
      },
    },
  });
}

describe("SummaryPage", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  test("renders project name in breadcrumbs instead of raw project id", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001") {
        return createJsonResponse({
          id: "project-001",
          code: "XM-001",
          name: "新点造价项目",
          status: "active",
        });
      }

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createWorkspaceResponse();
      }

      if (url.pathname === "/v1/reports/summary") {
        return createJsonResponse({
          totalSystemAmount: 1000,
          totalFinalAmount: 1200,
          varianceAmount: 200,
          itemCount: 2,
        });
      }

      if (url.pathname === "/v1/reports/summary/details") {
        return createJsonResponse({
          items: [],
        });
      }

      if (url.pathname === "/v1/projects/project-001/bill-versions") {
        return createJsonResponse({
          items: [
            {
              id: "version-001",
              versionName: "估算版 V1",
              stageCode: "estimate",
              disciplineCode: "building",
              status: "editable",
            },
          ],
        });
      }

      if (url.pathname === "/v1/projects/project-001/ai/recommendations") {
        return createEmptyAiRecommendationResponse();
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001/summary?billVersionId=version-001"]}>
        <Routes>
          <Route path="/projects/:projectId/summary" element={<SummaryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "汇总页" })).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: "新点造价项目" })).toHaveAttribute(
      "href",
      "/projects/project-001",
    );
    expect(screen.getByText("当前项目：新点造价项目（XM-001）")).toBeInTheDocument();
  });

  test("renders tax excluded summary mode and tax amount", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001") {
        return createJsonResponse({
          id: "project-001",
          code: "XM-001",
          name: "新点造价项目",
          status: "active",
        });
      }

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createWorkspaceResponse();
      }

      if (url.pathname === "/v1/reports/summary") {
        expect(url.searchParams.get("taxMode")).toBe("tax_excluded");
        return createJsonResponse({
          totalSystemAmount: 1080,
          totalFinalAmount: 1166.4,
          varianceAmount: 86.4,
          varianceRate: 0.08,
          totalTaxAmount: 32.4,
          taxMode: "tax_excluded",
          itemCount: 1,
        });
      }

      if (url.pathname === "/v1/reports/summary/details") {
        expect(url.searchParams.get("taxMode")).toBe("tax_excluded");
        return createJsonResponse({
          items: [
            {
              itemId: "bill-item-001",
              itemCode: "A.1",
              itemName: "土石方工程",
              systemAmount: 1080,
              finalAmount: 1166.4,
              varianceAmount: 86.4,
              taxAmount: 32.4,
            },
          ],
        });
      }

      if (url.pathname === "/v1/projects/project-001/bill-versions") {
        return createJsonResponse({
          items: [
            {
              id: "version-001",
              versionName: "估算版 V1",
              stageCode: "estimate",
              disciplineCode: "building",
              status: "editable",
            },
          ],
        });
      }

      if (url.pathname === "/v1/projects/project-001/ai/recommendations") {
        return createEmptyAiRecommendationResponse();
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter
        initialEntries={[
          "/projects/project-001/summary?billVersionId=version-001&taxMode=tax_excluded",
        ]}
      >
        <Routes>
          <Route path="/projects/:projectId/summary" element={<SummaryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "计税口径" })).toHaveValue(
        "tax_excluded",
      );
    });

    expect(screen.getByText("已剔除税金")).toBeInTheDocument();
    expect(screen.getAllByText("32.40").length).toBeGreaterThan(0);
    expect(screen.getByText("税金 32.40")).toBeInTheDocument();
  });

  test("renders full version compare table when compare query is present", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001") {
        return createJsonResponse({
          id: "project-001",
          code: "XM-001",
          name: "新点造价项目",
          status: "active",
        });
      }

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createWorkspaceResponse();
      }

      if (url.pathname === "/v1/reports/summary") {
        return createJsonResponse({
          totalSystemAmount: 1000,
          totalFinalAmount: 1200,
          varianceAmount: 200,
          itemCount: 2,
        });
      }

      if (url.pathname === "/v1/reports/summary/details") {
        return createJsonResponse({
          items: [],
        });
      }

      if (url.pathname === "/v1/projects/project-001/bill-versions") {
        return createJsonResponse({
          items: [
            {
              id: "version-001",
              versionName: "估算版 V1",
              stageCode: "estimate",
              disciplineCode: "building",
              status: "editable",
            },
            {
              id: "version-002",
              versionName: "概算版 V2",
              stageCode: "budget",
              disciplineCode: "building",
              status: "submitted",
            },
          ],
        });
      }

      if (url.pathname === "/v1/projects/project-001/ai/recommendations") {
        return createEmptyAiRecommendationResponse();
      }

      if (url.pathname === "/v1/reports/version-compare") {
        return createJsonResponse({
          projectId: "project-001",
          baseBillVersionId: "version-001",
          targetBillVersionId: "version-002",
          baseVersionName: "估算版 V1",
          targetVersionName: "概算版 V2",
          itemCount: 2,
          items: [
            {
              itemCode: "A.1",
              itemNameBase: "土石方工程",
              itemNameTarget: "土石方工程",
              baseSystemAmount: 1080,
              targetSystemAmount: 1200,
              baseFinalAmount: 1198.8,
              targetFinalAmount: 1320,
              systemVarianceAmount: 120,
              finalVarianceAmount: 121.2,
            },
            {
              itemCode: "B.1",
              itemNameBase: "模板工程",
              itemNameTarget: "模板工程",
              baseSystemAmount: 900,
              targetSystemAmount: 840,
              baseFinalAmount: 990,
              targetFinalAmount: 860,
              systemVarianceAmount: -60,
              finalVarianceAmount: -130,
            },
          ],
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter
        initialEntries={[
          "/projects/project-001/summary?billVersionId=version-002&compareBaseBillVersionId=version-001&compareTargetBillVersionId=version-002",
        ]}
      >
        <Routes>
          <Route path="/projects/:projectId/summary" element={<SummaryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("共对比 2 个清单项，下面按最终值偏差绝对值从高到低展示。")).toBeInTheDocument();
    });

    const compareTable = screen.getByRole("table");
    expect(screen.getByRole("columnheader", { name: "基准系统值" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "最终值偏差" })).toBeInTheDocument();
    expect(within(compareTable).getByText("模板工程")).toBeInTheDocument();
    expect(within(compareTable).getByText("土石方工程")).toBeInTheDocument();
    expect(within(compareTable).getByText("-130.00")).toBeInTheDocument();
    expect(within(compareTable).getByText("121.20")).toBeInTheDocument();
  });

  test("renders generated AI variance warnings on the summary page", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001") {
        return createJsonResponse({
          id: "project-001",
          code: "XM-001",
          name: "新点造价项目",
          status: "active",
        });
      }

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createWorkspaceResponse();
      }

      if (url.pathname === "/v1/reports/summary") {
        return createJsonResponse({
          totalSystemAmount: 1000,
          totalFinalAmount: 1400,
          varianceAmount: 400,
          itemCount: 2,
        });
      }

      if (url.pathname === "/v1/reports/summary/details") {
        return createJsonResponse({ items: [] });
      }

      if (url.pathname === "/v1/projects/project-001/bill-versions") {
        return createJsonResponse({
          items: [
            {
              id: "version-001",
              versionName: "估算版 V1",
              stageCode: "estimate",
              disciplineCode: "building",
              status: "editable",
            },
          ],
        });
      }

      if (url.pathname === "/v1/projects/project-001/ai/recommendations") {
        expect(url.searchParams.get("recommendationType")).toBe("variance_warning");
        expect(url.searchParams.get("status")).toBe("generated");
        return createJsonResponse({
          items: [
            {
              id: "ai-rec-001",
              projectId: "project-001",
              stageCode: "estimate",
              disciplineCode: "building",
              resourceType: "bill_item",
              resourceId: "bill-item-001",
              recommendationType: "variance_warning",
              inputPayload: {},
              outputPayload: {
                billVersionId: "version-001",
                itemCode: "A-001",
                itemName: "土方工程",
                warning: "清单最终金额与系统金额偏差超过阈值",
                varianceAmount: 400,
              },
              status: "generated",
              createdBy: "engineer-001",
              createdAt: "2026-04-27T00:00:00.000Z",
              updatedAt: "2026-04-27T00:00:00.000Z",
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              generated: 1,
              accepted: 0,
              ignored: 0,
              expired: 0,
            },
            typeCounts: {
              bill_recommendation: 0,
              quota_recommendation: 0,
              variance_warning: 1,
            },
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001/summary?billVersionId=version-001"]}>
        <Routes>
          <Route path="/projects/:projectId/summary" element={<SummaryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "AI 偏差预警" })).toBeInTheDocument();
    });

    expect(screen.getByText("当前还有 1 条待处理预警，来自 AI 推荐结果缓存。")).toBeInTheDocument();
    expect(screen.getByText("土方工程")).toBeInTheDocument();
    expect(screen.getAllByText("400.00").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("link", { name: "查看全部预警" })).toHaveAttribute(
      "href",
      "/projects/project-001/ai-recommendations?recommendationType=variance_warning&status=generated",
    );
  });

  test("creates report export task, refreshes status, and exposes download", async () => {
    const createObjectUrl = vi.fn(() => "blob:report-export");
    const revokeObjectUrl = vi.fn();
    Object.defineProperty(window.URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrl,
    });
    Object.defineProperty(window.URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrl,
    });
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001") {
        return createJsonResponse({
          id: "project-001",
          code: "XM-001",
          name: "新点造价项目",
          status: "active",
        });
      }

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createWorkspaceResponse();
      }

      if (url.pathname === "/v1/reports/summary") {
        return createJsonResponse({
          totalSystemAmount: 1000,
          totalFinalAmount: 1200,
          varianceAmount: 200,
          itemCount: 2,
        });
      }

      if (url.pathname === "/v1/reports/summary/details") {
        return createJsonResponse({ items: [] });
      }

      if (url.pathname === "/v1/projects/project-001/bill-versions") {
        return createJsonResponse({
          items: [
            {
              id: "version-001",
              versionName: "估算版 V1",
              stageCode: "estimate",
              disciplineCode: "building",
              status: "editable",
            },
          ],
        });
      }

      if (url.pathname === "/v1/projects/project-001/ai/recommendations") {
        return createEmptyAiRecommendationResponse();
      }

      if (url.pathname === "/v1/reports/export" && init?.method === "POST") {
        return createJsonResponse({
          job: {
            id: "job-export-001",
            jobType: "report_export",
            status: "queued",
          },
          result: {
            id: "report-task-001",
            projectId: "project-001",
            reportType: "summary",
            status: "queued",
            requestedBy: "engineer-001",
            createdAt: "2026-04-26T08:00:00.000Z",
            isDownloadReady: false,
            isTerminal: false,
            hasFailed: false,
            failureMessage: null,
          },
        });
      }

      if (url.pathname === "/v1/reports/export/report-task-001" && init?.method !== "POST") {
        return createJsonResponse({
          id: "report-task-001",
          projectId: "project-001",
          reportType: "summary",
          status: "completed",
          requestedBy: "engineer-001",
          createdAt: "2026-04-26T08:00:00.000Z",
          completedAt: "2026-04-26T08:01:00.000Z",
          downloadFileName: "summary-report-task-001.json",
          downloadContentType: "application/json; charset=utf-8",
          downloadContentLength: 128,
          isDownloadReady: true,
          isTerminal: true,
          hasFailed: false,
          failureMessage: null,
        });
      }

      if (url.pathname === "/v1/reports/export/report-task-001/download") {
        return new Response(JSON.stringify({ totalFinalAmount: 1200 }), {
          status: 200,
          headers: {
            "content-disposition": 'attachment; filename="summary-report-task-001.json"',
            "content-type": "application/json",
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001/summary?billVersionId=version-001"]}>
        <Routes>
          <Route path="/projects/:projectId/summary" element={<SummaryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "汇总页" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "导出汇总" }));

    await waitFor(() => {
      expect(screen.getByText("汇总导出 · 排队中")).toBeInTheDocument();
    });
    expect(screen.getByText("后台任务 job-export-001")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下载文件" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "刷新状态" }));

    await waitFor(() => {
      expect(screen.getByText("汇总导出 · 已完成")).toBeInTheDocument();
    });
    expect(screen.getByText("文件 summary-report-task-001.json")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "下载文件" }));

    await waitFor(() => {
      expect(anchorClick).toHaveBeenCalled();
    });
    expect(createObjectUrl).toHaveBeenCalled();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:report-export");
  });

  test("hides report export controls when workspace permission denies export", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001") {
        return createJsonResponse({
          id: "project-001",
          code: "XM-001",
          name: "新点造价项目",
          status: "active",
        });
      }

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createWorkspaceResponse({ canExportReports: false });
      }

      if (url.pathname === "/v1/reports/summary") {
        return createJsonResponse({
          totalSystemAmount: 1000,
          totalFinalAmount: 1200,
          varianceAmount: 200,
          itemCount: 2,
        });
      }

      if (url.pathname === "/v1/reports/summary/details") {
        return createJsonResponse({ items: [] });
      }

      if (url.pathname === "/v1/projects/project-001/bill-versions") {
        return createJsonResponse({
          items: [
            {
              id: "version-001",
              versionName: "估算版 V1",
              stageCode: "estimate",
              disciplineCode: "building",
              status: "editable",
            },
          ],
        });
      }

      if (url.pathname === "/v1/projects/project-001/ai/recommendations") {
        return createEmptyAiRecommendationResponse();
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001/summary?billVersionId=version-001"]}>
        <Routes>
          <Route path="/projects/:projectId/summary" element={<SummaryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "汇总页" })).toBeInTheDocument();
    });

    expect(screen.queryByRole("heading", { name: "报表导出" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "导出汇总" })).not.toBeInTheDocument();
  });
});
