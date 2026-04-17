import { z } from "zod";

import { AppError } from "../../shared/errors/app-error.js";
import type {
  FeeTemplateRecord,
  FeeTemplateRepository,
} from "./fee-template-repository.js";
import type { FeeRuleRepository } from "./fee-rule-repository.js";

export const listFeeTemplateSchema = z.object({
  regionCode: z.string().min(1).optional(),
  projectType: z.string().min(1).optional(),
  stageCode: z.string().min(1).optional(),
  status: z.enum(["draft", "active", "inactive"]).optional(),
});

export class FeeTemplateService {
  constructor(
    private readonly feeTemplateRepository: FeeTemplateRepository,
    private readonly feeRuleRepository: FeeRuleRepository,
  ) {}

  async listFeeTemplates(input: {
    regionCode?: string;
    projectType?: string;
    stageCode?: string;
    status?: FeeTemplateRecord["status"];
  }): Promise<FeeTemplateRecord[]> {
    return this.feeTemplateRepository.list(input);
  }

  async getFeeTemplate(feeTemplateId: string): Promise<
    FeeTemplateRecord & {
      rules: Awaited<ReturnType<FeeRuleRepository["listByFeeTemplateId"]>>;
    }
  > {
    const feeTemplate = await this.feeTemplateRepository.findById(feeTemplateId);
    if (!feeTemplate) {
      throw new AppError(404, "FEE_TEMPLATE_NOT_FOUND", "Fee template not found");
    }

    const rules = await this.feeRuleRepository.listByFeeTemplateId(feeTemplateId);
    return {
      ...feeTemplate,
      rules,
    };
  }
}
