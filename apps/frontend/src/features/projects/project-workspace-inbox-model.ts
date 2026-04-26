export function formatJobType(jobType: string) {
  if (jobType === "knowledge_extraction") {
    return "知识提取";
  }
  if (jobType === "project_recalculate") {
    return "项目重算";
  }
  if (jobType === "report_export") {
    return "报表导出";
  }
  return jobType;
}

export function buildInboxFocusTitle(focus: string) {
  if (focus === "risk") {
    return "风险跟进";
  }
  if (focus === "import") {
    return "导入与任务状态";
  }
  return "待办处理";
}

export function buildInboxRefreshNotice(input: {
  refreshSource: string | null;
  refreshBatchCount: number;
  refreshBatchSummary: string | null;
  refreshResult: string | null;
  refreshItemName: string | null;
}) {
  if (input.refreshSource === "reviews") {
    if (input.refreshBatchCount > 1 && input.refreshBatchSummary) {
      return `本轮已处理 ${input.refreshBatchCount} 条审核：${input.refreshBatchSummary}，待办摘要已刷新。`;
    }
    if (input.refreshResult && input.refreshItemName) {
      return `${input.refreshItemName} ${input.refreshResult}，待办摘要已刷新。`;
    }
    return "审核处理已完成，待办摘要已刷新。";
  }

  if (input.refreshSource === "process-documents") {
    if (input.refreshBatchCount > 1 && input.refreshBatchSummary) {
      return `本轮已处理 ${input.refreshBatchCount} 条过程单据：${input.refreshBatchSummary}，风险摘要已刷新。`;
    }
    if (input.refreshResult && input.refreshItemName) {
      return `${input.refreshItemName} ${input.refreshResult}，风险摘要已刷新。`;
    }
    return "过程单据处理已完成，风险摘要已刷新。";
  }

  if (input.refreshSource === "jobs") {
    return "任务状态已更新，导入与任务摘要已刷新。";
  }

  return null;
}

export function buildInboxBatchRefreshLabel(input: {
  refreshSource: string | null;
  refreshBatchCount: number;
  refreshBatchSummary: string | null;
}) {
  if (input.refreshBatchCount <= 1 || !input.refreshBatchSummary) {
    return null;
  }

  if (input.refreshSource === "reviews") {
    return `本轮已处理 ${input.refreshBatchCount} 条审核：${input.refreshBatchSummary}`;
  }

  if (input.refreshSource === "process-documents") {
    return `本轮已处理 ${input.refreshBatchCount} 条过程单据：${input.refreshBatchSummary}`;
  }

  return null;
}
