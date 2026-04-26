import { describe, expect, test } from "vitest";

import {
  buildProjectsDashboard,
  formatProjectLifecycle,
} from "../src/features/projects/projects-dashboard";
import type { ProjectListItem } from "../src/lib/types";

const projects: ProjectListItem[] = [
  {
    id: "project-001",
    code: "PRJ-001",
    name: "新点造价项目 A",
    status: "draft",
    defaultPriceVersionId: "price-version-001",
  },
  {
    id: "project-002",
    code: "PRJ-002",
    name: "新点造价项目 B",
    status: "active",
    defaultFeeTemplateId: "fee-template-001",
  },
  {
    id: "project-003",
    code: "PRJ-003",
    name: "新点造价项目 C",
    status: "draft",
  },
];

describe("projects dashboard", () => {
  test("formatProjectLifecycle maps known statuses", () => {
    expect(formatProjectLifecycle("draft")).toBe("草稿");
    expect(formatProjectLifecycle("active")).toBe("进行中");
    expect(formatProjectLifecycle("archived")).toBe("已归档");
    expect(formatProjectLifecycle("paused")).toBe("paused");
  });

  test("buildProjectsDashboard returns summary metrics and featured projects", () => {
    expect(buildProjectsDashboard(projects)).toEqual({
      metrics: [
        {
          label: "项目数量",
          value: "3",
          helper: "当前工作区内可见项目",
        },
        {
          label: "草稿项目",
          value: "2",
          helper: "仍在整理计价主链",
        },
        {
          label: "已配置默认计价",
          value: "2",
          helper: "已绑定默认价目或取费模板",
        },
        {
          label: "进行中项目",
          value: "1",
          helper: "更适合优先进入联调",
        },
      ],
      featuredProjects: [
        {
          id: "project-001",
          title: "新点造价项目 A",
          subtitle: "PRJ-001 · 草稿",
          readinessLabel: "已配置默认计价",
        },
        {
          id: "project-002",
          title: "新点造价项目 B",
          subtitle: "PRJ-002 · 进行中",
          readinessLabel: "已配置默认计价",
        },
        {
          id: "project-003",
          title: "新点造价项目 C",
          subtitle: "PRJ-003 · 草稿",
          readinessLabel: "待配置默认计价",
        },
      ],
    });
  });
});
