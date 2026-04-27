import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, test, expect, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";

import { appRoutes } from "../src/app/router";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

test("renders the frontend workbench shell", async () => {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    }),
  );

  const router = createMemoryRouter(appRoutes, {
    initialEntries: ["/projects"],
  });

  render(<RouterProvider router={router} />);

  expect(
    screen.getByRole("heading", { name: "新点 SaaS 计价工作台" }),
  ).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByRole("heading", { name: "还没有项目数据" })).toBeInTheDocument();
  });
});
