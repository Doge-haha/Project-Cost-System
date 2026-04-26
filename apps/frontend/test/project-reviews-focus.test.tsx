import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ProjectReviewsPage } from "../src/features/projects/project-reviews-page";

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

describe("ProjectReviewsPage focus", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  test("selects and expands the focused review from query params", async () => {
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
      <MemoryRouter
        initialEntries={["/projects/project-001/reviews?reviewId=review-001&action=reject"]}
      >
        <Routes>
          <Route path="/projects/:projectId/reviews" element={<ProjectReviewsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("当前处理：估算版 V1 · reject")).toBeInTheDocument();
    });

    expect(screen.getByRole("textbox", { name: "备注" })).toBeInTheDocument();
    expect(screen.getByText("驳回原因")).toBeInTheDocument();
  });

  test("writes selected review action into query params and clears them on cancel", async () => {
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

    fireEvent.click(screen.getAllByRole("button", { name: "驳回" })[0]);

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe(
        "?reviewId=review-001&action=reject",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
  });

  test("cleans invalid review params from query string", async () => {
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
      <MemoryRouter
        initialEntries={["/projects/project-001/reviews?reviewId=missing-review&action=reject"]}
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

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
  });
});
