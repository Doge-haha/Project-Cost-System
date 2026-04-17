export type PriceVersionRecord = {
  id: string;
  versionCode: string;
  versionName: string;
  regionCode: string;
  disciplineCode: string;
  status: "active" | "inactive";
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
