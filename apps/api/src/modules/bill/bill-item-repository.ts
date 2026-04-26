import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import type { ApiDatabase } from "../../infrastructure/database/database-client.js";
import { billItems } from "../../infrastructure/database/schema.js";

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
  delete(itemId: string): Promise<void>;
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

  async delete(itemId: string): Promise<void> {
    const index = this.items.findIndex((item) => item.id === itemId);
    if (index === -1) {
      throw new Error("Bill item not found");
    }
    this.items.splice(index, 1);
  }
}

export class DbBillItemRepository implements BillItemRepository {
  constructor(private readonly db: ApiDatabase) {}

  async listByBillVersionId(billVersionId: string): Promise<BillItemRecord[]> {
    const records = await this.db.query.billItems.findMany({
      where: (table, { eq: isEqual }) => isEqual(table.billVersionId, billVersionId),
      orderBy: (table, { asc }) => [asc(table.sortNo), asc(table.id)],
    });

    return records.map(mapBillItemRecord);
  }

  async findById(itemId: string): Promise<BillItemRecord | null> {
    const record = await this.db.query.billItems.findFirst({
      where: (table, { eq: isEqual }) => isEqual(table.id, itemId),
    });

    return record ? mapBillItemRecord(record) : null;
  }

  async create(input: Omit<BillItemRecord, "id">): Promise<BillItemRecord> {
    const [created] = await this.db
      .insert(billItems)
      .values({
        id: randomUUID(),
        billVersionId: input.billVersionId,
        parentId: input.parentId,
        itemCode: input.itemCode,
        itemName: input.itemName,
        quantity: input.quantity,
        unit: input.unit,
        sortNo: input.sortNo,
        systemUnitPrice: input.systemUnitPrice ?? null,
        manualUnitPrice: input.manualUnitPrice ?? null,
        finalUnitPrice: input.finalUnitPrice ?? null,
        systemAmount: input.systemAmount ?? null,
        finalAmount: input.finalAmount ?? null,
        calculatedAt: input.calculatedAt ? new Date(input.calculatedAt) : null,
      })
      .returning();

    return mapBillItemRecord(created);
  }

  async update(
    itemId: string,
    input: Omit<BillItemRecord, "id">,
  ): Promise<BillItemRecord> {
    const [updated] = await this.db
      .update(billItems)
      .set({
        billVersionId: input.billVersionId,
        parentId: input.parentId,
        itemCode: input.itemCode,
        itemName: input.itemName,
        quantity: input.quantity,
        unit: input.unit,
        sortNo: input.sortNo,
        systemUnitPrice: input.systemUnitPrice ?? null,
        manualUnitPrice: input.manualUnitPrice ?? null,
        finalUnitPrice: input.finalUnitPrice ?? null,
        systemAmount: input.systemAmount ?? null,
        finalAmount: input.finalAmount ?? null,
        calculatedAt: input.calculatedAt ? new Date(input.calculatedAt) : null,
      })
      .where(eq(billItems.id, itemId))
      .returning();

    if (!updated) {
      throw new Error("Bill item not found");
    }

    return mapBillItemRecord(updated);
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
    const [updated] = await this.db
      .update(billItems)
      .set({
        systemUnitPrice: input.systemUnitPrice,
        manualUnitPrice: input.manualUnitPrice ?? null,
        finalUnitPrice: input.finalUnitPrice,
        systemAmount: input.systemAmount,
        finalAmount: input.finalAmount,
        calculatedAt: new Date(input.calculatedAt),
      })
      .where(eq(billItems.id, itemId))
      .returning();

    if (!updated) {
      throw new Error("Bill item not found");
    }

    return mapBillItemRecord(updated);
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
    const [updated] = await this.db
      .update(billItems)
      .set({
        manualUnitPrice: input.manualUnitPrice,
        finalUnitPrice: input.finalUnitPrice,
        finalAmount: input.finalAmount,
        calculatedAt: new Date(input.calculatedAt),
      })
      .where(eq(billItems.id, itemId))
      .returning();

    if (!updated) {
      throw new Error("Bill item not found");
    }

    return mapBillItemRecord(updated);
  }

  async delete(itemId: string): Promise<void> {
    const [deleted] = await this.db
      .delete(billItems)
      .where(eq(billItems.id, itemId))
      .returning({ id: billItems.id });

    if (!deleted) {
      throw new Error("Bill item not found");
    }
  }
}

function mapBillItemRecord(record: typeof billItems.$inferSelect): BillItemRecord {
  return {
    id: record.id,
    billVersionId: record.billVersionId,
    parentId: record.parentId ?? null,
    itemCode: record.itemCode,
    itemName: record.itemName,
    quantity: record.quantity,
    unit: record.unit,
    sortNo: record.sortNo,
    systemUnitPrice: record.systemUnitPrice ?? null,
    manualUnitPrice: record.manualUnitPrice ?? null,
    finalUnitPrice: record.finalUnitPrice ?? null,
    systemAmount: record.systemAmount ?? null,
    finalAmount: record.finalAmount ?? null,
    calculatedAt: record.calculatedAt?.toISOString() ?? null,
  };
}
