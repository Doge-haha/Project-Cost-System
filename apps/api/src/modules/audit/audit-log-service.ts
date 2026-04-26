import { AppError } from "../../shared/errors/app-error.js";
import { ProjectAuthorizationService } from "../project/project-authorization-service.js";
import type { ProjectDisciplineRepository } from "../project/project-discipline-repository.js";
import type { ProjectMemberRepository } from "../project/project-member-repository.js";
import type { ProjectRepository } from "../project/project-repository.js";
import type { ProjectStageRepository } from "../project/project-stage-repository.js";
import type {
  AuditLogRecord,
  AuditLogRepository,
} from "./audit-log-repository.js";

export class AuditLogService {
  constructor(
    private readonly auditLogRepository: AuditLogRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly projectStageRepository: ProjectStageRepository,
    private readonly projectDisciplineRepository: ProjectDisciplineRepository,
    private readonly projectMemberRepository: ProjectMemberRepository,
  ) {}

  async listAuditLogs(input: {
    projectId: string;
    resourceType?: string;
    resourceId?: string;
    resourceIdPrefix?: string;
    action?: string;
    operatorId?: string;
    createdFrom?: string;
    createdTo?: string;
    limit?: number;
    userId: string;
  }): Promise<AuditLogRecord[]> {
    const project = await this.projectRepository.findById(input.projectId);
    if (!project) {
      throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
    }

    const authorizationService = new ProjectAuthorizationService({
      stages: await this.projectStageRepository.listByProjectId(input.projectId),
      disciplines: await this.projectDisciplineRepository.listByProjectId(
        input.projectId,
      ),
      members: await this.projectMemberRepository.listByProjectId(input.projectId),
    });
    if (
      !authorizationService.canViewContext({
        projectId: input.projectId,
        userId: input.userId,
      })
    ) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have permission to access this resource",
      );
    }

    const logs = await this.auditLogRepository.listByProjectId(input.projectId);
    return logs
      .filter((log) => {
        if (input.resourceType && log.resourceType !== input.resourceType) {
          return false;
        }
        if (input.resourceId && log.resourceId !== input.resourceId) {
          return false;
        }
        if (
          input.resourceIdPrefix &&
          !log.resourceId.startsWith(input.resourceIdPrefix)
        ) {
          return false;
        }
        if (input.action && log.action !== input.action) {
          return false;
        }
        if (input.operatorId && log.operatorId !== input.operatorId) {
          return false;
        }
        if (input.createdFrom && log.createdAt < input.createdFrom) {
          return false;
        }
        if (input.createdTo && log.createdAt > input.createdTo) {
          return false;
        }
        return true;
      })
      .slice(0, input.limit ?? 50);
  }

  async writeAuditLog(
    input: Omit<AuditLogRecord, "id" | "createdAt"> & {
      createdAt?: string;
    },
  ): Promise<AuditLogRecord> {
    return this.auditLogRepository.create({
      ...input,
      createdAt: input.createdAt ?? new Date().toISOString(),
    });
  }
}
