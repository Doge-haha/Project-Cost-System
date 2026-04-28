import { randomUUID } from "node:crypto";

import { AppError } from "../../shared/errors/app-error.js";
import type { AuditLogService } from "../audit/audit-log-service.js";
import type { BillItemService } from "../bill/bill-item-service.js";
import type { KnowledgeService } from "../knowledge/knowledge-service.js";
import { ProjectAuthorizationService } from "../project/project-authorization-service.js";
import type { ProjectDisciplineRepository } from "../project/project-discipline-repository.js";
import type { ProjectMemberRepository } from "../project/project-member-repository.js";
import type { ProjectRepository } from "../project/project-repository.js";
import type { ProjectStageRepository } from "../project/project-stage-repository.js";
import type { QuotaLineService } from "../quota/quota-line-service.js";
import type { SummaryService } from "../reports/summary-service.js";
import type {
  AiRecommendationRecord,
  AiRecommendationRepository,
  AiRecommendationStatus,
  AiRecommendationType,
} from "./ai-recommendation-repository.js";

type RecommendationContext = {
  projectId: string;
  stageCode?: string;
  disciplineCode?: string;
  userId: string;
};

export class AiRecommendationService {
  constructor(
    private readonly recommendationRepository: AiRecommendationRepository,
    private readonly dependencies: {
      projectRepository: ProjectRepository;
      projectStageRepository: ProjectStageRepository;
      projectDisciplineRepository: ProjectDisciplineRepository;
      projectMemberRepository: ProjectMemberRepository;
      billItemService?: BillItemService;
      quotaLineService?: QuotaLineService;
      summaryService?: SummaryService;
      knowledgeService?: KnowledgeService;
    },
    private readonly auditLogService: AuditLogService,
  ) {}

  async createRecommendation(input: RecommendationContext & {
    resourceType: string;
    resourceId: string;
    recommendationType: AiRecommendationType;
    inputPayload?: Record<string, unknown>;
    outputPayload: Record<string, unknown>;
  }): Promise<AiRecommendationRecord> {
    await this.assertProjectAccess(input, "edit");
    await this.expireSupersededRecommendations(input);
    const createdAt = new Date().toISOString();
    const trace = buildAiAssistTrace({
      inputPayload: input.inputPayload ?? {},
      outputPayload: input.outputPayload,
    });
    const created = await this.recommendationRepository.create({
      projectId: input.projectId,
      stageCode: input.stageCode ?? null,
      disciplineCode: input.disciplineCode ?? null,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      recommendationType: input.recommendationType,
      inputPayload: {
        ...(input.inputPayload ?? {}),
        aiAssistTraceId: trace.aiAssistTraceId,
        aiProvider: trace.aiProvider,
        aiRequestSummary: trace.aiRequestSummary,
      },
      outputPayload: {
        ...input.outputPayload,
        aiAssistTraceId: trace.aiAssistTraceId,
        aiResponseSummary: trace.aiResponseSummary,
      },
      status: "generated",
      createdBy: input.userId,
      handledBy: null,
      handledAt: null,
      statusReason: null,
      createdAt,
      updatedAt: createdAt,
    });

    await this.auditLogService.writeAuditLog({
      projectId: created.projectId,
      stageCode: created.stageCode ?? null,
      resourceType: "ai_recommendation",
      resourceId: created.id,
      action: "generated",
      operatorId: input.userId,
      beforePayload: null,
      afterPayload: {
        recommendationType: created.recommendationType,
        resourceType: created.resourceType,
        resourceId: created.resourceId,
        status: created.status,
        aiAssistTraceId: trace.aiAssistTraceId,
      },
    });

    return created;
  }

  async generateVarianceWarnings(input: RecommendationContext & {
    billVersionId?: string;
    thresholdAmount?: number;
    thresholdRate?: number;
    limit?: number;
  }): Promise<AiRecommendationRecord[]> {
    if (!this.dependencies.summaryService) {
      return [];
    }

    await this.assertProjectAccess(input, "edit");
    const thresholdAmount = input.thresholdAmount ?? 0;
    const thresholdRate = input.thresholdRate ?? 0.1;
    const details = await this.dependencies.summaryService.getSummaryDetails({
      projectId: input.projectId,
      billVersionId: input.billVersionId,
      stageCode: input.stageCode,
      disciplineCode: input.disciplineCode,
      limit: input.limit ?? 20,
      userId: input.userId,
    });

    const warningItems = details.items.filter((item) => {
      const amountExceeded =
        thresholdAmount > 0 && Math.abs(item.varianceAmount) >= thresholdAmount;
      const rateExceeded =
        thresholdRate > 0 && Math.abs(item.varianceRate) >= thresholdRate;
      return amountExceeded || rateExceeded;
    });

    const created: AiRecommendationRecord[] = [];
    for (const item of warningItems) {
      created.push(
        await this.createRecommendation({
          projectId: input.projectId,
          stageCode: item.stageCode,
          disciplineCode: item.disciplineCode,
          resourceType: "bill_item",
          resourceId: item.itemId,
          recommendationType: "variance_warning",
          inputPayload: {
            billVersionId: item.billVersionId,
            thresholdAmount,
            thresholdRate,
          },
          outputPayload: {
            warning: "清单最终金额与系统金额偏差超过阈值",
            itemCode: item.itemCode,
            itemName: item.itemName,
            billVersionId: item.billVersionId,
            versionName: item.versionName,
            systemAmount: item.systemAmount,
            finalAmount: item.finalAmount,
            varianceAmount: item.varianceAmount,
            varianceRate: item.varianceRate,
            varianceShare: item.varianceShare,
            thresholdAmount,
            thresholdRate,
            severity:
              Math.abs(item.varianceRate) >= thresholdRate * 2 ? "high" : "warning",
          },
          userId: input.userId,
        }),
      );
    }

    return created;
  }

  async listRecommendations(input: RecommendationContext & {
    recommendationType?: AiRecommendationType;
    resourceType?: string;
    resourceId?: string;
    status?: AiRecommendationStatus;
    limit?: number;
  }): Promise<AiRecommendationRecord[]> {
    await this.assertProjectAccess(input, "view");
    const recommendations = await this.recommendationRepository.listByProjectId(
      input.projectId,
    );

    return recommendations
      .filter((recommendation) => {
        if (
          input.recommendationType &&
          recommendation.recommendationType !== input.recommendationType
        ) {
          return false;
        }
        if (input.resourceType && recommendation.resourceType !== input.resourceType) {
          return false;
        }
        if (input.resourceId && recommendation.resourceId !== input.resourceId) {
          return false;
        }
        if (input.status && recommendation.status !== input.status) {
          return false;
        }
        if (input.stageCode && recommendation.stageCode !== input.stageCode) {
          return false;
        }
        if (
          input.disciplineCode &&
          recommendation.disciplineCode !== input.disciplineCode
        ) {
          return false;
        }
        return true;
      })
      .slice(0, input.limit ?? 50);
  }

  async transitionRecommendation(input: {
    recommendationId: string;
    status: Exclude<AiRecommendationStatus, "generated">;
    reason?: string;
    userId: string;
  }): Promise<AiRecommendationRecord> {
    const current = await this.recommendationRepository.findById(
      input.recommendationId,
    );
    if (!current) {
      throw new AppError(
        404,
        "AI_RECOMMENDATION_NOT_FOUND",
        "AI recommendation not found",
      );
    }

    await this.assertProjectAccess(
      {
        projectId: current.projectId,
        stageCode: current.stageCode ?? undefined,
        disciplineCode: current.disciplineCode ?? undefined,
        userId: input.userId,
      },
      "edit",
    );

    if (current.status !== "generated") {
      throw new AppError(
        409,
        "AI_RECOMMENDATION_ALREADY_HANDLED",
        "Only generated recommendations can be handled",
      );
    }

    const acceptedOutput =
      input.status === "accepted"
        ? await this.applyAcceptedRecommendation(current, input.userId)
        : null;
    const updatedAt = new Date().toISOString();
    const updated = await this.recommendationRepository.update({
      ...current,
      outputPayload: acceptedOutput
        ? {
            ...current.outputPayload,
            ...acceptedOutput,
          }
        : current.outputPayload,
      status: input.status,
      handledBy: input.userId,
      handledAt: updatedAt,
      statusReason: input.reason ?? null,
      updatedAt,
    });

    await this.auditLogService.writeAuditLog({
      projectId: updated.projectId,
      stageCode: updated.stageCode ?? null,
      resourceType: "ai_recommendation",
      resourceId: updated.id,
      action: input.status,
      operatorId: input.userId,
      beforePayload: {
        status: current.status,
      },
      afterPayload: {
        status: updated.status,
        reason: updated.statusReason,
      },
    });

    await this.persistRecommendationFeedback(updated, input.userId);

    return updated;
  }

  summarizeRecommendations(items: AiRecommendationRecord[]): {
    totalCount: number;
    statusCounts: Record<AiRecommendationStatus, number>;
    typeCounts: Record<AiRecommendationType, number>;
  } {
    return {
      totalCount: items.length,
      statusCounts: countByStatus(items),
      typeCounts: countByType(items),
    };
  }

  private async assertProjectAccess(
    input: RecommendationContext,
    action: "view" | "edit",
  ) {
    const project = await this.dependencies.projectRepository.findById(
      input.projectId,
    );
    if (!project) {
      throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
    }

    const authorizationService = new ProjectAuthorizationService({
      stages: await this.dependencies.projectStageRepository.listByProjectId(
        input.projectId,
      ),
      disciplines:
        await this.dependencies.projectDisciplineRepository.listByProjectId(
          input.projectId,
        ),
      members: await this.dependencies.projectMemberRepository.listByProjectId(
        input.projectId,
      ),
    });

    const allowed =
      action === "view"
        ? authorizationService.canViewContext(input)
        : authorizationService.canEditContext(input);
    if (!allowed) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have permission to access this resource",
      );
    }
  }

  private async expireSupersededRecommendations(input: RecommendationContext & {
    resourceType: string;
    resourceId: string;
    recommendationType: AiRecommendationType;
  }) {
    const now = new Date().toISOString();
    const existing = await this.recommendationRepository.listByProjectId(
      input.projectId,
    );
    const superseded = existing.filter(
      (recommendation) =>
        recommendation.status === "generated" &&
        recommendation.resourceType === input.resourceType &&
        recommendation.resourceId === input.resourceId &&
        recommendation.recommendationType === input.recommendationType,
    );

    for (const recommendation of superseded) {
      const updated = await this.recommendationRepository.update({
        ...recommendation,
        status: "expired",
        handledBy: input.userId,
        handledAt: now,
        statusReason: "superseded_by_new_recommendation",
        updatedAt: now,
      });

      await this.auditLogService.writeAuditLog({
        projectId: updated.projectId,
        stageCode: updated.stageCode ?? null,
        resourceType: "ai_recommendation",
        resourceId: updated.id,
        action: "expired",
        operatorId: input.userId,
        beforePayload: {
          status: recommendation.status,
        },
        afterPayload: {
          status: updated.status,
          reason: updated.statusReason,
        },
      });

      await this.persistRecommendationFeedback(updated, input.userId);
    }
  }

  private async persistRecommendationFeedback(
    recommendation: AiRecommendationRecord,
    operatorId: string,
  ) {
    if (!this.dependencies.knowledgeService) {
      return;
    }

    const persisted =
      await this.dependencies.knowledgeService.persistRecommendationFeedback({
        projectId: recommendation.projectId,
        stageCode: recommendation.stageCode ?? null,
        recommendationId: recommendation.id,
        recommendationType: recommendation.recommendationType,
        resourceType: recommendation.resourceType,
        resourceId: recommendation.resourceId,
        status: recommendation.status as Exclude<
          AiRecommendationStatus,
          "generated"
        >,
        reason: recommendation.statusReason,
        operatorId,
        outputPayload: recommendation.outputPayload,
      });

    await this.auditLogService.writeAuditLog({
      projectId: recommendation.projectId,
      stageCode: recommendation.stageCode ?? null,
      resourceType: "ai_recommendation",
      resourceId: recommendation.id,
      action: "feedback_persisted",
      operatorId,
      beforePayload: null,
      afterPayload: {
        status: recommendation.status,
        knowledgeEntryId: persisted.knowledgeEntry.id,
        memoryEntryIds: persisted.memoryEntries.map((entry) => entry.id),
      },
    });
  }

  private async applyAcceptedRecommendation(
    recommendation: AiRecommendationRecord,
    userId: string,
  ): Promise<Record<string, string> | null> {
    if (
      recommendation.recommendationType === "bill_recommendation" &&
      recommendation.resourceType === "bill_version"
    ) {
      return this.applyAcceptedBillRecommendation(recommendation, userId);
    }

    if (
      recommendation.recommendationType !== "quota_recommendation" ||
      recommendation.resourceType !== "bill_item"
    ) {
      return null;
    }

    if (!this.dependencies.quotaLineService) {
      return null;
    }

    const payload = recommendation.outputPayload;
    const billVersionId = readString(payload, "billVersionId");
    if (!billVersionId) {
      throw new AppError(
        422,
        "AI_RECOMMENDATION_ACCEPT_PAYLOAD_INCOMPLETE",
        "Quota recommendation acceptance requires billVersionId",
      );
    }

    const created = await this.dependencies.quotaLineService.createQuotaLine({
      projectId: recommendation.projectId,
      billVersionId,
      billItemId: recommendation.resourceId,
      sourceStandardSetCode: readRequiredString(
        payload,
        "sourceStandardSetCode",
      ),
      sourceQuotaId: readRequiredString(payload, "sourceQuotaId"),
      sourceSequence: readNullableNumber(payload, "sourceSequence"),
      chapterCode: readRequiredString(payload, "chapterCode"),
      quotaCode: readRequiredString(payload, "quotaCode"),
      quotaName: readRequiredString(payload, "quotaName"),
      unit: readRequiredString(payload, "unit"),
      quantity: readRequiredNumber(payload, "quantity"),
      laborFee: readNullableNumber(payload, "laborFee"),
      materialFee: readNullableNumber(payload, "materialFee"),
      machineFee: readNullableNumber(payload, "machineFee"),
      contentFactor: readNullableNumber(payload, "contentFactor") ?? 1,
      sourceMode: "ai",
      userId,
    });

    return { acceptedQuotaLineId: created.id };
  }

  private async applyAcceptedBillRecommendation(
    recommendation: AiRecommendationRecord,
    userId: string,
  ): Promise<Record<string, string> | null> {
    if (!this.dependencies.billItemService) {
      return null;
    }

    const payload = recommendation.outputPayload;
    const created = await this.dependencies.billItemService.createBillItem({
      projectId: recommendation.projectId,
      billVersionId: recommendation.resourceId,
      parentId: readNullableString(payload, "parentId"),
      itemCode: readRequiredStringWithLabel(
        payload,
        "itemCode",
        "Bill recommendation acceptance",
      ),
      itemName: readRequiredStringWithLabel(
        payload,
        "itemName",
        "Bill recommendation acceptance",
      ),
      quantity: readRequiredNumberWithLabel(
        payload,
        "quantity",
        "Bill recommendation acceptance",
      ),
      unit: readRequiredStringWithLabel(
        payload,
        "unit",
        "Bill recommendation acceptance",
      ),
      sortNo: readRequiredIntegerWithLabel(
        payload,
        "sortNo",
        "Bill recommendation acceptance",
      ),
      userId,
    });

    return { acceptedBillItemId: created.id };
  }
}

function readString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function buildAiAssistTrace(input: {
  inputPayload: Record<string, unknown>;
  outputPayload: Record<string, unknown>;
}) {
  const provider = readAiProvider(input.inputPayload);
  return {
    aiAssistTraceId: `ai-trace-${randomUUID()}`,
    aiProvider: provider,
    aiRequestSummary: summarizePayload(input.inputPayload),
    aiResponseSummary: summarizePayload(input.outputPayload),
  };
}

function readAiProvider(payload: Record<string, unknown>): {
  provider: string;
  model: string;
} {
  const providerPayload =
    payload.aiProvider &&
    typeof payload.aiProvider === "object" &&
    !Array.isArray(payload.aiProvider)
      ? (payload.aiProvider as Record<string, unknown>)
      : {};
  const provider =
    typeof providerPayload.provider === "string" && providerPayload.provider.length > 0
      ? providerPayload.provider
      : "manual";
  const model =
    typeof providerPayload.model === "string" && providerPayload.model.length > 0
      ? providerPayload.model
      : "manual_payload";

  return {
    provider,
    model,
  };
}

function summarizePayload(payload: Record<string, unknown>): {
  payloadKeys: string[];
  valueCount: number;
} {
  const payloadKeys = Object.keys(payload)
    .filter((key) => !["aiAssistTraceId", "aiProvider", "aiRequestSummary", "aiResponseSummary"].includes(key))
    .sort();
  return {
    payloadKeys,
    valueCount: payloadKeys.length,
  };
}

function readNullableString(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  const value = payload[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readRequiredString(payload: Record<string, unknown>, key: string): string {
  return readRequiredStringWithLabel(
    payload,
    key,
    "Quota recommendation acceptance",
  );
}

function readRequiredStringWithLabel(
  payload: Record<string, unknown>,
  key: string,
  label: string,
): string {
  const value = readString(payload, key);
  if (!value) {
    throw new AppError(
      422,
      "AI_RECOMMENDATION_ACCEPT_PAYLOAD_INCOMPLETE",
      `${label} requires ${key}`,
    );
  }
  return value;
}

function readNullableNumber(
  payload: Record<string, unknown>,
  key: string,
): number | null {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readRequiredNumber(payload: Record<string, unknown>, key: string): number {
  return readRequiredNumberWithLabel(
    payload,
    key,
    "Quota recommendation acceptance",
  );
}

function readRequiredNumberWithLabel(
  payload: Record<string, unknown>,
  key: string,
  label: string,
): number {
  const value = readNullableNumber(payload, key);
  if (value === null || value <= 0) {
    throw new AppError(
      422,
      "AI_RECOMMENDATION_ACCEPT_PAYLOAD_INCOMPLETE",
      `${label} requires ${key}`,
    );
  }
  return value;
}

function readRequiredIntegerWithLabel(
  payload: Record<string, unknown>,
  key: string,
  label: string,
): number {
  const value = readNullableNumber(payload, key);
  if (value === null || value <= 0 || !Number.isInteger(value)) {
    throw new AppError(
      422,
      "AI_RECOMMENDATION_ACCEPT_PAYLOAD_INCOMPLETE",
      `${label} requires ${key}`,
    );
  }
  return value;
}

function countByStatus(items: AiRecommendationRecord[]) {
  return {
    generated: items.filter((item) => item.status === "generated").length,
    accepted: items.filter((item) => item.status === "accepted").length,
    ignored: items.filter((item) => item.status === "ignored").length,
    expired: items.filter((item) => item.status === "expired").length,
  };
}

function countByType(items: AiRecommendationRecord[]) {
  return {
    bill_recommendation: items.filter(
      (item) => item.recommendationType === "bill_recommendation",
    ).length,
    quota_recommendation: items.filter(
      (item) => item.recommendationType === "quota_recommendation",
    ).length,
    variance_warning: items.filter(
      (item) => item.recommendationType === "variance_warning",
    ).length,
  };
}
