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
