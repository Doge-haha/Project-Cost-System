export type FeeTemplateRecord = {
  id: string;
  templateName: string;
  projectType: string | null;
  regionCode: string | null;
  stageScope: string[];
  taxMode: string;
  allocationMode: string;
  status: "draft" | "active" | "inactive";
};

export interface FeeTemplateRepository {
  list(input: {
    regionCode?: string;
    projectType?: string;
    stageCode?: string;
    status?: FeeTemplateRecord["status"];
  }): Promise<FeeTemplateRecord[]>;
  findById(feeTemplateId: string): Promise<FeeTemplateRecord | null>;
}

export class InMemoryFeeTemplateRepository implements FeeTemplateRepository {
  private readonly feeTemplates: FeeTemplateRecord[];

  constructor(seed: FeeTemplateRecord[]) {
    this.feeTemplates = seed.map((feeTemplate) => ({
      ...feeTemplate,
      stageScope: [...feeTemplate.stageScope],
    }));
  }

  async list(input: {
    regionCode?: string;
    projectType?: string;
    stageCode?: string;
    status?: FeeTemplateRecord["status"];
  }): Promise<FeeTemplateRecord[]> {
    return this.feeTemplates.filter((feeTemplate) => {
      if (input.regionCode && feeTemplate.regionCode !== input.regionCode) {
        return false;
      }
      if (input.projectType && feeTemplate.projectType !== input.projectType) {
        return false;
      }
      if (input.stageCode && !feeTemplate.stageScope.includes(input.stageCode)) {
        return false;
      }
      if (input.status && feeTemplate.status !== input.status) {
        return false;
      }
      return true;
    });
  }

  async findById(feeTemplateId: string): Promise<FeeTemplateRecord | null> {
    return this.feeTemplates.find((item) => item.id === feeTemplateId) ?? null;
  }
}
