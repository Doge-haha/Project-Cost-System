import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test } from "vitest";

import {
  AppBreadcrumbs,
  buildProjectVersionBreadcrumbs,
} from "../src/features/shared/breadcrumbs";

describe("breadcrumbs", () => {
  test("buildProjectVersionBreadcrumbs returns project-detail and current-page trail", () => {
    expect(
      buildProjectVersionBreadcrumbs({
        currentLabel: "汇总页",
        projectId: "project-001",
        projectName: "新点造价项目",
        versionLabel: "估算版 V1",
      }),
    ).toEqual([
      {
        label: "项目工作台",
        to: "/projects",
      },
      {
        label: "新点造价项目",
        to: "/projects/project-001",
      },
      {
        label: "估算版 V1",
        to: null,
      },
      {
        label: "汇总页",
        to: null,
      },
    ]);
  });

  test("AppBreadcrumbs renders links and current labels", () => {
    render(
      <MemoryRouter>
        <AppBreadcrumbs
          items={[
            { label: "项目工作台", to: "/projects" },
            { label: "项目 A", to: "/projects/project-a" },
            { label: "清单页", to: null },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "项目工作台" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "项目 A" })).toBeInTheDocument();
    expect(screen.getByText("清单页")).toBeInTheDocument();
  });
});
