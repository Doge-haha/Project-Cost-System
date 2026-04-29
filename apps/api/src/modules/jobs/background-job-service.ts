import { requireDependency } from "../../shared/dependency/require-dependency.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { AuditLogService } from "../audit/audit-log-service.js";
import type { ImportTaskService } from "../import/import-task-service.js";
import { ProjectAuthorizationService } from "../project/project-authorization-service.js";
import type { ProjectDisciplineRepository } from "../project/project-discipline-repository.js";
import type { ProjectMemberRepository } from "../project/project-member-repository.js";
import type { ProjectRepository } from "../project/project-repository.js";
import type { ProjectStageRepository } from "../project/project-stage-repository.js";
import type { BackgroundJobSink } from "./background-job-sink.js";
import type {
  BackgroundJobPayload,
  BackgroundJobRecord,
  BackgroundJobRepository,
  BackgroundJobType,
} from "./background-job-repository.js";

export class BackgroundJobService {
  private readonly auditLogService: AuditLogService;

  constructor(
    private readonly backgroundJobRepository: BackgroundJobRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly projectStageRepository: ProjectStageRepository,
    private readonly projectDisciplineRepository: ProjectDisciplineRepository,
    private readonly projectMemberRepository: ProjectMemberRepository,
    auditLogService?: AuditLogService,
    private readonly backgroundJobSink?: BackgroundJobSink,
    private readonly importTaskService?: ImportTaskService,
  ) {
    this.auditLogService = requireDependency(
      auditLogService,
      "auditLogService",
    );
  }

  async listBackgroundJobs(input: {
    projectId?: string;
    requestedBy?: string;
    jobType?: BackgroundJobType;
    status?: BackgroundJobRecord["status"];
    createdFrom?: string;
    createdTo?: string;
    completedFrom?: string;
    completedTo?: string;
    limit?: number;
    userId: string;
  }): Promise<BackgroundJobRecord[]> {
    if (input.projectId) {
      const project = await this.projectRepository.findById(input.projectId);
      if (!project) {
        throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
      }
      await this.assertProjectVisible(input.projectId, input.userId);
    }

    return this.backgroundJobRepository.list({
      projectId: input.projectId,
      requestedBy: input.requestedBy,
      jobType: input.jobType,
      status: input.status,
      createdFrom: input.createdFrom,
      createdTo: input.createdTo,
      completedFrom: input.completedFrom,
      completedTo: input.completedTo,
      limit: input.limit,
    });
  }

  async getBackgroundJob(input: {
    jobId: string;
    userId: string;
  }): Promise<BackgroundJobRecord> {
    const job = await this.backgroundJobRepository.findById(input.jobId);
    if (!job) {
      throw new AppError(
        404,
        "BACKGROUND_JOB_NOT_FOUND",
        "Background job not found",
      );
    }

    if (job.projectId) {
      const project = await this.projectRepository.findById(job.projectId);
      if (!project) {
        throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
      }
      await this.assertProjectVisible(job.projectId, input.userId);
    }

    return job;
  }

  async claimNextQueuedJob(): Promise<BackgroundJobRecord | null> {
    const queuedJobs = await this.backgroundJobRepository.list({
      status: "queued",
    });
    const nextJob = queuedJobs
      .slice()
      .sort((left, right) => {
        const createdAtDifference = left.createdAt.localeCompare(right.createdAt);
        if (createdAtDifference !== 0) {
          return createdAtDifference;
        }
        return left.id.localeCompare(right.id);
      })[0];

    if (!nextJob) {
      return null;
    }

    return this.startJob(nextJob.id);
  }

  async enqueueJob<TJobType extends BackgroundJobType>(input: {
    jobType: TJobType;
    requestedBy: string;
    roleCodes?: string[];
    projectId?: string;
    payload: BackgroundJobPayload;
  }): Promise<BackgroundJobRecord> {
    if (input.projectId) {
      const project = await this.projectRepository.findById(input.projectId);
      if (!project) {
        throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
      }
      if (!(input.roleCodes ?? []).includes("system_admin")) {
        await this.assertProjectVisible(input.projectId, input.requestedBy);
      }
    }

    const created = await this.backgroundJobRepository.create({
      jobType: input.jobType,
      status: "queued",
      requestedBy: input.requestedBy,
      projectId: input.projectId ?? null,
      payload: input.payload,
      result: null,
      errorMessage: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    });

    await this.backgroundJobSink?.enqueue(created);

    await this.auditLogService.writeAuditLog({
      projectId: input.projectId ?? "global",
      resourceType: "background_job",
      resourceId: created.id,
      action: "queued",
      operatorId: input.requestedBy,
      afterPayload: {
        jobType: created.jobType,
        status: created.status,
      },
    });

    return created;
  }

  async runJob<
    TJobType extends BackgroundJobType,
    Result extends Record<string, unknown>,
  >(input: {
    jobType: TJobType;
    requestedBy: string;
    roleCodes?: string[];
    projectId?: string;
    payload: BackgroundJobPayload;
    processor: () => Promise<Result>;
  }): Promise<{ job: BackgroundJobRecord<TJobType, Result>; result: Result }> {
    const created = await this.enqueueJob({
      jobType: input.jobType,
      requestedBy: input.requestedBy,
      roleCodes: input.roleCodes,
      projectId: input.projectId,
      payload: input.payload,
    }) as unknown as BackgroundJobRecord<TJobType, Result>;

    try {
      await this.backgroundJobRepository.update(created.id, {
        status: "processing",
      });

      const result = await input.processor();
      const completed = await this.backgroundJobRepository.update(created.id, {
        status: "completed",
        result,
        completedAt: new Date().toISOString(),
      }) as BackgroundJobRecord<TJobType, Result>;

      await this.auditLogService.writeAuditLog({
        projectId: input.projectId ?? "global",
        resourceType: "background_job",
        resourceId: completed.id,
        action: "completed",
        operatorId: input.requestedBy,
        afterPayload: {
          jobType: completed.jobType,
          status: completed.status,
        },
      });

      return { job: completed, result };
    } catch (error) {
      const failed = await this.backgroundJobRepository.update(created.id, {
        status: "failed",
        errorMessage:
          error instanceof Error ? error.message : "Unknown background job error",
        completedAt: new Date().toISOString(),
      });
      await this.auditLogService.writeAuditLog({
        projectId: input.projectId ?? "global",
        resourceType: "background_job",
        resourceId: failed.id,
        action: "failed",
        operatorId: input.requestedBy,
        afterPayload: {
          jobType: failed.jobType,
          status: failed.status,
          errorMessage: failed.errorMessage ?? null,
        },
      });
      throw new AppError(
        500,
        "BACKGROUND_JOB_FAILED",
        "Background job failed",
        failed,
      );
    }
  }

  async startJob(jobId: string): Promise<BackgroundJobRecord> {
    const job = await this.backgroundJobRepository.findById(jobId);
    if (!job) {
      throw new AppError(
        404,
        "BACKGROUND_JOB_NOT_FOUND",
        "Background job not found",
      );
    }
    if (job.status !== "queued") {
      throw new AppError(
        409,
        "BACKGROUND_JOB_NOT_QUEUEABLE",
        "Background job is not queued",
      );
    }

    const started = await this.backgroundJobRepository.update(jobId, {
      status: "processing",
    });

    const importTaskId = this.readImportTaskId(started);
    if (started.jobType === "knowledge_extraction" && importTaskId) {
      await this.importTaskService?.markImportTaskProcessing({
        taskId: importTaskId,
        jobId: started.id,
      });
    }

    return started;
  }

  async completeJob<Result extends Record<string, unknown>>(input: {
    jobId: string;
    result: Result;
  }): Promise<BackgroundJobRecord> {
    await this.assertJobProcessing(input.jobId);

    const completed = await this.backgroundJobRepository.update(input.jobId, {
      status: "completed",
      result: input.result,
      errorMessage: null,
      completedAt: new Date().toISOString(),
    });

    const importTaskId = this.readImportTaskId(completed);
    if (completed.jobType === "knowledge_extraction" && importTaskId) {
      const counts = this.readImportResultCounts(completed.result ?? null);
      await this.importTaskService?.completeImportTask({
        taskId: importTaskId,
        jobId: completed.id,
        importedItemCount: counts.importedItemCount,
        memoryItemCount: counts.memoryItemCount,
      });
    }

    await this.auditLogService.writeAuditLog({
      projectId: completed.projectId ?? "global",
      resourceType: "background_job",
      resourceId: completed.id,
      action: "completed",
      operatorId: completed.requestedBy,
      afterPayload: {
        jobType: completed.jobType,
        status: completed.status,
      },
    });

    return completed;
  }

  async failJob(input: {
    jobId: string;
    errorMessage: string;
  }): Promise<BackgroundJobRecord> {
    await this.assertJobProcessing(input.jobId);

    const failed = await this.backgroundJobRepository.update(input.jobId, {
      status: "failed",
      errorMessage: input.errorMessage,
      completedAt: new Date().toISOString(),
    });

    const importTaskId = this.readImportTaskId(failed);
    if (failed.jobType === "knowledge_extraction" && importTaskId) {
      await this.importTaskService?.failImportTask({
        taskId: importTaskId,
        jobId: failed.id,
        errorMessage: input.errorMessage,
      });
    }

    await this.auditLogService.writeAuditLog({
      projectId: failed.projectId ?? "global",
      resourceType: "background_job",
      resourceId: failed.id,
      action: "failed",
      operatorId: failed.requestedBy,
      afterPayload: {
        jobType: failed.jobType,
        status: failed.status,
        errorMessage: failed.errorMessage ?? null,
      },
    });

    return failed;
  }

  async retryJob(input: {
    jobId: string;
    userId: string;
    roleCodes: string[];
    failureReason?: string;
    failureResourceType?: string;
    failureAction?: string;
  }): Promise<BackgroundJobRecord> {
    const job = await this.backgroundJobRepository.findById(input.jobId);
    if (!job) {
      throw new AppError(
        404,
        "BACKGROUND_JOB_NOT_FOUND",
        "Background job not found",
      );
    }

    if (job.status !== "failed") {
      throw new AppError(
        409,
        "BACKGROUND_JOB_NOT_RETRYABLE",
        "Only failed background jobs can be retried",
      );
    }

    if (!job.projectId) {
      throw new AppError(
        422,
        "BACKGROUND_JOB_NOT_PROJECT_SCOPED",
        "Only project-scoped background jobs can be retried here",
      );
    }

    const project = await this.projectRepository.findById(job.projectId);
    if (!project) {
      throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
    }

    const stages = await this.projectStageRepository.listByProjectId(job.projectId);
    const disciplines = await this.projectDisciplineRepository.listByProjectId(
      job.projectId,
    );
    const members = await this.projectMemberRepository.listByProjectId(job.projectId);
    const authorizationService = new ProjectAuthorizationService({
      stages,
      disciplines,
      members,
    });

    const canRetry =
      input.roleCodes.includes("system_admin") ||
      authorizationService.canManageProject({
        projectId: job.projectId,
        userId: input.userId,
      });

    if (!canRetry) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have permission to retry this background job",
      );
    }

    const retryContext = {
      failureReason: input.failureReason ?? null,
      failureResourceType: input.failureResourceType ?? null,
      failureAction: input.failureAction ?? null,
    };
    const hasRetryContext = Object.values(retryContext).some(
      (value) => value !== null,
    );
    const importTaskId = this.readImportTaskId(job);
    const isKnowledgeExtractionImportRetry =
      job.jobType === "knowledge_extraction" && importTaskId;
    if (isKnowledgeExtractionImportRetry) {
      await requireDependency(
        this.importTaskService,
        "importTaskService",
      ).assertImportTaskRetryable(importTaskId);
    }
    const {
      retryContext: _previousRetryContext,
      retryEvents: _previousRetryEvents,
      ...basePayload
    } = job.payload as Record<string, unknown>;
    const nextPayload: Record<string, unknown> = {
      ...basePayload,
      retryContext,
    };

    if (isKnowledgeExtractionImportRetry && hasRetryContext) {
      const importTaskService = requireDependency(
        this.importTaskService,
        "importTaskService",
      );
      nextPayload.retryEvents = await importTaskService.buildRetryEventsFromSnapshots({
        taskId: importTaskId,
        retryContext: {
          failureReason: retryContext.failureReason ?? undefined,
          failureResourceType: retryContext.failureResourceType ?? undefined,
          failureAction: retryContext.failureAction ?? undefined,
        },
      });
    }

    const retried = await this.backgroundJobRepository.update(job.id, {
      status: "queued",
      payload: nextPayload as BackgroundJobPayload,
      result: null,
      errorMessage: null,
      completedAt: null,
    });

    const retriedImportTaskId = this.readImportTaskId(retried);
    if (retried.jobType === "knowledge_extraction" && retriedImportTaskId) {
      await this.importTaskService?.retryImportTask({
        taskId: retriedImportTaskId,
        operatorId: input.userId,
        retryContext: {
          failureReason: retryContext.failureReason ?? undefined,
          failureResourceType: retryContext.failureResourceType ?? undefined,
          failureAction: retryContext.failureAction ?? undefined,
        },
      });
    }

    await this.backgroundJobSink?.enqueue(retried);

    await this.auditLogService.writeAuditLog({
      projectId: retried.projectId ?? "global",
      resourceType: "background_job",
      resourceId: retried.id,
      action: "retried",
      operatorId: input.userId,
      beforePayload: {
        status: job.status,
        errorMessage: job.errorMessage ?? null,
      },
      afterPayload: {
        jobType: retried.jobType,
        status: retried.status,
        retryContext,
      },
    });

    return retried;
  }

  private async assertProjectVisible(
    projectId: string,
    userId: string,
  ): Promise<void> {
    const authorizationService = new ProjectAuthorizationService({
      stages: await this.projectStageRepository.listByProjectId(projectId),
      disciplines: await this.projectDisciplineRepository.listByProjectId(
        projectId,
      ),
      members: await this.projectMemberRepository.listByProjectId(projectId),
    });
    if (
      !authorizationService.canViewContext({
        projectId,
        userId,
      })
    ) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have permission to access this resource",
      );
    }
  }

  private readImportTaskId(job: BackgroundJobRecord): string | null {
    if (job.jobType !== "knowledge_extraction") {
      return null;
    }

    const importTaskId = (job.payload as Record<string, unknown>).importTaskId;
    return typeof importTaskId === "string" && importTaskId.length > 0
      ? importTaskId
      : null;
  }

  private readImportResultCounts(result: Record<string, unknown> | null) {
    const persisted =
      result && typeof result.persisted === "object" && result.persisted
        ? (result.persisted as Record<string, unknown>)
        : null;

    const importedItemCount = this.readCount(
      persisted?.knowledgeEntryCount ?? result?.knowledgeCount,
    );
    const memoryItemCount = this.readCount(
      persisted?.memoryEntryCount ?? result?.memoryCount,
    );

    return {
      importedItemCount,
      memoryItemCount,
    };
  }

  private readCount(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  }

  private async assertJobProcessing(jobId: string): Promise<void> {
    const job = await this.backgroundJobRepository.findById(jobId);
    if (!job) {
      throw new AppError(
        404,
        "BACKGROUND_JOB_NOT_FOUND",
        "Background job not found",
      );
    }

    if (job.status !== "processing") {
      throw new AppError(
        409,
        "BACKGROUND_JOB_NOT_PROCESSING",
        "Background job is not processing",
      );
    }
  }
}
