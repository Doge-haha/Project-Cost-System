import { referenceQuotas } from "../../infrastructure/database/schema.js";
import type { ApiDatabase } from "../../infrastructure/database/database-client.js";

export type ReferenceQuotaRecord = {
  id: string;
  sourceDataset: string;
  sourceRegion?: string | null;
  standardSetCode: string;
  disciplineCode?: string | null;
  sourceQuotaId: string;
  sourceSequence?: number | null;
  chapterCode: string;
  quotaCode: string;
  quotaName: string;
  unit: string;
  laborFee?: number | null;
  materialFee?: number | null;
  machineFee?: number | null;
  workContentSummary?: string | null;
  resourceCompositionSummary?: string | null;
  searchText: string;
  metadata: Record<string, unknown>;
};

export type ReferenceQuotaCandidateFilter = {
  standardSetCode?: string;
  disciplineCode?: string;
  chapterCode?: string;
  keyword?: string;
};

export interface ReferenceQuotaRepository {
  listCandidates(
    input: ReferenceQuotaCandidateFilter,
  ): Promise<ReferenceQuotaRecord[]>;
}

export class InMemoryReferenceQuotaRepository implements ReferenceQuotaRepository {
  private readonly referenceQuotas: ReferenceQuotaRecord[];

  constructor(seed: ReferenceQuotaRecord[]) {
    this.referenceQuotas = seed.map((record) => ({ ...record }));
  }

  async listCandidates(
    input: ReferenceQuotaCandidateFilter,
  ): Promise<ReferenceQuotaRecord[]> {
    return filterReferenceQuotaCandidates(this.referenceQuotas, input);
  }
}

export class DbReferenceQuotaRepository implements ReferenceQuotaRepository {
  constructor(private readonly db: ApiDatabase) {}

  async listCandidates(
    input: ReferenceQuotaCandidateFilter,
  ): Promise<ReferenceQuotaRecord[]> {
    const records = await this.db.query.referenceQuotas.findMany({
      orderBy: (table, { asc }) => [
        asc(table.standardSetCode),
        asc(table.chapterCode),
        asc(table.quotaCode),
        asc(table.id),
      ],
    });

    return filterReferenceQuotaCandidates(records.map(mapReferenceQuotaRecord), input);
  }
}

function filterReferenceQuotaCandidates(
  records: ReferenceQuotaRecord[],
  input: ReferenceQuotaCandidateFilter,
): ReferenceQuotaRecord[] {
  const keyword = input.keyword?.trim().toLowerCase();
  return records.filter((record) => {
    if (input.standardSetCode && record.standardSetCode !== input.standardSetCode) {
      return false;
    }
    if (input.disciplineCode && record.disciplineCode !== input.disciplineCode) {
      return false;
    }
    if (input.chapterCode && record.chapterCode !== input.chapterCode) {
      return false;
    }
    if (
      keyword &&
      !record.searchText.toLowerCase().includes(keyword) &&
      !record.quotaCode.toLowerCase().includes(keyword) &&
      !record.quotaName.toLowerCase().includes(keyword)
    ) {
      return false;
    }

    return true;
  });
}

function mapReferenceQuotaRecord(
  record: typeof referenceQuotas.$inferSelect,
): ReferenceQuotaRecord {
  return {
    id: record.id,
    sourceDataset: record.sourceDataset,
    sourceRegion: record.sourceRegion ?? null,
    standardSetCode: record.standardSetCode,
    disciplineCode: record.disciplineCode ?? null,
    sourceQuotaId: record.sourceQuotaId,
    sourceSequence: record.sourceSequence ?? null,
    chapterCode: record.chapterCode,
    quotaCode: record.quotaCode,
    quotaName: record.quotaName,
    unit: record.unit,
    laborFee: record.laborFee ?? null,
    materialFee: record.materialFee ?? null,
    machineFee: record.machineFee ?? null,
    workContentSummary: record.workContentSummary ?? null,
    resourceCompositionSummary: record.resourceCompositionSummary ?? null,
    searchText: record.searchText,
    metadata: record.metadata as Record<string, unknown>,
  };
}
