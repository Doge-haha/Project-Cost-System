import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ProjectKnowledgePage } from "../src/features/projects/project-knowledge-page";

function createJsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}

function renderPage(initialEntry = "/projects/project-001/knowledge") {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/projects/:projectId/knowledge" element={<ProjectKnowledgePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProjectKnowledgePage", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  test("renders knowledge entries and project memories", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse(createWorkspace());
      }

      if (url.pathname === "/v1/projects/project-001/knowledge-entries") {
        expect(url.searchParams.get("limit")).toBe("50");
        return createJsonResponse({
          items: [
            {
              id: "knowledge-entry-001",
              projectId: "project-001",
              stageCode: "estimate",
              sourceJobId: "job-001",
              sourceType: "audit_log",
              sourceAction: "reject",
              title: "复核驳回原因",
              summary: "安装专业工程量偏差超过阈值，需要补充依据。",
              tags: ["偏差", "审核"],
              metadata: {},
              createdAt: "2026-04-18T11:00:00.000Z",
            },
          ],
          summary: {
            totalCount: 1,
            sourceTypeCounts: {
              audit_log: 1,
            },
            sourceActionCounts: {
              reject: 1,
            },
            stageCounts: {
              estimate: 1,
            },
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/memory-entries") {
        return createJsonResponse({
          items: [
            {
              id: "memory-entry-001",
              projectId: "project-001",
              stageCode: "estimate",
              sourceJobId: "job-001",
              memoryKey: "project.preference.review_threshold",
              subjectType: "project",
              subjectId: "project-001",
              content: "项目复核重点关注安装专业偏差。",
              metadata: {},
              createdAt: "2026-04-18T11:05:00.000Z",
            },
          ],
          summary: {
            totalCount: 1,
            subjectTypeCounts: {
              project: 1,
            },
            stageCounts: {
              estimate: 1,
            },
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "知识与记忆" })).toBeInTheDocument();
    });

    expect(screen.getByText("新点造价项目 · 知识 1 条 · 记忆 1 条")).toBeInTheDocument();
    expect(screen.getByText("复核驳回原因")).toBeInTheDocument();
    expect(screen.getByText("安装专业工程量偏差超过阈值，需要补充依据。")).toBeInTheDocument();
    expect(screen.getByText("project.preference.review_threshold")).toBeInTheDocument();
    expect(screen.getByText("项目复核重点关注安装专业偏差。")).toBeInTheDocument();
  });

  test("uses knowledge search and memory filters when query is provided", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse(createWorkspace());
      }

      if (
        url.pathname === "/v1/projects/project-001/knowledge-entries" ||
        url.pathname === "/v1/projects/project-001/knowledge-search"
      ) {
        return createJsonResponse({
          items: [],
          summary: {
            totalCount: 0,
            sourceTypeCounts: {},
            sourceActionCounts: {},
            stageCounts: {},
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/memory-entries") {
        return createJsonResponse({
          items: [],
          summary: {
            totalCount: 0,
            subjectTypeCounts: {},
            stageCounts: {},
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "知识与记忆" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole("textbox", { name: "关键词" }), {
      target: { value: "偏差" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "来源类型" }), {
      target: { value: "audit_log" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "记忆主体类型" }), {
      target: { value: "project" },
    });
    fireEvent.click(screen.getByRole("button", { name: "应用筛选" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) => {
          const url = new URL(String(input));
          return (
            url.pathname === "/v1/projects/project-001/knowledge-search" &&
            url.searchParams.get("q") === "偏差" &&
            url.searchParams.get("sourceType") === "audit_log"
          );
        }),
      ).toBe(true);
    });
    expect(
      fetchMock.mock.calls.some(([input]) => {
        const url = new URL(String(input));
        return (
          url.pathname === "/v1/projects/project-001/memory-entries" &&
          url.searchParams.get("subjectType") === "project"
        );
      }),
    ).toBe(true);
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
