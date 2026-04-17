import { AppError } from "../../shared/errors/app-error.js";
import type { ProjectRepository } from "../project/project-repository.js";
import type {
  AuditLogRecord,
  AuditLogRepository,
} from "./audit-log-repository.js";

export class AuditLogService {
  constructor(
    private readonly auditLogRepository: AuditLogRepository,
    private readonly projectRepository: ProjectRepository,
  ) {}

  async listAuditLogs(input: {
    projectId: string;
    resourceType?: string;
    resourceId?: string;
    action?: string;
    limit?: number;
  }): Promise<AuditLogRecord[]> {
    const project = await this.projectRepository.findById(input.projectId);
    if (!project) {
      throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
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
        if (input.action && log.action !== input.action) {
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
