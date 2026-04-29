import { z } from "zod";

import type {
  DisciplineTypeRecord,
  MasterDataRepository,
  MasterDataStatus,
  StandardSetRecord,
} from "./master-data-repository.js";

export const listDisciplineTypesSchema = z.object({
  regionCode: z.string().min(1).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export const listStandardSetsSchema = z.object({
  disciplineCode: z.string().min(1).optional(),
  regionCode: z.string().min(1).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export class MasterDataService {
  constructor(private readonly masterDataRepository: MasterDataRepository) {}

  async listDisciplineTypes(input: {
    regionCode?: string;
    status?: MasterDataStatus;
  }): Promise<DisciplineTypeRecord[]> {
    return this.masterDataRepository.listDisciplineTypes(input);
  }

  async listStandardSets(input: {
    disciplineCode?: string;
    regionCode?: string;
    status?: MasterDataStatus;
  }): Promise<StandardSetRecord[]> {
    return this.masterDataRepository.listStandardSets(input);
  }
}
