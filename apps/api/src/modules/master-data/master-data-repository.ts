import type { ApiDatabase } from "../../infrastructure/database/database-client.js";

export type MasterDataStatus = "active" | "inactive";

export type DisciplineTypeRecord = {
  id: string;
  disciplineCode: string;
  disciplineName: string;
  disciplineGroup: string | null;
  businessViewType: string | null;
  regionCode: string | null;
  sourceMarkup: string | null;
  gb08Code: string | null;
  gb13Code: string | null;
  sourceSystem: string | null;
  status: MasterDataStatus;
};

export type StandardSetRecord = {
  id: string;
  standardSetCode: string;
  standardSetName: string;
  disciplineCode: string;
  regionCode: string | null;
  versionYear: number | null;
  standardType: string | null;
  sourceFieldCode: string | null;
  sourceMarkup: string | null;
  sourceSystem: string | null;
  status: MasterDataStatus;
};

export interface MasterDataRepository {
  listDisciplineTypes(input: {
    regionCode?: string;
    status?: MasterDataStatus;
  }): Promise<DisciplineTypeRecord[]>;
  listStandardSets(input: {
    disciplineCode?: string;
    regionCode?: string;
    status?: MasterDataStatus;
  }): Promise<StandardSetRecord[]>;
}

export class InMemoryMasterDataRepository implements MasterDataRepository {
  private readonly disciplineTypes: DisciplineTypeRecord[];
  private readonly standardSets: StandardSetRecord[];

  constructor(seed: {
    disciplineTypes?: DisciplineTypeRecord[];
    standardSets?: StandardSetRecord[];
  }) {
    this.disciplineTypes = (seed.disciplineTypes ?? []).map((record) => ({
      ...record,
    }));
    this.standardSets = (seed.standardSets ?? []).map((record) => ({ ...record }));
  }

  async listDisciplineTypes(input: {
    regionCode?: string;
    status?: MasterDataStatus;
  }): Promise<DisciplineTypeRecord[]> {
    return this.disciplineTypes.filter((record) => {
      if (input.regionCode && record.regionCode !== input.regionCode) {
        return false;
      }
      if (input.status && record.status !== input.status) {
        return false;
      }
      return true;
    });
  }

  async listStandardSets(input: {
    disciplineCode?: string;
    regionCode?: string;
    status?: MasterDataStatus;
  }): Promise<StandardSetRecord[]> {
    return this.standardSets.filter((record) => {
      if (input.disciplineCode && record.disciplineCode !== input.disciplineCode) {
        return false;
      }
      if (input.regionCode && record.regionCode !== input.regionCode) {
        return false;
      }
      if (input.status && record.status !== input.status) {
        return false;
      }
      return true;
    });
  }
}

export class DbMasterDataRepository implements MasterDataRepository {
  constructor(private readonly db: ApiDatabase) {}

  async listDisciplineTypes(input: {
    regionCode?: string;
    status?: MasterDataStatus;
  }): Promise<DisciplineTypeRecord[]> {
    const records = await this.db.query.disciplineTypes.findMany({
      orderBy: (table, { asc }) => [asc(table.disciplineCode), asc(table.id)],
    });

    return records
      .map((record) => ({
        id: record.id,
        disciplineCode: record.disciplineCode,
        disciplineName: record.disciplineName,
        disciplineGroup: record.disciplineGroup ?? null,
        businessViewType: record.businessViewType ?? null,
        regionCode: record.regionCode ?? null,
        sourceMarkup: record.sourceMarkup ?? null,
        gb08Code: record.gb08Code ?? null,
        gb13Code: record.gb13Code ?? null,
        sourceSystem: record.sourceSystem ?? null,
        status: record.status as MasterDataStatus,
      }))
      .filter((record) => {
        if (input.regionCode && record.regionCode !== input.regionCode) {
          return false;
        }
        if (input.status && record.status !== input.status) {
          return false;
        }
        return true;
      });
  }

  async listStandardSets(input: {
    disciplineCode?: string;
    regionCode?: string;
    status?: MasterDataStatus;
  }): Promise<StandardSetRecord[]> {
    const records = await this.db.query.standardSets.findMany({
      orderBy: (table, { asc }) => [asc(table.standardSetCode), asc(table.id)],
    });

    return records
      .map((record) => ({
        id: record.id,
        standardSetCode: record.standardSetCode,
        standardSetName: record.standardSetName,
        disciplineCode: record.disciplineCode,
        regionCode: record.regionCode ?? null,
        versionYear: record.versionYear ?? null,
        standardType: record.standardType ?? null,
        sourceFieldCode: record.sourceFieldCode ?? null,
        sourceMarkup: record.sourceMarkup ?? null,
        sourceSystem: record.sourceSystem ?? null,
        status: record.status as MasterDataStatus,
      }))
      .filter((record) => {
        if (input.disciplineCode && record.disciplineCode !== input.disciplineCode) {
          return false;
        }
        if (input.regionCode && record.regionCode !== input.regionCode) {
          return false;
        }
        if (input.status && record.status !== input.status) {
          return false;
        }
        return true;
      });
  }
}
