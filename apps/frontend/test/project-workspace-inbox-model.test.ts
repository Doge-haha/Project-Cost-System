import { describe, expect, test } from "vitest";

import {
  buildInboxBatchRefreshLabel,
  buildInboxFocusTitle,
  buildInboxRefreshNotice,
  formatJobType,
} from "../src/features/projects/project-workspace-inbox-model";

describe("project-workspace-inbox-model", () => {
  test("formats inbox focus titles", () => {
    expect(buildInboxFocusTitle("todo")).toBe("待办处理");
    expect(buildInboxFocusTitle("risk")).toBe("风险跟进");
    expect(buildInboxFocusTitle("import")).toBe("导入与任务状态");
  });

  test("formats job type labels", () => {
    expect(formatJobType("knowledge_extraction")).toBe("知识提取");
    expect(formatJobType("project_recalculate")).toBe("项目重算");
    expect(formatJobType("report_export")).toBe("报表导出");
    expect(formatJobType("custom_job")).toBe("custom_job");
  });

  test("builds refresh notices for reviews, process-documents, and jobs", () => {
    expect(
      buildInboxRefreshNotice({
        refreshSource: "reviews",
        refreshBatchCount: 2,
        refreshBatchSummary: "2 条已通过",
        refreshResult: null,
        refreshItemName: null,
      }),
    ).toBe("本轮已处理 2 条审核：2 条已通过，待办摘要已刷新。");

    expect(
      buildInboxRefreshNotice({
        refreshSource: "process-documents",
        refreshBatchCount: 1,
        refreshBatchSummary: null,
        refreshResult: "已驳回",
        refreshItemName: "设计变更单",
      }),
    ).toBe("设计变更单 已驳回，风险摘要已刷新。");

    expect(
      buildInboxRefreshNotice({
        refreshSource: "jobs",
        refreshBatchCount: 0,
        refreshBatchSummary: null,
        refreshResult: null,
        refreshItemName: null,
      }),
    ).toBe("任务状态已更新，导入与任务摘要已刷新。");

    expect(
      buildInboxBatchRefreshLabel({
        refreshSource: "process-documents",
        refreshBatchCount: 2,
        refreshBatchSummary: "现场签证单已通过、设计变更单已通过",
      }),
    ).toBe("本轮已处理 2 条过程单据：现场签证单已通过、设计变更单已通过");
  });
});
