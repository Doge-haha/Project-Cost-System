import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ProjectProcessDocumentsPage } from "../src/features/projects/project-process-documents-page";

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

describe("ProjectProcessDocumentsPage focus", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  test("selects and expands the focused process document from query params", async () => {
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
            pendingProcessDocumentCount: 1,
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
            element={<ProjectProcessDocumentsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("当前处理：设计变更单 · approve")).toBeInTheDocument();
    });

    expect(screen.getByRole("textbox", { name: "备注" })).toBeInTheDocument();
  });

  test("writes selected process document action into query params and clears them on cancel", async () => {
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
            pendingProcessDocumentCount: 1,
            draftProcessDocumentCount: 1,
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
      expect(screen.getByRole("heading", { name: "过程单据处理页" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "驳回" }));

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe(
        "?documentId=doc-001&action=reject",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
  });

  test("cleans invalid process document params from query string", async () => {
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
            pendingProcessDocumentCount: 1,
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

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter
        initialEntries={[
          "/projects/project-001/process-documents?documentId=missing-doc&action=approve",
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

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
  });
});
