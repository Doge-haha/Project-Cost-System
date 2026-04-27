import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ProjectAiRecommendationsPage } from "../src/features/projects/project-ai-recommendations-page";

function createJsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}

function renderPage(initialEntry = "/projects/project-001/ai-recommendations") {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/projects/:projectId/ai-recommendations"
          element={<ProjectAiRecommendationsPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProjectAiRecommendationsPage", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  test("renders recommendations and accepts a generated item", async () => {
    let recommendationStatus = "generated";

    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse(createWorkspace());
      }

      if (url.pathname === "/v1/projects/project-001/ai/recommendations") {
        return createJsonResponse({
          items: [
            {
              id: "ai-recommendation-001",
              projectId: "project-001",
              stageCode: "estimate",
              disciplineCode: "building",
              resourceType: "bill_item",
              resourceId: "bill-item-001",
              recommendationType: "quota_recommendation",
              inputPayload: {},
              outputPayload: {
                quotaName: "挖土方",
                reason: "清单名称匹配",
              },
              status: recommendationStatus,
              createdBy: "engineer-001",
              handledBy: recommendationStatus === "accepted" ? "engineer-001" : null,
              handledAt:
                recommendationStatus === "accepted"
                  ? "2026-04-18T11:05:00.000Z"
                  : null,
              statusReason:
                recommendationStatus === "accepted" ? "人工确认接受" : null,
              createdAt: "2026-04-18T11:00:00.000Z",
              updatedAt: "2026-04-18T11:00:00.000Z",
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              generated: recommendationStatus === "generated" ? 1 : 0,
              accepted: recommendationStatus === "accepted" ? 1 : 0,
              ignored: 0,
              expired: 0,
            },
            typeCounts: {
              bill_recommendation: 0,
              quota_recommendation: 1,
              variance_warning: 0,
            },
          },
        });
      }

      if (url.pathname === "/v1/ai/recommendations/ai-recommendation-001/accept") {
        expect(init?.method).toBe("POST");
        recommendationStatus = "accepted";
        return createJsonResponse({
          id: "ai-recommendation-001",
          projectId: "project-001",
          stageCode: "estimate",
          disciplineCode: "building",
          resourceType: "bill_item",
          resourceId: "bill-item-001",
          recommendationType: "quota_recommendation",
          inputPayload: {},
          outputPayload: {
            quotaName: "挖土方",
            reason: "清单名称匹配",
          },
          status: "accepted",
          createdBy: "engineer-001",
          handledBy: "engineer-001",
          handledAt: "2026-04-18T11:05:00.000Z",
          statusReason: "人工确认接受",
          createdAt: "2026-04-18T11:00:00.000Z",
          updatedAt: "2026-04-18T11:05:00.000Z",
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "AI 推荐" })).toBeInTheDocument();
    });

    expect(screen.getByText("新点造价项目 · 待处理 1 条 · 共 1 条")).toBeInTheDocument();
    expect(screen.getByText("定额推荐 · 待处理")).toBeInTheDocument();
    expect(screen.getByText("清单名称匹配 · 挖土方")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "接受" }));

    await waitFor(() => {
      expect(screen.getByText("定额推荐已接受。")).toBeInTheDocument();
    });
    expect(screen.getByText("定额推荐 · 已接受")).toBeInTheDocument();
    expect(screen.getByText("处理人 engineer-001 · 原因 人工确认接受")).toBeInTheDocument();
  });

  test("applies recommendation filters", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse(createWorkspace());
      }

      if (url.pathname === "/v1/projects/project-001/ai/recommendations") {
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

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "AI 推荐" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("推荐类型"), {
      target: { value: "variance_warning" },
    });
    fireEvent.change(screen.getByLabelText("状态"), {
      target: { value: "generated" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "资源类型" }), {
      target: { value: "bill_item" },
    });
    fireEvent.click(screen.getByRole("button", { name: "应用筛选" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) => {
          const url = new URL(String(input));
          return (
            url.pathname === "/v1/projects/project-001/ai/recommendations" &&
            url.searchParams.get("recommendationType") === "variance_warning" &&
            url.searchParams.get("status") === "generated" &&
            url.searchParams.get("resourceType") === "bill_item"
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
