import type { ApiDatabase } from "../../infrastructure/database/database-client.js";

export type FeeRuleRecord = {
  id: string;
  feeTemplateId: string;
  disciplineCode: string | null;
  feeType: string;
  feeRate: number;
};

export interface FeeRuleRepository {
  listByFeeTemplateId(feeTemplateId: string): Promise<FeeRuleRecord[]>;
}

export class InMemoryFeeRuleRepository implements FeeRuleRepository {
  private readonly feeRules: FeeRuleRecord[];

  constructor(seed: FeeRuleRecord[]) {
    this.feeRules = seed.map((feeRule) => ({ ...feeRule }));
  }

  async listByFeeTemplateId(feeTemplateId: string): Promise<FeeRuleRecord[]> {
    return this.feeRules.filter((feeRule) => feeRule.feeTemplateId === feeTemplateId);
  }
}

export class DbFeeRuleRepository implements FeeRuleRepository {
  constructor(private readonly db: ApiDatabase) {}

  async listByFeeTemplateId(feeTemplateId: string): Promise<FeeRuleRecord[]> {
    const records = await this.db.query.feeRules.findMany({
      where: (table, { eq }) => eq(table.feeTemplateId, feeTemplateId),
      orderBy: (table, { asc }) => [asc(table.feeType), asc(table.id)],
    });

    return records.map((record) => ({
      id: record.id,
      feeTemplateId: record.feeTemplateId,
      disciplineCode: record.disciplineCode ?? null,
      feeType: record.feeType,
      feeRate: record.feeRate,
    }));
  }
}
