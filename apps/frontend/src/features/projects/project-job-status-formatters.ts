import type { ImportTask } from "../../lib/types";

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

export function formatImportSource(sourceType: string) {
  if (sourceType === "audit_log") {
    return "审计日志导入";
  }
  if (sourceType === "excel_upload") {
    return "清单文件导入";
  }
  if (sourceType === "file_upload") {
    return "文件上传导入";
  }
  if (sourceType === "review_submission") {
    return "审核事件导入";
  }
  return sourceType;
}

export function formatImportStatus(status: ImportTask["status"]) {
  if (status === "queued") {
    return "排队中";
  }
  if (status === "processing") {
    return "处理中";
  }
  if (status === "completed") {
    return "已完成";
  }
  if (status === "failed") {
    return "失败";
  }
  return status;
}
