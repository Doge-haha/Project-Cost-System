import type { ApiDatabase } from "../../infrastructure/database/database-client.js";

export type PriceItemRecord = {
  id: string;
  priceVersionId: string;
  quotaCode: string;
  laborUnitPrice: number;
  materialUnitPrice: number;
  machineUnitPrice: number;
  totalUnitPrice: number;
};

export interface PriceItemRepository {
  listByPriceVersionId(input: {
    priceVersionId: string;
    quotaCode?: string;
  }): Promise<PriceItemRecord[]>;
}

export class InMemoryPriceItemRepository implements PriceItemRepository {
  private readonly priceItems: PriceItemRecord[];

  constructor(seed: PriceItemRecord[]) {
    this.priceItems = seed.map((priceItem) => ({ ...priceItem }));
  }

  async listByPriceVersionId(input: {
    priceVersionId: string;
    quotaCode?: string;
  }): Promise<PriceItemRecord[]> {
    return this.priceItems.filter((priceItem) => {
      if (priceItem.priceVersionId !== input.priceVersionId) {
        return false;
      }
      if (input.quotaCode && priceItem.quotaCode !== input.quotaCode) {
        return false;
      }
      return true;
    });
  }
}

export class DbPriceItemRepository implements PriceItemRepository {
  constructor(private readonly db: ApiDatabase) {}

  async listByPriceVersionId(input: {
    priceVersionId: string;
    quotaCode?: string;
  }): Promise<PriceItemRecord[]> {
    const records = await this.db.query.priceItems.findMany({
      where: (table, { eq }) => eq(table.priceVersionId, input.priceVersionId),
      orderBy: (table, { asc }) => [asc(table.quotaCode), asc(table.id)],
    });

    return records
      .map((record) => ({
        id: record.id,
        priceVersionId: record.priceVersionId,
        quotaCode: record.quotaCode,
        laborUnitPrice: record.laborUnitPrice,
        materialUnitPrice: record.materialUnitPrice,
        machineUnitPrice: record.machineUnitPrice,
        totalUnitPrice: record.totalUnitPrice,
      }))
      .filter((record) => {
        if (input.quotaCode && record.quotaCode !== input.quotaCode) {
          return false;
        }
        return true;
      });
  }
}
