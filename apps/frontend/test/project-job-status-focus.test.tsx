import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ProjectJobStatusPage } from "../src/features/projects/project-job-status-page";

function createJsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}

describe("ProjectJobStatusPage focus", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  test("selects the focused background job from query params", async () => {
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
            items: [],
          },
          importStatus: {
            mode: "import_task",
            totalCount: 2,
            queuedCount: 0,
            processingCount: 0,
            completedCount: 0,
            failedCount: 1,
            latestTask: null,
            note: "",
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
              sourceFileName: "audit-log.json",
              sourceBatchNo: "audit-20260418-002",
              status: "completed",
              requestedBy: "user-001",
              totalItemCount: 5,
              importedItemCount: 5,
              memoryItemCount: 1,
              failedItemCount: 0,
              latestJobId: "job-002",
              latestErrorMessage: null,
              failureDetails: [],
              retryCount: 1,
              retryLimit: 3,
              canRetry: true,
              metadata: {},
              createdAt: "2026-04-18T12:00:00.000Z",
              completedAt: "2026-04-18T12:10:00.000Z",
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              queued: 0,
              processing: 0,
              completed: 1,
              failed: 0,
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
              projectId: "project-001",
              payload: {
                projectId: "project-001",
              },
              result: null,
              errorMessage: "计算失败",
              createdAt: "2026-04-18T13:00:00.000Z",
              completedAt: "2026-04-18T13:10:00.000Z",
            },
            {
              id: "job-002",
              jobType: "knowledge_extraction",
              status: "completed",
              requestedBy: "user-001",
              projectId: "project-001",
              payload: {
                projectId: "project-001",
              },
              result: {
                done: true,
              },
              errorMessage: null,
              createdAt: "2026-04-18T12:00:00.000Z",
              completedAt: "2026-04-18T12:10:00.000Z",
            },
          ],
          summary: {
            totalCount: 2,
            statusCounts: {
              queued: 0,
              processing: 0,
              completed: 1,
              failed: 1,
            },
            jobTypeCounts: {
              report_export: 0,
              project_recalculate: 1,
              knowledge_extraction: 1,
            },
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001/jobs?jobId=job-002"]}>
        <Routes>
          <Route path="/projects/:projectId/jobs" element={<ProjectJobStatusPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText("知识提取 · completed")).toHaveLength(2);
    });

    expect(screen.getByText("请求人：user-001")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "执行结果" })).toHaveValue(
      '{\n  "done": true\n}',
    );
    expect(screen.getByRole("textbox", { name: "批次元数据" })).toHaveValue("{}");
  });
});
