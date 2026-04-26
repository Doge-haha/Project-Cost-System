import type { ApiDatabase } from "../../infrastructure/database/database-client.js";

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

export class DbFeeTemplateRepository implements FeeTemplateRepository {
  constructor(private readonly db: ApiDatabase) {}

  async list(input: {
    regionCode?: string;
    projectType?: string;
    stageCode?: string;
    status?: FeeTemplateRecord["status"];
  }): Promise<FeeTemplateRecord[]> {
    const records = await this.db.query.feeTemplates.findMany({
      orderBy: (table, { asc }) => [asc(table.templateName), asc(table.id)],
    });

    return records
      .map((record) => ({
        id: record.id,
        templateName: record.templateName,
        projectType: record.projectType ?? null,
        regionCode: record.regionCode ?? null,
        stageScope: [...record.stageScope],
        taxMode: record.taxMode,
        allocationMode: record.allocationMode,
        status: record.status as FeeTemplateRecord["status"],
      }))
      .filter((record) => {
        if (input.regionCode && record.regionCode !== input.regionCode) {
          return false;
        }
        if (input.projectType && record.projectType !== input.projectType) {
          return false;
        }
        if (input.stageCode && !record.stageScope.includes(input.stageCode)) {
          return false;
        }
        if (input.status && record.status !== input.status) {
          return false;
        }
        return true;
      });
  }

  async findById(feeTemplateId: string): Promise<FeeTemplateRecord | null> {
    const record = await this.db.query.feeTemplates.findFirst({
      where: (table, { eq }) => eq(table.id, feeTemplateId),
    });

    if (!record) {
      return null;
    }

    return {
      id: record.id,
      templateName: record.templateName,
      projectType: record.projectType ?? null,
      regionCode: record.regionCode ?? null,
      stageScope: [...record.stageScope],
      taxMode: record.taxMode,
      allocationMode: record.allocationMode,
      status: record.status as FeeTemplateRecord["status"],
    };
  }
}
