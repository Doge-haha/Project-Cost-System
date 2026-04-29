import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import type { ApiDatabase } from "../../infrastructure/database/database-client.js";
import { billWorkItems } from "../../infrastructure/database/schema.js";

export type BillWorkItemRecord = {
  id: string;
  billItemId: string;
  workContent: string;
  sortNo: number;
  sourceSpecCode?: string | null;
  sourceBillId?: string | null;
};

export interface BillWorkItemRepository {
  listByBillItemId(billItemId: string): Promise<BillWorkItemRecord[]>;
  create(input: Omit<BillWorkItemRecord, "id">): Promise<BillWorkItemRecord>;
  findById(workItemId: string): Promise<BillWorkItemRecord | null>;
  update(
    workItemId: string,
    input: Pick<BillWorkItemRecord, "workContent" | "sortNo">,
  ): Promise<BillWorkItemRecord>;
  delete(workItemId: string): Promise<void>;
  deleteByBillItemId(billItemId: string): Promise<void>;
  cloneByBillItemId(
    sourceBillItemId: string,
    targetBillItemId: string,
  ): Promise<BillWorkItemRecord[]>;
}

export class InMemoryBillWorkItemRepository implements BillWorkItemRepository {
  private readonly workItems: BillWorkItemRecord[];

  constructor(seed: BillWorkItemRecord[]) {
    this.workItems = seed.map((item) => ({ ...item }));
  }

  async listByBillItemId(billItemId: string): Promise<BillWorkItemRecord[]> {
    return this.workItems
      .filter((item) => item.billItemId === billItemId)
      .sort((left, right) => left.sortNo - right.sortNo);
  }

  async create(
    input: Omit<BillWorkItemRecord, "id">,
  ): Promise<BillWorkItemRecord> {
    const created: BillWorkItemRecord = {
      id: `work-item-${String(this.workItems.length + 1).padStart(3, "0")}`,
      ...input,
    };
    this.workItems.push(created);
    return created;
  }

  async findById(workItemId: string): Promise<BillWorkItemRecord | null> {
    return this.workItems.find((item) => item.id === workItemId) ?? null;
  }

  async update(
    workItemId: string,
    input: Pick<BillWorkItemRecord, "workContent" | "sortNo">,
  ): Promise<BillWorkItemRecord> {
    const target = this.workItems.find((item) => item.id === workItemId);
    if (!target) {
      throw new Error("Work item not found");
    }

    target.workContent = input.workContent;
    target.sortNo = input.sortNo;
    return target;
  }

  async delete(workItemId: string): Promise<void> {
    const index = this.workItems.findIndex((item) => item.id === workItemId);
    if (index === -1) {
      throw new Error("Work item not found");
    }
    this.workItems.splice(index, 1);
  }

  async deleteByBillItemId(billItemId: string): Promise<void> {
    for (let index = this.workItems.length - 1; index >= 0; index -= 1) {
      if (this.workItems[index].billItemId === billItemId) {
        this.workItems.splice(index, 1);
      }
    }
  }

  async cloneByBillItemId(
    sourceBillItemId: string,
    targetBillItemId: string,
  ): Promise<BillWorkItemRecord[]> {
    const sourceItems = this.workItems
      .filter((item) => item.billItemId === sourceBillItemId)
      .sort((left, right) => left.sortNo - right.sortNo);

    const created: BillWorkItemRecord[] = [];
    for (const item of sourceItems) {
      const input: Omit<BillWorkItemRecord, "id"> = {
        billItemId: targetBillItemId,
        workContent: item.workContent,
        sortNo: item.sortNo,
      };
      if (item.sourceSpecCode !== undefined) {
        input.sourceSpecCode = item.sourceSpecCode;
      }
      if (item.sourceBillId !== undefined) {
        input.sourceBillId = item.sourceBillId;
      }
      created.push(await this.create(input));
    }

    return created;
  }
}

export class DbBillWorkItemRepository implements BillWorkItemRepository {
  constructor(private readonly db: ApiDatabase) {}

  async listByBillItemId(billItemId: string): Promise<BillWorkItemRecord[]> {
    const records = await this.db.query.billWorkItems.findMany({
      where: (table, { eq: isEqual }) => isEqual(table.billItemId, billItemId),
      orderBy: (table, { asc }) => [asc(table.sortNo), asc(table.id)],
    });

    return records.map(mapBillWorkItemRecord);
  }

  async create(
    input: Omit<BillWorkItemRecord, "id">,
  ): Promise<BillWorkItemRecord> {
    const [created] = await this.db
      .insert(billWorkItems)
      .values({
        id: randomUUID(),
        billItemId: input.billItemId,
        workContent: input.workContent,
        sortNo: input.sortNo,
        sourceSpecCode: input.sourceSpecCode ?? null,
        sourceBillId: input.sourceBillId ?? null,
      })
      .returning();

    return mapBillWorkItemRecord(created);
  }

  async findById(workItemId: string): Promise<BillWorkItemRecord | null> {
    const record = await this.db.query.billWorkItems.findFirst({
      where: (table, { eq: isEqual }) => isEqual(table.id, workItemId),
    });

    return record ? mapBillWorkItemRecord(record) : null;
  }

  async update(
    workItemId: string,
    input: Pick<BillWorkItemRecord, "workContent" | "sortNo">,
  ): Promise<BillWorkItemRecord> {
    const [updated] = await this.db
      .update(billWorkItems)
      .set({
        workContent: input.workContent,
        sortNo: input.sortNo,
      })
      .where(eq(billWorkItems.id, workItemId))
      .returning();

    if (!updated) {
      throw new Error("Work item not found");
    }

    return mapBillWorkItemRecord(updated);
  }

  async delete(workItemId: string): Promise<void> {
    const [deleted] = await this.db
      .delete(billWorkItems)
      .where(eq(billWorkItems.id, workItemId))
      .returning({ id: billWorkItems.id });

    if (!deleted) {
      throw new Error("Work item not found");
    }
  }

  async deleteByBillItemId(billItemId: string): Promise<void> {
    await this.db.delete(billWorkItems).where(eq(billWorkItems.billItemId, billItemId));
  }

  async cloneByBillItemId(
    sourceBillItemId: string,
    targetBillItemId: string,
  ): Promise<BillWorkItemRecord[]> {
    const sourceItems = await this.listByBillItemId(sourceBillItemId);
    const created: BillWorkItemRecord[] = [];

    for (const item of sourceItems) {
      const input: Omit<BillWorkItemRecord, "id"> = {
        billItemId: targetBillItemId,
        workContent: item.workContent,
        sortNo: item.sortNo,
      };
      if (item.sourceSpecCode !== undefined) {
        input.sourceSpecCode = item.sourceSpecCode;
      }
      if (item.sourceBillId !== undefined) {
        input.sourceBillId = item.sourceBillId;
      }
      created.push(await this.create(input));
    }

    return created;
  }
}

function mapBillWorkItemRecord(
  record: typeof billWorkItems.$inferSelect,
): BillWorkItemRecord {
  const mapped: BillWorkItemRecord = {
    id: record.id,
    billItemId: record.billItemId,
    workContent: record.workContent,
    sortNo: record.sortNo,
  };
  if (record.sourceSpecCode !== null) {
    mapped.sourceSpecCode = record.sourceSpecCode;
  }
  if (record.sourceBillId !== null) {
    mapped.sourceBillId = record.sourceBillId;
  }

  return mapped;
}
