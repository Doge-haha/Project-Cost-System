import { z } from "zod";

import { requireDependency } from "../../shared/dependency/require-dependency.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { AuditLogService } from "../audit/audit-log-service.js";
import type { ProjectRepository } from "../project/project-repository.js";
import { SummaryService } from "./summary-service.js";
import type {
  ReportExportTaskRecord,
  ReportExportTaskRepository,
} from "./report-export-task-repository.js";

export const createReportExportTaskSchema = z.object({
  projectId: z.string().min(1),
  reportType: z.enum(["summary", "variance"]),
  stageCode: z.string().min(1).optional(),
  disciplineCode: z.string().min(1).optional(),
});

export class ReportExportTaskService {
  private readonly auditLogService: AuditLogService;

  constructor(
    private readonly reportExportTaskRepository: ReportExportTaskRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly summaryService: SummaryService,
    auditLogService?: AuditLogService,
  ) {
    this.auditLogService = requireDependency(
      auditLogService,
      "auditLogService",
    );
  }

  async createReportExportTask(input: {
    projectId: string;
    reportType: "summary" | "variance";
    stageCode?: string;
    disciplineCode?: string;
    userId: string;
  }): Promise<ReportExportTaskRecord> {
    const project = await this.projectRepository.findById(input.projectId);
    if (!project) {
      throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
    }

    return this.reportExportTaskRepository.create({
      projectId: input.projectId,
      reportType: input.reportType,
      status: "queued",
      requestedBy: input.userId,
      stageCode: input.stageCode ?? null,
      disciplineCode: input.disciplineCode ?? null,
      createdAt: new Date().toISOString(),
      completedAt: null,
      errorMessage: null,
      resultPreview: null,
      downloadFileName: null,
      downloadContentType: null,
      downloadContentLength: null,
    });

  }

  async processReportExportTask(input: {
    taskId: string;
    userId: string;
  }): Promise<ReportExportTaskRecord> {
    const task = await this.reportExportTaskRepository.findById(input.taskId);
    if (!task) {
      throw new AppError(
        404,
        "REPORT_EXPORT_TASK_NOT_FOUND",
        "Report export task not found",
      );
    }

    await this.reportExportTaskRepository.update(task.id, {
      status: "processing",
      errorMessage: null,
    });

    try {
      const resultPreview =
        task.reportType === "summary"
          ? await this.summaryService.getSummary({
              projectId: task.projectId,
              stageCode: task.stageCode ?? undefined,
              disciplineCode: task.disciplineCode ?? undefined,
              userId: input.userId,
            })
          : await this.summaryService.getSummaryDetails({
              projectId: task.projectId,
              stageCode: task.stageCode ?? undefined,
              disciplineCode: task.disciplineCode ?? undefined,
              limit: 20,
              userId: input.userId,
            });
      const downloadFileName = `${task.reportType}-${task.id}.json`;
      const downloadContentType = "application/json; charset=utf-8";
      const downloadContentLength = Buffer.byteLength(
        JSON.stringify(resultPreview, null, 2),
        "utf8",
      );

      const completed = await this.reportExportTaskRepository.update(task.id, {
        status: "completed",
        completedAt: new Date().toISOString(),
        resultPreview,
        downloadFileName,
        downloadContentType,
        downloadContentLength,
      });

      await this.auditLogService.writeAuditLog({
        projectId: completed.projectId,
        stageCode: completed.stageCode ?? null,
        resourceType: "report_export_task",
        resourceId: completed.id,
        action: "export",
        operatorId: input.userId,
        afterPayload: {
          reportType: completed.reportType,
          status: completed.status,
        },
      });

      return completed;
    } catch (error) {
      const failed = await this.reportExportTaskRepository.update(task.id, {
        status: "failed",
        completedAt: new Date().toISOString(),
        errorMessage:
          error instanceof Error ? error.message : "Unknown export task error",
        downloadFileName: null,
        downloadContentType: null,
        downloadContentLength: null,
      });
      await this.auditLogService.writeAuditLog({
        projectId: failed.projectId,
        stageCode: failed.stageCode ?? null,
        resourceType: "report_export_task",
        resourceId: failed.id,
        action: "failed",
        operatorId: input.userId,
        afterPayload: {
          reportType: failed.reportType,
          status: failed.status,
          errorMessage: failed.errorMessage ?? null,
        },
      });
      throw error instanceof Error
        ? error
        : new AppError(
            500,
            "REPORT_EXPORT_FAILED",
            "Unknown export task error",
          );
    }
  }

  async getReportExportTask(input: {
    taskId: string;
    userId: string;
  }): Promise<
    ReportExportTaskRecord & {
      isDownloadReady: boolean;
      isTerminal: boolean;
      hasFailed: boolean;
      failureMessage: string | null;
    }
  > {
    const task = await this.reportExportTaskRepository.findById(input.taskId);
    if (!task) {
      throw new AppError(
        404,
        "REPORT_EXPORT_TASK_NOT_FOUND",
        "Report export task not found",
      );
    }

    const project = await this.projectRepository.findById(task.projectId);
    if (!project) {
      throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
    }

    return {
      ...task,
      isDownloadReady: task.status === "completed",
      isTerminal: task.status === "completed" || task.status === "failed",
      hasFailed: task.status === "failed",
      failureMessage: task.errorMessage ?? null,
    };
  }

  async downloadReportExportTask(input: {
    taskId: string;
    userId: string;
  }): Promise<{
    fileName: string;
    contentType: string;
    content: string;
  }> {
    const task = await this.getReportExportTask(input);
    if (task.status !== "completed") {
      throw new AppError(
        409,
        "EXPORT_NOT_READY",
        "Report export task is not completed yet",
      );
    }

    return {
      fileName: task.downloadFileName ?? `${task.reportType}-${task.id}.json`,
      contentType:
        task.downloadContentType ?? "application/json; charset=utf-8",
      content: JSON.stringify(task.resultPreview ?? {}, null, 2),
    };
  }
}
