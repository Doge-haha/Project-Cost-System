import { z } from "zod";

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
  constructor(
    private readonly reportExportTaskRepository: ReportExportTaskRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly summaryService: SummaryService,
    private readonly auditLogService?: AuditLogService,
  ) {}

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

    const created = await this.reportExportTaskRepository.create({
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
    });

    try {
      await this.reportExportTaskRepository.update(created.id, {
        status: "processing",
      });

      const resultPreview =
        input.reportType === "summary"
          ? await this.summaryService.getSummary({
              projectId: input.projectId,
              stageCode: input.stageCode,
              disciplineCode: input.disciplineCode,
              userId: input.userId,
            })
          : await this.summaryService.getSummaryDetails({
              projectId: input.projectId,
              stageCode: input.stageCode,
              disciplineCode: input.disciplineCode,
              limit: 20,
              userId: input.userId,
            });

      const completed = await this.reportExportTaskRepository.update(created.id, {
        status: "completed",
        completedAt: new Date().toISOString(),
        resultPreview,
      });

      await this.auditLogService?.writeAuditLog({
        projectId: input.projectId,
        stageCode: input.stageCode ?? null,
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
      const failed = await this.reportExportTaskRepository.update(created.id, {
        status: "failed",
        completedAt: new Date().toISOString(),
        errorMessage:
          error instanceof Error ? error.message : "Unknown export task error",
      });
      return failed;
    }
  }

  async getReportExportTask(input: {
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

    const project = await this.projectRepository.findById(task.projectId);
    if (!project) {
      throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
    }

    await this.summaryService.getSummary({
      projectId: task.projectId,
      stageCode: task.stageCode ?? undefined,
      disciplineCode: task.disciplineCode ?? undefined,
      userId: input.userId,
    });

    return task;
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
      fileName: `${task.reportType}-${task.id}.json`,
      contentType: "application/json; charset=utf-8",
      content: JSON.stringify(task.resultPreview ?? {}, null, 2),
    };
  }
}
