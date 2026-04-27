import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import type { ApiDatabase } from "../../infrastructure/database/database-client.js";
import { quotaLines } from "../../infrastructure/database/schema.js";

export type QuotaLineSourceMode = "manual" | "ai" | "history_reference";

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
  sourceMode: QuotaLineSourceMode;
};

export type QuotaSourceCandidateFilter = {
  sourceStandardSetCode?: string;
  chapterCode?: string;
  keyword?: string;
};

export interface QuotaLineRepository {
  listByBillItemId(billItemId: string): Promise<QuotaLineRecord[]>;
  listSourceCandidates(
    input: QuotaSourceCandidateFilter,
  ): Promise<QuotaLineRecord[]>;
  findById(quotaLineId: string): Promise<QuotaLineRecord | null>;
  create(input: Omit<QuotaLineRecord, "id">): Promise<QuotaLineRecord>;
  update(
    quotaLineId: string,
    input: Omit<QuotaLineRecord, "id">,
  ): Promise<QuotaLineRecord>;
  delete(quotaLineId: string): Promise<void>;
  deleteByBillItemId(billItemId: string): Promise<void>;
}

export class InMemoryQuotaLineRepository implements QuotaLineRepository {
  private readonly quotaLines: QuotaLineRecord[];

  constructor(seed: QuotaLineRecord[]) {
    this.quotaLines = seed.map((quotaLine) => ({ ...quotaLine }));
  }

  async listByBillItemId(billItemId: string): Promise<QuotaLineRecord[]> {
    return this.quotaLines.filter((quotaLine) => quotaLine.billItemId === billItemId);
  }

  async listSourceCandidates(
    input: QuotaSourceCandidateFilter,
  ): Promise<QuotaLineRecord[]> {
    return filterSourceCandidates(this.quotaLines, input);
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

  async delete(quotaLineId: string): Promise<void> {
    const index = this.quotaLines.findIndex((quotaLine) => quotaLine.id === quotaLineId);
    if (index === -1) {
      throw new Error("Quota line not found");
    }
    this.quotaLines.splice(index, 1);
  }

  async deleteByBillItemId(billItemId: string): Promise<void> {
    for (let index = this.quotaLines.length - 1; index >= 0; index -= 1) {
      if (this.quotaLines[index].billItemId === billItemId) {
        this.quotaLines.splice(index, 1);
      }
    }
  }
}

export class DbQuotaLineRepository implements QuotaLineRepository {
  constructor(private readonly db: ApiDatabase) {}

  async listByBillItemId(billItemId: string): Promise<QuotaLineRecord[]> {
    const records = await this.db.query.quotaLines.findMany({
      where: (table, { eq: isEqual }) => isEqual(table.billItemId, billItemId),
      orderBy: (table, { asc }) => [asc(table.quotaCode), asc(table.id)],
    });

    return records.map(mapQuotaLineRecord);
  }

  async listSourceCandidates(
    input: QuotaSourceCandidateFilter,
  ): Promise<QuotaLineRecord[]> {
    const records = await this.db.query.quotaLines.findMany({
      orderBy: (table, { asc }) => [
        asc(table.sourceStandardSetCode),
        asc(table.chapterCode),
        asc(table.quotaCode),
        asc(table.id),
      ],
    });

    return filterSourceCandidates(records.map(mapQuotaLineRecord), input);
  }

  async findById(quotaLineId: string): Promise<QuotaLineRecord | null> {
    const record = await this.db.query.quotaLines.findFirst({
      where: (table, { eq: isEqual }) => isEqual(table.id, quotaLineId),
    });

    return record ? mapQuotaLineRecord(record) : null;
  }

  async create(input: Omit<QuotaLineRecord, "id">): Promise<QuotaLineRecord> {
    const [created] = await this.db
      .insert(quotaLines)
      .values({
        id: randomUUID(),
        billItemId: input.billItemId,
        sourceStandardSetCode: input.sourceStandardSetCode,
        sourceQuotaId: input.sourceQuotaId,
        sourceSequence: input.sourceSequence ?? null,
        chapterCode: input.chapterCode,
        quotaCode: input.quotaCode,
        quotaName: input.quotaName,
        unit: input.unit,
        quantity: input.quantity,
        laborFee: input.laborFee ?? null,
        materialFee: input.materialFee ?? null,
        machineFee: input.machineFee ?? null,
        contentFactor: input.contentFactor,
        sourceMode: input.sourceMode,
      })
      .returning();

    return mapQuotaLineRecord(created);
  }

  async update(
    quotaLineId: string,
    input: Omit<QuotaLineRecord, "id">,
  ): Promise<QuotaLineRecord> {
    const [updated] = await this.db
      .update(quotaLines)
      .set({
        billItemId: input.billItemId,
        sourceStandardSetCode: input.sourceStandardSetCode,
        sourceQuotaId: input.sourceQuotaId,
        sourceSequence: input.sourceSequence ?? null,
        chapterCode: input.chapterCode,
        quotaCode: input.quotaCode,
        quotaName: input.quotaName,
        unit: input.unit,
        quantity: input.quantity,
        laborFee: input.laborFee ?? null,
        materialFee: input.materialFee ?? null,
        machineFee: input.machineFee ?? null,
        contentFactor: input.contentFactor,
        sourceMode: input.sourceMode,
      })
      .where(eq(quotaLines.id, quotaLineId))
      .returning();

    if (!updated) {
      throw new Error("Quota line not found");
    }

    return mapQuotaLineRecord(updated);
  }

  async delete(quotaLineId: string): Promise<void> {
    const [deleted] = await this.db
      .delete(quotaLines)
      .where(eq(quotaLines.id, quotaLineId))
      .returning({ id: quotaLines.id });

    if (!deleted) {
      throw new Error("Quota line not found");
    }
  }

  async deleteByBillItemId(billItemId: string): Promise<void> {
    await this.db.delete(quotaLines).where(eq(quotaLines.billItemId, billItemId));
  }
}

function filterSourceCandidates(
  records: QuotaLineRecord[],
  input: QuotaSourceCandidateFilter,
): QuotaLineRecord[] {
  const keyword = input.keyword?.trim().toLowerCase();
  const seen = new Set<string>();
  const candidates: QuotaLineRecord[] = [];

  for (const record of records) {
    if (
      input.sourceStandardSetCode &&
      record.sourceStandardSetCode !== input.sourceStandardSetCode
    ) {
      continue;
    }
    if (input.chapterCode && record.chapterCode !== input.chapterCode) {
      continue;
    }
    if (
      keyword &&
      !record.quotaCode.toLowerCase().includes(keyword) &&
      !record.quotaName.toLowerCase().includes(keyword)
    ) {
      continue;
    }

    const key = [
      record.sourceStandardSetCode,
      record.sourceQuotaId,
      record.quotaCode,
    ].join(":");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    candidates.push(record);
  }

  return candidates;
}

function mapQuotaLineRecord(
  record: typeof quotaLines.$inferSelect,
): QuotaLineRecord {
  return {
    id: record.id,
    billItemId: record.billItemId,
    sourceStandardSetCode: record.sourceStandardSetCode,
    sourceQuotaId: record.sourceQuotaId,
    sourceSequence: record.sourceSequence ?? null,
    chapterCode: record.chapterCode,
    quotaCode: record.quotaCode,
    quotaName: record.quotaName,
    unit: record.unit,
    quantity: record.quantity,
    laborFee: record.laborFee ?? null,
    materialFee: record.materialFee ?? null,
    machineFee: record.machineFee ?? null,
    contentFactor: record.contentFactor,
    sourceMode: record.sourceMode as QuotaLineSourceMode,
  };
}
