import { render, screen, waitFor, within } from "@testing-library/react";
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

describe("SummaryPage", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
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
});
