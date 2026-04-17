export type BillVersionRecord = {
  id: string;
  projectId: string;
  stageCode: string;
  disciplineCode: string;
  versionNo: number;
  versionName: string;
  versionStatus: "editable" | "submitted" | "locked";
  sourceVersionId: string | null;
};

export interface BillVersionRepository {
  listByProjectId(projectId: string): Promise<BillVersionRecord[]>;
  listByContext(input: {
    projectId: string;
    stageCode: string;
    disciplineCode: string;
  }): Promise<BillVersionRecord[]>;
  findById(versionId: string): Promise<BillVersionRecord | null>;
  create(input: {
    projectId: string;
    stageCode: string;
    disciplineCode: string;
    versionName: string;
    sourceVersionId?: string | null;
  }): Promise<BillVersionRecord>;
  updateStatus(input: {
    versionId: string;
    versionStatus: BillVersionRecord["versionStatus"];
  }): Promise<BillVersionRecord>;
}

export class InMemoryBillVersionRepository implements BillVersionRepository {
  private readonly versions: BillVersionRecord[];

  constructor(seed: BillVersionRecord[]) {
    this.versions = seed.map((version) => ({ ...version }));
  }

  async listByProjectId(projectId: string): Promise<BillVersionRecord[]> {
    return this.versions.filter((version) => version.projectId === projectId);
  }

  async listByContext(input: {
    projectId: string;
    stageCode: string;
    disciplineCode: string;
  }): Promise<BillVersionRecord[]> {
    return this.versions.filter(
      (version) =>
        version.projectId === input.projectId &&
        version.stageCode === input.stageCode &&
        version.disciplineCode === input.disciplineCode,
    );
  }

  async findById(versionId: string): Promise<BillVersionRecord | null> {
    return this.versions.find((version) => version.id === versionId) ?? null;
  }

  async create(input: {
    projectId: string;
    stageCode: string;
    disciplineCode: string;
    versionName: string;
    sourceVersionId?: string | null;
  }): Promise<BillVersionRecord> {
    const currentVersions = this.versions.filter(
      (version) =>
        version.projectId === input.projectId &&
        version.stageCode === input.stageCode &&
        version.disciplineCode === input.disciplineCode,
    );

    const nextVersionNo =
      currentVersions.reduce(
        (maxVersionNo, current) => Math.max(maxVersionNo, current.versionNo),
        0,
      ) + 1;

    const created: BillVersionRecord = {
      id: `bill-version-${String(this.versions.length + 1).padStart(3, "0")}`,
      projectId: input.projectId,
      stageCode: input.stageCode,
      disciplineCode: input.disciplineCode,
      versionNo: nextVersionNo,
      versionName: input.versionName,
      versionStatus: "editable",
      sourceVersionId: input.sourceVersionId ?? null,
    };

    this.versions.push(created);
    return created;
  }

  async updateStatus(input: {
    versionId: string;
    versionStatus: BillVersionRecord["versionStatus"];
  }): Promise<BillVersionRecord> {
    const target = this.versions.find((version) => version.id === input.versionId);
    if (!target) {
      throw new Error("Bill version not found");
    }

    target.versionStatus = input.versionStatus;
    return target;
  }
}
