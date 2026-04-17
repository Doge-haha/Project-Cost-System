export type QuotaLineRecord = {
  id: string;
  billItemId: string;
  sourceStandardSetCode: string;
  sourceQuotaId: string;
  sourceSequence?: number | null;
  chapterCode: string;
  quotaCode: string;
  quotaName: string;
  unit: string;
  quantity: number;
  laborFee?: number | null;
  materialFee?: number | null;
  machineFee?: number | null;
  contentFactor: number;
  sourceMode: string;
};

export interface QuotaLineRepository {
  listByBillItemId(billItemId: string): Promise<QuotaLineRecord[]>;
  findById(quotaLineId: string): Promise<QuotaLineRecord | null>;
  create(input: Omit<QuotaLineRecord, "id">): Promise<QuotaLineRecord>;
  update(
    quotaLineId: string,
    input: Omit<QuotaLineRecord, "id">,
  ): Promise<QuotaLineRecord>;
}

export class InMemoryQuotaLineRepository implements QuotaLineRepository {
  private readonly quotaLines: QuotaLineRecord[];

  constructor(seed: QuotaLineRecord[]) {
    this.quotaLines = seed.map((quotaLine) => ({ ...quotaLine }));
  }

  async listByBillItemId(billItemId: string): Promise<QuotaLineRecord[]> {
    return this.quotaLines.filter((quotaLine) => quotaLine.billItemId === billItemId);
  }

  async findById(quotaLineId: string): Promise<QuotaLineRecord | null> {
    return this.quotaLines.find((quotaLine) => quotaLine.id === quotaLineId) ?? null;
  }

  async create(input: Omit<QuotaLineRecord, "id">): Promise<QuotaLineRecord> {
    const created: QuotaLineRecord = {
      id: `quota-line-${String(this.quotaLines.length + 1).padStart(3, "0")}`,
      ...input,
    };

    this.quotaLines.push(created);
    return created;
  }

  async update(
    quotaLineId: string,
    input: Omit<QuotaLineRecord, "id">,
  ): Promise<QuotaLineRecord> {
    const target = this.quotaLines.find((quotaLine) => quotaLine.id === quotaLineId);
    if (!target) {
      throw new Error("Quota line not found");
    }

    target.billItemId = input.billItemId;
    target.sourceStandardSetCode = input.sourceStandardSetCode;
    target.sourceQuotaId = input.sourceQuotaId;
    target.sourceSequence = input.sourceSequence ?? null;
    target.chapterCode = input.chapterCode;
    target.quotaCode = input.quotaCode;
    target.quotaName = input.quotaName;
    target.unit = input.unit;
    target.quantity = input.quantity;
    target.laborFee = input.laborFee ?? null;
    target.materialFee = input.materialFee ?? null;
    target.machineFee = input.machineFee ?? null;
    target.contentFactor = input.contentFactor;
    target.sourceMode = input.sourceMode;

    return target;
  }
}
