import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { BillItemsPage } from "../src/features/bills/bill-items-page";

function createJsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}

describe("BillItemsPage", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  test("renders project name in breadcrumbs and header context", async () => {
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

      if (url.pathname === "/v1/projects/project-001/bill-versions/version-001/items") {
        return createJsonResponse({
          items: [
            {
              id: "bill-item-001",
              parentId: null,
              code: "A",
              name: "土建工程",
              level: 1,
              quantity: 1,
              unit: "项",
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

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001/bill-versions/version-001/items"]}>
        <Routes>
          <Route
            path="/projects/:projectId/bill-versions/:versionId/items"
            element={<BillItemsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "清单页" })).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: "新点造价项目" })).toHaveAttribute(
      "href",
      "/projects/project-001",
    );
    expect(screen.getByText("当前项目：新点造价项目（XM-001）")).toBeInTheDocument();
  });
});
