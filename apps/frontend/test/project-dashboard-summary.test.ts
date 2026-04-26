import { describe, expect, test } from "vitest";

import {
  buildProjectDashboardSummary,
  formatProjectStatus,
  formatVarianceTone,
} from "../src/features/projects/project-dashboard-summary";
import type {
  BillVersion,
  ProjectListItem,
  ProjectStage,
  SummaryResponse,
} from "../src/lib/types";

const project: ProjectListItem = {
  id: "project-001",
  code: "PRJ-001",
  name: "新点造价项目",
  status: "draft",
};

const billVersion: BillVersion = {
  id: "version-001",
  versionName: "估算版 V1",
  stageCode: "estimate",
  disciplineCode: "building",
  status: "editable",
  itemCount: 12,
};

const summary: SummaryResponse = {
  totalSystemAmount: 1200,
  totalFinalAmount: 1350,
  varianceAmount: 150,
  itemCount: 12,
  billVersionCount: 3,
};
const currentStage: ProjectStage = {
  id: "stage-001",
  stageCode: "estimate",
  stageName: "投资估算",
  status: "active",
  sequenceNo: 1,
};

describe("project dashboard summary", () => {
  test("formats project status to user-facing text", () => {
    expect(formatProjectStatus("draft")).toBe("草稿");
    expect(formatProjectStatus("active")).toBe("active");
  });

  test("formats variance tone based on amount sign", () => {
    expect(formatVarianceTone(150)).toBe("上涨");
    expect(formatVarianceTone(-20)).toBe("下降");
    expect(formatVarianceTone(0)).toBe("持平");
  });

  test("buildProjectDashboardSummary returns highlight cards for selected version", () => {
    expect(
      buildProjectDashboardSummary({
        project,
        selectedBillVersion: billVersion,
        summary,
        currentStage,
        permissionSummary: {
          roleLabel: "项目负责人",
          canEditProject: true,
        },
      }),
    ).toEqual([
      {
        label: "项目状态",
        value: "草稿",
        helper: "当前阶段：投资估算 · estimate",
      },
      {
        label: "系统值",
        value: "1,200.00",
        helper: "当前版本：估算版 V1",
      },
      {
        label: "最终值",
        value: "1,350.00",
        helper: "12 条清单项",
      },
      {
        label: "偏差趋势",
        value: "上涨 150.00",
        helper: "项目负责人 · 可编辑 · 共 3 个版本",
      },
    ]);
  });
});
