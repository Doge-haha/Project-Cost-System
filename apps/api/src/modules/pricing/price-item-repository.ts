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
