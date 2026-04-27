import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ProjectAuditLogsPage } from "../src/features/projects/project-audit-logs-page";

function createJsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}

function renderPage(initialEntry = "/projects/project-001/audit-logs") {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/projects/:projectId/audit-logs" element={<ProjectAuditLogsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProjectAuditLogsPage", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  test("renders audit log records and payload diff", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse(createWorkspace());
      }

      if (url.pathname === "/v1/projects/project-001/audit-logs") {
        expect(url.searchParams.get("limit")).toBe("50");
        return createJsonResponse({
          items: [
            {
              id: "audit-log-001",
              projectId: "project-001",
              stageCode: "estimate",
              resourceType: "bill_version",
              resourceId: "bill-version-001",
              action: "submit",
              operatorId: "user-002",
              beforePayload: {
                status: "draft",
              },
              afterPayload: {
                status: "submitted",
              },
              createdAt: "2026-04-18T11:00:00.000Z",
            },
          ],
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "审计日志" })).toBeInTheDocument();
    });

    expect(screen.getByText("新点造价项目 · 最近 1 条匹配记录")).toBeInTheDocument();
    expect(screen.getByText("清单版本 · estimate")).toBeInTheDocument();
    expect(screen.getByText("已提交")).toBeInTheDocument();
    expect(screen.getByText("bill-version-001")).toBeInTheDocument();
    expect(screen.getByText("user-002")).toBeInTheDocument();

    fireEvent.click(screen.getByText("查看"));
    expect(screen.getByText(/submitted/)).toBeInTheDocument();
  });

  test("applies resource and time filters to audit log query", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse(createWorkspace());
      }

      if (url.pathname === "/v1/projects/project-001/audit-logs") {
        return createJsonResponse({ items: [] });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "审计日志" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole("textbox", { name: "资源类型" }), {
      target: { value: "review_submission" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "动作" }), {
      target: { value: "approve" },
    });
    fireEvent.change(screen.getByLabelText("开始时间"), {
      target: { value: "2026-04-18T10:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "应用筛选" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) => {
          const url = new URL(String(input));
          return (
            url.pathname === "/v1/projects/project-001/audit-logs" &&
            url.searchParams.get("resourceType") === "review_submission" &&
            url.searchParams.get("action") === "approve" &&
            Boolean(url.searchParams.get("createdFrom"))
          );
        }),
      ).toBe(true);
    });
  });
});

function createWorkspace() {
  return {
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
      note: "导入状态正常。",
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
  };
}
