export type ReportExportTaskStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed";

export type ReportExportTaskType = "summary" | "variance";

export type ReportExportTaskRecord = {
  id: string;
  projectId: string;
  reportType: ReportExportTaskType;
  status: ReportExportTaskStatus;
  requestedBy: string;
  stageCode?: string | null;
  disciplineCode?: string | null;
  createdAt: string;
  completedAt?: string | null;
  errorMessage?: string | null;
  resultPreview?: Record<string, unknown> | null;
};

export interface ReportExportTaskRepository {
  findById(taskId: string): Promise<ReportExportTaskRecord | null>;
  create(
    input: Omit<ReportExportTaskRecord, "id">,
  ): Promise<ReportExportTaskRecord>;
  update(
    taskId: string,
    input: Partial<Omit<ReportExportTaskRecord, "id" | "projectId" | "requestedBy">>,
  ): Promise<ReportExportTaskRecord>;
}

export class InMemoryReportExportTaskRepository
  implements ReportExportTaskRepository
{
  private readonly tasks: ReportExportTaskRecord[];

  constructor(seed: ReportExportTaskRecord[]) {
    this.tasks = seed.map((task) => ({ ...task }));
  }

  async findById(taskId: string): Promise<ReportExportTaskRecord | null> {
    return this.tasks.find((task) => task.id === taskId) ?? null;
  }

  async create(
    input: Omit<ReportExportTaskRecord, "id">,
  ): Promise<ReportExportTaskRecord> {
    const created: ReportExportTaskRecord = {
      id: `report-export-task-${String(this.tasks.length + 1).padStart(3, "0")}`,
      ...input,
    };
    this.tasks.push(created);
    return created;
  }

  async update(
    taskId: string,
    input: Partial<Omit<ReportExportTaskRecord, "id" | "projectId" | "requestedBy">>,
  ): Promise<ReportExportTaskRecord> {
    const target = this.tasks.find((task) => task.id === taskId);
    if (!target) {
      throw new Error("Report export task not found");
    }

    Object.assign(target, input);
    return target;
  }
}
