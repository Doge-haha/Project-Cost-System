export type BillWorkItemRecord = {
  id: string;
  billItemId: string;
  workContent: string;
  sortNo: number;
};

export interface BillWorkItemRepository {
  listByBillItemId(billItemId: string): Promise<BillWorkItemRecord[]>;
  create(input: Omit<BillWorkItemRecord, "id">): Promise<BillWorkItemRecord>;
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

  async cloneByBillItemId(
    sourceBillItemId: string,
    targetBillItemId: string,
  ): Promise<BillWorkItemRecord[]> {
    const sourceItems = this.workItems
      .filter((item) => item.billItemId === sourceBillItemId)
      .sort((left, right) => left.sortNo - right.sortNo);

    const created: BillWorkItemRecord[] = [];
    for (const item of sourceItems) {
      created.push(
        await this.create({
          billItemId: targetBillItemId,
          workContent: item.workContent,
          sortNo: item.sortNo,
        }),
      );
    }

    return created;
  }
}
