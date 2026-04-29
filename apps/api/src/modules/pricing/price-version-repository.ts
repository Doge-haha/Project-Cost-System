import type { ApiDatabase } from "../../infrastructure/database/database-client.js";
import type { PriceVersionStatus } from "./pricing-constants.js";

export type PriceVersionRecord = {
  id: string;
  versionCode: string;
  versionName: string;
  regionCode: string;
  disciplineCode: string;
  status: PriceVersionStatus;
};

export interface PriceVersionRepository {
  list(input: {
    regionCode?: string;
    disciplineCode?: string;
    status?: PriceVersionRecord["status"];
  }): Promise<PriceVersionRecord[]>;
}

export class InMemoryPriceVersionRepository implements PriceVersionRepository {
  private readonly priceVersions: PriceVersionRecord[];

  constructor(seed: PriceVersionRecord[]) {
    this.priceVersions = seed.map((priceVersion) => ({ ...priceVersion }));
  }

  async list(input: {
    regionCode?: string;
    disciplineCode?: string;
    status?: PriceVersionRecord["status"];
  }): Promise<PriceVersionRecord[]> {
    return this.priceVersions.filter((priceVersion) => {
      if (input.regionCode && priceVersion.regionCode !== input.regionCode) {
        return false;
      }
      if (
        input.disciplineCode &&
        priceVersion.disciplineCode !== input.disciplineCode
      ) {
        return false;
      }
      if (input.status && priceVersion.status !== input.status) {
        return false;
      }
      return true;
    });
  }
}

export class DbPriceVersionRepository implements PriceVersionRepository {
  constructor(private readonly db: ApiDatabase) {}

  async list(input: {
    regionCode?: string;
    disciplineCode?: string;
    status?: PriceVersionRecord["status"];
  }): Promise<PriceVersionRecord[]> {
    const records = await this.db.query.priceVersions.findMany({
      orderBy: (table, { asc }) => [asc(table.versionCode), asc(table.id)],
    });

    return records
      .map((record) => ({
        id: record.id,
        versionCode: record.versionCode,
        versionName: record.versionName,
        regionCode: record.regionCode,
        disciplineCode: record.disciplineCode,
        status: record.status as PriceVersionRecord["status"],
      }))
      .filter((record) => {
        if (input.regionCode && record.regionCode !== input.regionCode) {
          return false;
        }
        if (input.disciplineCode && record.disciplineCode !== input.disciplineCode) {
          return false;
        }
        if (input.status && record.status !== input.status) {
          return false;
        }
        return true;
      });
  }
}
