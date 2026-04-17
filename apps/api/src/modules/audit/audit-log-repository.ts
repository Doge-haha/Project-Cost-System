export type AuditLogRecord = {
  id: string;
  projectId: string;
  stageCode?: string | null;
  resourceType: string;
  resourceId: string;
  action: string;
  operatorId: string;
  beforePayload?: Record<string, unknown> | null;
  afterPayload?: Record<string, unknown> | null;
  createdAt: string;
};

export interface AuditLogRepository {
  listByProjectId(projectId: string): Promise<AuditLogRecord[]>;
  create(input: Omit<AuditLogRecord, "id">): Promise<AuditLogRecord>;
}

export class InMemoryAuditLogRepository implements AuditLogRepository {
  private readonly logs: AuditLogRecord[];

  constructor(seed: AuditLogRecord[]) {
    this.logs = seed.map((log) => ({ ...log }));
  }

  async listByProjectId(projectId: string): Promise<AuditLogRecord[]> {
    return this.logs
      .filter((log) => log.projectId === projectId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async create(input: Omit<AuditLogRecord, "id">): Promise<AuditLogRecord> {
    const created: AuditLogRecord = {
      id: `audit-log-${String(this.logs.length + 1).padStart(3, "0")}`,
      ...input,
    };

    this.logs.push(created);
    return created;
  }
}
