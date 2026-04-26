import { render, screen } from "@testing-library/react";
import { test, expect } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";

import { appRoutes } from "../src/app/router";

test("renders the frontend workbench shell", () => {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: ["/projects"],
  });

  render(<RouterProvider router={router} />);

  expect(
    screen.getByRole("heading", { name: "新点 SaaS 计价工作台" }),
  ).toBeInTheDocument();
});
