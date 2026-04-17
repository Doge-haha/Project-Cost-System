export type BillItemRecord = {
  id: string;
  billVersionId: string;
  parentId: string | null;
  itemCode: string;
  itemName: string;
  quantity: number;
  unit: string;
  sortNo: number;
  systemUnitPrice?: number | null;
  manualUnitPrice?: number | null;
  finalUnitPrice?: number | null;
  systemAmount?: number | null;
  finalAmount?: number | null;
  calculatedAt?: string | null;
};

export interface BillItemRepository {
  listByBillVersionId(billVersionId: string): Promise<BillItemRecord[]>;
  findById(itemId: string): Promise<BillItemRecord | null>;
  create(input: Omit<BillItemRecord, "id">): Promise<BillItemRecord>;
  update(
    itemId: string,
    input: Omit<BillItemRecord, "id">,
  ): Promise<BillItemRecord>;
  updatePricing(
    itemId: string,
    input: {
      systemUnitPrice: number;
      manualUnitPrice?: number | null;
      finalUnitPrice: number;
      systemAmount: number;
      finalAmount: number;
      calculatedAt: string;
    },
  ): Promise<BillItemRecord>;
  updateManualPricing(
    itemId: string,
    input: {
      manualUnitPrice: number | null;
      finalUnitPrice: number;
      finalAmount: number;
      calculatedAt: string;
    },
  ): Promise<BillItemRecord>;
}

export class InMemoryBillItemRepository implements BillItemRepository {
  private readonly items: BillItemRecord[];

  constructor(seed: BillItemRecord[]) {
    this.items = seed.map((item) => ({ ...item }));
  }

  async listByBillVersionId(billVersionId: string): Promise<BillItemRecord[]> {
    return this.items
      .filter((item) => item.billVersionId === billVersionId)
      .sort((left, right) => left.sortNo - right.sortNo);
  }

  async findById(itemId: string): Promise<BillItemRecord | null> {
    return this.items.find((item) => item.id === itemId) ?? null;
  }

  async create(input: Omit<BillItemRecord, "id">): Promise<BillItemRecord> {
    const created: BillItemRecord = {
      id: `bill-item-${String(this.items.length + 1).padStart(3, "0")}`,
      ...input,
    };

    this.items.push(created);
    return created;
  }

  async update(
    itemId: string,
    input: Omit<BillItemRecord, "id">,
  ): Promise<BillItemRecord> {
    const target = this.items.find((item) => item.id === itemId);
    if (!target) {
      throw new Error("Bill item not found");
    }

    target.billVersionId = input.billVersionId;
    target.parentId = input.parentId;
    target.itemCode = input.itemCode;
    target.itemName = input.itemName;
    target.quantity = input.quantity;
    target.unit = input.unit;
    target.sortNo = input.sortNo;
    target.systemUnitPrice = input.systemUnitPrice ?? target.systemUnitPrice ?? null;
    target.manualUnitPrice = input.manualUnitPrice ?? target.manualUnitPrice ?? null;
    target.finalUnitPrice = input.finalUnitPrice ?? target.finalUnitPrice ?? null;
    target.systemAmount = input.systemAmount ?? target.systemAmount ?? null;
    target.finalAmount = input.finalAmount ?? target.finalAmount ?? null;
    target.calculatedAt = input.calculatedAt ?? target.calculatedAt ?? null;

    return target;
  }

  async updatePricing(
    itemId: string,
    input: {
      systemUnitPrice: number;
      manualUnitPrice?: number | null;
      finalUnitPrice: number;
      systemAmount: number;
      finalAmount: number;
      calculatedAt: string;
    },
  ): Promise<BillItemRecord> {
    const target = this.items.find((item) => item.id === itemId);
    if (!target) {
      throw new Error("Bill item not found");
    }

    target.systemUnitPrice = input.systemUnitPrice;
    target.manualUnitPrice = input.manualUnitPrice ?? target.manualUnitPrice ?? null;
    target.finalUnitPrice = input.finalUnitPrice;
    target.systemAmount = input.systemAmount;
    target.finalAmount = input.finalAmount;
    target.calculatedAt = input.calculatedAt;

    return target;
  }

  async updateManualPricing(
    itemId: string,
    input: {
      manualUnitPrice: number | null;
      finalUnitPrice: number;
      finalAmount: number;
      calculatedAt: string;
    },
  ): Promise<BillItemRecord> {
    const target = this.items.find((item) => item.id === itemId);
    if (!target) {
      throw new Error("Bill item not found");
    }

    target.manualUnitPrice = input.manualUnitPrice;
    target.finalUnitPrice = input.finalUnitPrice;
    target.finalAmount = input.finalAmount;
    target.calculatedAt = input.calculatedAt;

    return target;
  }
}
