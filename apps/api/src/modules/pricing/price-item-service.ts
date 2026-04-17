import { z } from "zod";

import { AppError } from "../../shared/errors/app-error.js";
import type {
  PriceItemRecord,
  PriceItemRepository,
} from "./price-item-repository.js";
import type { PriceVersionRepository } from "./price-version-repository.js";

export const listPriceItemSchema = z.object({
  quotaCode: z.string().min(1).optional(),
});

type Dependencies = {
  priceVersionRepository: PriceVersionRepository;
};

export class PriceItemService {
  constructor(
    private readonly priceItemRepository: PriceItemRepository,
    private readonly dependencies: Dependencies,
  ) {}

  async listPriceItems(input: {
    priceVersionId: string;
    quotaCode?: string;
  }): Promise<PriceItemRecord[]> {
    const priceVersion = await this.dependencies.priceVersionRepository.list({
      status: undefined,
    });
    const exists = priceVersion.some((item) => item.id === input.priceVersionId);
    if (!exists) {
      throw new AppError(404, "PRICE_VERSION_NOT_FOUND", "Price version not found");
    }

    return this.priceItemRepository.listByPriceVersionId(input);
  }
}
