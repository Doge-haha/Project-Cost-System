import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ProjectReportsPage } from "../src/features/projects/project-reports-page";

function createJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function createWorkspaceResponse(canExportReports = true) {
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
    billVersions: [
      {
        id: "version-001",
        versionName: "估算版 V1",
        stageCode: "estimate",
        disciplineCode: "building",
        status: "editable",
      },
    ],
    currentUser: {
      userId: "engineer-001",
      displayName: "Cost Engineer",
      memberId: "member-001",
      permissionSummary: {
        roleCode: "cost_engineer",
        roleLabel: "造价工程师",
        canManageProject: false,
        canEditProject: true,
        canExportReports,
        scopeSummary: ["项目全部范围"],
        visibleStageCodes: ["estimate"],
        visibleDisciplineCodes: ["building"],
      },
    },
    todoSummary: { totalCount: 0, pendingReviewCount: 0, pendingProcessDocumentCount: 0, draftProcessDocumentCount: 0, items: [] },
    riskSummary: { totalCount: 0, rejectedReviewCount: 0, rejectedProcessDocumentCount: 0, failedJobCount: 0, items: [] },
    importStatus: { mode: "background_job", totalCount: 0, queuedCount: 0, processingCount: 0, completedCount: 0, failedCount: 0, latestTask: null, note: "" },
  });
}

describe("ProjectReportsPage", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  test("renders report export jobs and creates a scoped variance export", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createWorkspaceResponse();
      }

      if (url.pathname === "/v1/jobs") {
        expect(url.searchParams.get("projectId")).toBe("project-001");
        expect(url.searchParams.get("jobType")).toBe("report_export");
        return createJsonResponse({
          items: [
            {
              id: "job-001",
              jobType: "report_export",
              status: "completed",
              requestedBy: "engineer-001",
              projectId: "project-001",
              payload: {
                reportExportTaskId: "report-task-001",
                reportTemplateId: "tpl-standard-summary-v1",
                outputFormat: "json",
              },
              result: {
                taskId: "report-task-001",
              },
              createdAt: "2026-04-29T01:00:00.000Z",
              completedAt: "2026-04-29T01:01:00.000Z",
            },
            {
              id: "job-failed-001",
              jobType: "report_export",
              status: "failed",
              requestedBy: "engineer-001",
              projectId: "project-001",
              payload: {
                reportExportTaskId: "report-task-failed-001",
                reportTemplateId: "tpl-standard-summary-v1",
                outputFormat: "pdf",
              },
              result: null,
              errorMessage: "export failed",
              createdAt: "2026-04-29T01:03:00.000Z",
              completedAt: "2026-04-29T01:04:00.000Z",
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              queued: 0,
              processing: 0,
              completed: 1,
              failed: 1,
            },
            jobTypeCounts: {
              report_export: 1,
            },
          },
        });
      }

      if (url.pathname === "/v1/reports/export/report-task-001") {
        return createJsonResponse({
          id: "report-task-001",
          projectId: "project-001",
          reportType: "summary",
          status: "completed",
          requestedBy: "engineer-001",
          stageCode: "estimate",
          disciplineCode: "building",
          reportTemplateId: "tpl-standard-summary-v1",
          outputFormat: "json",
          createdAt: "2026-04-29T01:00:00.000Z",
          completedAt: "2026-04-29T01:01:00.000Z",
          downloadFileName: "summary-project-001.json",
          downloadContentType: "application/json",
          downloadContentLength: 128,
          isDownloadReady: true,
          isTerminal: true,
          hasFailed: false,
          failureMessage: null,
        });
      }

      if (url.pathname === "/v1/reports/export/report-task-failed-001") {
        return createJsonResponse({
          id: "report-task-failed-001",
          projectId: "project-001",
          reportType: "summary",
          status: "failed",
          requestedBy: "engineer-001",
          stageCode: "estimate",
          disciplineCode: "building",
          reportTemplateId: "tpl-standard-summary-v1",
          outputFormat: "pdf",
          createdAt: "2026-04-29T01:03:00.000Z",
          completedAt: "2026-04-29T01:04:00.000Z",
          errorMessage: "export failed",
          isDownloadReady: false,
          isTerminal: true,
          hasFailed: true,
          failureMessage: "export failed",
        });
      }

      if (url.pathname === "/v1/reports/export" && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        expect(body.projectId).toBe("project-001");
        expect(body.stageCode).toBe("estimate");
        expect(body.disciplineCode).toBe("building");
        if (body.reportType === "stage_bill") {
          expect(body.reportTemplateId).toBe("tpl-standard-stage-bill-v1");
          expect(body.outputFormat).toBe("excel");
          return createJsonResponse(
            {
              job: {
                id: "job-stage-bill-001",
                jobType: "report_export",
                status: "queued",
                requestedBy: "engineer-001",
                projectId: "project-001",
                payload: {
                  reportExportTaskId: "report-task-stage-bill-001",
                  reportTemplateId: "tpl-standard-stage-bill-v1",
                  outputFormat: "excel",
                },
                createdAt: "2026-04-29T01:06:00.000Z",
              },
              result: {
                id: "report-task-stage-bill-001",
                projectId: "project-001",
                reportType: "stage_bill",
                status: "queued",
                requestedBy: "engineer-001",
                stageCode: "estimate",
                disciplineCode: "building",
                reportTemplateId: "tpl-standard-stage-bill-v1",
                outputFormat: "excel",
                createdAt: "2026-04-29T01:06:00.000Z",
                isDownloadReady: false,
                isTerminal: false,
                hasFailed: false,
                failureMessage: null,
              },
            },
            202,
          );
        }
        if (body.reportType === "summary") {
          expect(body.reportTemplateId).toBe("tpl-standard-summary-v1");
          expect(body.outputFormat).toBe("pdf");
          return createJsonResponse(
            {
              job: {
                id: "job-retry-001",
                jobType: "report_export",
                status: "queued",
              },
              result: {
                id: "report-task-retry-001",
                projectId: "project-001",
                reportType: "summary",
                status: "queued",
                requestedBy: "engineer-001",
                stageCode: "estimate",
                disciplineCode: "building",
                createdAt: "2026-04-29T01:05:00.000Z",
                isDownloadReady: false,
                isTerminal: false,
                hasFailed: false,
                failureMessage: null,
              },
            },
            202,
          );
        }
        expect(body.reportType).toBe("variance");
        expect(body.reportTemplateId).toBe("tpl-standard-variance-v1");
        expect(body.outputFormat).toBe("excel");
        return createJsonResponse(
          {
            job: {
              id: "job-002",
              jobType: "report_export",
              status: "queued",
              requestedBy: "engineer-001",
              projectId: "project-001",
              payload: {
                reportExportTaskId: "report-task-002",
                reportTemplateId: "tpl-standard-variance-v1",
                outputFormat: "excel",
              },
              createdAt: "2026-04-29T01:02:00.000Z",
            },
            result: {
              id: "report-task-002",
              projectId: "project-001",
              reportType: "variance",
              status: "queued",
              requestedBy: "engineer-001",
              stageCode: "estimate",
              disciplineCode: "building",
              createdAt: "2026-04-29T01:02:00.000Z",
              isDownloadReady: false,
              isTerminal: false,
              hasFailed: false,
              failureMessage: null,
            },
          },
          202,
        );
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001/reports?billVersionId=version-001"]}>
        <Routes>
          <Route path="/projects/:projectId/reports" element={<ProjectReportsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "报表中心" })).toBeInTheDocument();
    });

    expect(screen.getByText("已选范围：估算版 V1 · estimate · building")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "模板管理" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "报表模板" })).toHaveValue("tpl-standard-summary-v1");
    expect(screen.getByRole("combobox", { name: "输出格式" })).toHaveValue("json");
    expect(screen.getByText("国标汇总报表 · 内置国标模板")).toBeInTheDocument();
    expect(screen.getByText("国标阶段清单报表 · 内置国标模板")).toBeInTheDocument();
    expect(screen.getByText("国标结算汇总报表 · 内置国标模板")).toBeInTheDocument();
    expect(screen.getByText("字段映射：totalSystemAmount、totalFinalAmount、varianceAmount")).toBeInTheDocument();
    expect(
      screen.getByText(
        "字段映射：contractBaselineAmount、approvedChangeAmount、settlementAmount、varianceAmount",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "复制为企业模板" })[0]!);

    await waitFor(() => {
      expect(screen.getByText("已复制 国标汇总报表 为企业模板。")).toBeInTheDocument();
    });
    expect(screen.getByText("国标汇总报表企业版 · 企业模板")).toBeInTheDocument();
    expect(screen.getByText("来源模板：tpl-standard-summary-v1")).toBeInTheDocument();

    expect(screen.getByText("汇总导出 · 已完成")).toBeInTheDocument();
    expect(screen.getByText("汇总导出 · 失败")).toBeInTheDocument();
    expect(screen.getAllByText("模板 tpl-standard-summary-v1").length).toBeGreaterThan(0);
    expect(screen.getByText("输出 PDF")).toBeInTheDocument();
    expect(screen.getByText("export failed")).toBeInTheDocument();
    expect(screen.getByText("文件 summary-project-001.json")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重新发起" }));

    await waitFor(() => {
      expect(screen.getByText("已重新发起汇总导出任务。")).toBeInTheDocument();
    });
    expect(screen.getByText("汇总导出 · 排队中")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "输出格式" }), {
      target: { value: "excel" },
    });
    fireEvent.click(screen.getByRole("button", { name: "导出偏差" }));

    await waitFor(() => {
      expect(screen.getByText("已创建偏差明细导出任务。")).toBeInTheDocument();
    });
    expect(screen.getByText("偏差明细导出 · 排队中")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "报表模板" }), {
      target: { value: "tpl-standard-stage-bill-v1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "导出阶段清单" }));

    await waitFor(() => {
      expect(screen.getByText("已创建阶段清单导出任务。")).toBeInTheDocument();
    });
    expect(screen.getByText("阶段清单导出 · 排队中")).toBeInTheDocument();
  });

  test("hides export actions when current user cannot export reports", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createWorkspaceResponse(false);
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
      <MemoryRouter initialEntries={["/projects/project-001/reports"]}>
        <Routes>
          <Route path="/projects/:projectId/reports" element={<ProjectReportsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "报表中心" })).toBeInTheDocument();
    });

    expect(screen.getByText("当前角色没有报表导出权限。")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "导出汇总" })).not.toBeInTheDocument();
  });
});
