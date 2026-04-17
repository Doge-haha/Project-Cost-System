import { z } from "zod";

import type {
  PriceVersionRecord,
  PriceVersionRepository,
} from "./price-version-repository.js";

export const listPriceVersionSchema = z.object({
  regionCode: z.string().min(1).optional(),
  disciplineCode: z.string().min(1).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export class PriceVersionService {
  constructor(private readonly priceVersionRepository: PriceVersionRepository) {}

  async listPriceVersions(input: {
    regionCode?: string;
    disciplineCode?: string;
    status?: PriceVersionRecord["status"];
  }): Promise<PriceVersionRecord[]> {
    return this.priceVersionRepository.list(input);
  }
}
