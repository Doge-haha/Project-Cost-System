import { randomUUID } from "node:crypto";

import { AppError } from "../../shared/errors/app-error.js";
import type { AuditLogService } from "../audit/audit-log-service.js";
import type { BillItemRepository } from "../bill/bill-item-repository.js";
import type { BillItemService } from "../bill/bill-item-service.js";
import type { BillVersionRepository } from "../bill/bill-version-repository.js";
import type { KnowledgeService } from "../knowledge/knowledge-service.js";
import { ProjectAuthorizationService } from "../project/project-authorization-service.js";
import type { ProjectDisciplineRepository } from "../project/project-discipline-repository.js";
import type { ProjectMemberRepository } from "../project/project-member-repository.js";
import type { ProjectRepository } from "../project/project-repository.js";
import type { ProjectStageRepository } from "../project/project-stage-repository.js";
import type { QuotaLineRepository } from "../quota/quota-line-repository.js";
import type {
  QuotaLineService,
  QuotaSourceCandidateRecord,
} from "../quota/quota-line-service.js";
import type { SummaryService } from "../reports/summary-service.js";
import type {
  AiRecommendationRecord,
  AiRecommendationRepository,
  AiRecommendationStatus,
  AiRecommendationType,
} from "./ai-recommendation-repository.js";
import type {
  VarianceWarningThresholdRecord,
  VarianceWarningThresholdRepository,
} from "./variance-warning-threshold-repository.js";
import type { AiRuntimePreviewService } from "./ai-runtime-preview-service.js";

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
      billVersionRepository?: BillVersionRepository;
      billItemRepository?: BillItemRepository;
      quotaLineRepository?: QuotaLineRepository;
      billItemService?: BillItemService;
      quotaLineService?: QuotaLineService;
      summaryService?: SummaryService;
      knowledgeService?: KnowledgeService;
      varianceWarningThresholdRepository?: VarianceWarningThresholdRepository;
      aiRuntimePreviewService?: AiRuntimePreviewService;
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
    const inputPayload = {
      ...(await this.buildRecommendationInputContext({
        projectId: input.projectId,
        stageCode: input.stageCode,
        disciplineCode: input.disciplineCode,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        recommendationType: input.recommendationType,
        userId: input.userId,
      })),
      ...(input.inputPayload ?? {}),
    };
    const createdAt = new Date().toISOString();
    const trace = buildAiAssistTrace({
      inputPayload,
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
        ...inputPayload,
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

  async generateProviderRecommendations(input: RecommendationContext & {
    recommendationType: AiRecommendationType;
    resourceType?: string;
    resourceId?: string;
    billVersionId?: string;
    thresholdAmount?: number;
    thresholdRate?: number;
    limit?: number;
    provider?: string;
    model?: string;
    inputPayload?: Record<string, unknown>;
    outputPayload?: Record<string, unknown>;
  }): Promise<{
    recommendations: AiRecommendationRecord[];
    provider: Record<string, unknown> | null;
    telemetry: Record<string, unknown>;
    createdCount: number;
  }> {
    if (input.recommendationType === "variance_warning") {
      const recommendations = await this.generateVarianceWarnings({
        projectId: input.projectId,
        stageCode: input.stageCode,
        disciplineCode: input.disciplineCode,
        billVersionId: input.billVersionId,
        thresholdAmount: input.thresholdAmount,
        thresholdRate: input.thresholdRate,
        limit: input.limit,
        userId: input.userId,
      });
      return {
        recommendations,
        provider: { provider: "rules_engine", model: "variance_thresholds" },
        telemetry: { durationMs: 0, retryCount: 0 },
        createdCount: recommendations.length,
      };
    }

    if (input.recommendationType === "bill_recommendation") {
      const recommendations = await this.generateBillRecommendationCandidates(
        input,
      );
      if (recommendations.length > 0) {
        const provider = readAiProvider(recommendations[0].inputPayload);
        return {
          recommendations,
          provider: {
            provider: provider.provider,
            model: provider.model,
          },
          telemetry: { durationMs: 0, retryCount: 0 },
          createdCount: recommendations.length,
        };
      }
    }

    if (input.recommendationType === "quota_recommendation") {
      const recommendations = await this.generateQuotaRecommendationCandidates(
        input,
      );
      if (recommendations.length > 0) {
        const provider = readAiProvider(recommendations[0].inputPayload);
        return {
          recommendations,
          provider: {
            provider: provider.provider,
            model: provider.model,
          },
          telemetry: { durationMs: 0, retryCount: 0 },
          createdCount: recommendations.length,
        };
      }
    }

    if (input.outputPayload && Object.keys(input.outputPayload).length > 0) {
      const created = await this.createRecommendation({
        projectId: input.projectId,
        stageCode: input.stageCode,
        disciplineCode: input.disciplineCode,
        resourceType: readRequiredJobString(input.resourceType, "resourceType"),
        resourceId: readRequiredJobString(input.resourceId, "resourceId"),
        recommendationType: input.recommendationType,
        inputPayload: input.inputPayload,
        outputPayload: input.outputPayload,
        userId: input.userId,
      });
      return {
        recommendations: [created],
        provider: readAiProvider(created.inputPayload),
        telemetry: { durationMs: 0, retryCount: 0 },
        createdCount: 1,
      };
    }

    if (!this.dependencies.aiRuntimePreviewService) {
      throw new AppError(
        500,
        "AI_PROVIDER_NOT_CONFIGURED",
        "AI provider runtime is not configured",
      );
    }

    const context = await this.buildRecommendationInputContext({
      projectId: input.projectId,
      stageCode: input.stageCode,
      disciplineCode: input.disciplineCode,
      recommendationType: input.recommendationType,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      billVersionId: input.billVersionId,
      userId: input.userId,
    });
    const requestStartedAt = Date.now();
    let llmResult: Record<string, unknown>;
    try {
      llmResult = await this.dependencies.aiRuntimePreviewService.processLlmChat({
        provider: input.provider,
        model: input.model,
        messages: [
          {
            role: "system",
            content:
              "You generate SaaS pricing AI recommendations. Return strict JSON with a recommendations array; each item must contain outputPayload.",
          },
          {
            role: "user",
            content: JSON.stringify({
              recommendationType: input.recommendationType,
              resourceType: input.resourceType,
              resourceId: input.resourceId,
              context,
              inputPayload: input.inputPayload ?? {},
            }),
          },
        ],
        temperature: 0.2,
        maxTokens: 1200,
      });
    } catch (error) {
      const failureSummary = buildProviderFailureSummary(error, {
        provider: input.provider ?? "openai_compatible",
        model: input.model ?? null,
        durationMs: Date.now() - requestStartedAt,
      });
      await this.auditLogService.writeAuditLog({
        projectId: input.projectId,
        stageCode: input.stageCode ?? null,
        resourceType: "ai_provider",
        resourceId: input.recommendationType,
        action: "request_failed",
        operatorId: input.userId,
        afterPayload: failureSummary,
      });
      throw new AppError(
        error instanceof AppError ? error.statusCode : 502,
        "AI_PROVIDER_REQUEST_FAILED",
        "AI provider request failed; manual handling may be required",
        { providerFailureSummary: failureSummary },
      );
    }
    const providerResult = readObject(llmResult, "result");
    const provider = readObject(providerResult, "provider");
    const telemetry = readObject(providerResult, "telemetry");
    await this.auditLogService.writeAuditLog({
      projectId: input.projectId,
      stageCode: input.stageCode ?? null,
      resourceType: "ai_provider",
      resourceId: input.recommendationType,
      action: "request_completed",
      operatorId: input.userId,
      afterPayload: {
        provider: provider ?? {
          provider: input.provider ?? "openai_compatible",
          model: input.model ?? null,
        },
        telemetry: telemetry ?? { durationMs: Date.now() - requestStartedAt },
      },
    });
    let recommendations: Array<{
      resourceType?: string;
      resourceId?: string;
      outputPayload: Record<string, unknown>;
    }>;
    try {
      const content = readRequiredStringFromObject(providerResult, "content");
      recommendations = parseProviderRecommendations(
        content,
        input.recommendationType,
      );
    } catch (error) {
      const failureSummary = buildProviderFailureSummary(error, {
        provider:
          readString(provider ?? {}, "provider") ??
          input.provider ??
          "openai_compatible",
        model: readString(provider ?? {}, "model") ?? input.model ?? null,
        durationMs: Date.now() - requestStartedAt,
      });
      await this.auditLogService.writeAuditLog({
        projectId: input.projectId,
        stageCode: input.stageCode ?? null,
        resourceType: "ai_provider",
        resourceId: input.recommendationType,
        action: "response_invalid",
        operatorId: input.userId,
        afterPayload: failureSummary,
      });
      throw new AppError(
        error instanceof AppError ? error.statusCode : 502,
        "AI_PROVIDER_RESPONSE_INVALID",
        "AI provider response is invalid; manual handling may be required",
        { providerFailureSummary: failureSummary },
      );
    }
    const created: AiRecommendationRecord[] = [];
    for (const recommendation of recommendations.slice(0, input.limit ?? 10)) {
      created.push(
        await this.createRecommendation({
          projectId: input.projectId,
          stageCode: input.stageCode,
          disciplineCode: input.disciplineCode,
          resourceType:
            recommendation.resourceType ??
            readRequiredJobString(input.resourceType, "resourceType"),
          resourceId:
            recommendation.resourceId ??
            readRequiredJobString(input.resourceId, "resourceId"),
          recommendationType: input.recommendationType,
          inputPayload: {
            ...(input.inputPayload ?? {}),
            aiProvider: {
              provider:
                readString(provider ?? {}, "provider") ??
                input.provider ??
                "openai_compatible",
              model:
                readString(provider ?? {}, "model") ?? input.model ?? "unknown",
            },
            providerGenerated: true,
          },
          outputPayload: recommendation.outputPayload,
          userId: input.userId,
        }),
      );
    }

    return {
      recommendations: created,
      provider: provider ?? null,
      telemetry: telemetry ?? { durationMs: Date.now() - requestStartedAt },
      createdCount: created.length,
    };
  }

  async checkProviderHealth(input: {
    provider?: string;
    model?: string;
    userId: string;
  }): Promise<Record<string, unknown>> {
    if (!this.dependencies.aiRuntimePreviewService) {
      return {
        configured: false,
        healthy: false,
        message: "AI provider runtime is not configured",
      };
    }

    try {
      const result = await this.dependencies.aiRuntimePreviewService.checkLlmProvider({
        provider: input.provider,
        model: input.model,
      });
      const providerResult = readObject(result, "result") ?? {};
      return providerResult;
    } catch (error) {
      const failureSummary = buildProviderFailureSummary(error, {
        provider: input.provider ?? "openai_compatible",
        model: input.model ?? null,
        durationMs: 0,
      });
      return {
        configured: false,
        healthy: false,
        failureSummary,
      };
    }
  }

  private async generateBillRecommendationCandidates(
    input: RecommendationContext & {
      resourceType?: string;
      resourceId?: string;
      limit?: number;
      inputPayload?: Record<string, unknown>;
    },
  ): Promise<AiRecommendationRecord[]> {
    if (input.resourceType !== "bill_version" || !input.resourceId) {
      return [];
    }

    const sourceChain = await this.buildBillVersionSourceChain(input.resourceId);
    const currentVersion = sourceChain[0] ?? null;
    const sourceVersion = sourceChain[1] ?? null;
    if (!currentVersion || !sourceVersion) {
      if (currentVersion) {
        const emptyItems =
          (await this.dependencies.billItemRepository?.listByBillVersionId(
            currentVersion.id,
          )) ?? [];
        if (emptyItems.length === 0) {
          return [
            await this.createRecommendation({
              projectId: input.projectId,
              stageCode: currentVersion.stageCode,
              disciplineCode: currentVersion.disciplineCode,
              resourceType: "bill_version",
              resourceId: currentVersion.id,
              recommendationType: "bill_recommendation",
              inputPayload: {
                ...(input.inputPayload ?? {}),
                sourceBillVersionId: null,
                aiProvider: {
                  provider: "rules_engine",
                  model: "bill_version_missing_items",
                },
              },
              outputPayload: {
                parentId: null,
                itemCode: "AI-MISSING-001",
                itemName: "待补充清单项",
                quantity: 1,
                unit: "项",
                sortNo: 1,
                recommendationReason: "empty_bill_version_missing_item",
              },
              userId: input.userId,
            }),
          ];
        }
      }
      return [];
    }

    await this.assertProjectAccess(
      {
        projectId: input.projectId,
        stageCode: currentVersion.stageCode,
        disciplineCode: currentVersion.disciplineCode,
        userId: input.userId,
      },
      "edit",
    );

    const [currentItems, sourceItems] = await Promise.all([
      this.dependencies.billItemRepository?.listByBillVersionId(currentVersion.id) ??
        Promise.resolve([]),
      this.dependencies.billItemRepository?.listByBillVersionId(sourceVersion.id) ??
        Promise.resolve([]),
    ]);
    const currentItemCodes = new Set(currentItems.map((item) => item.itemCode));
    const missingItems = sourceItems
      .filter((item) => !currentItemCodes.has(item.itemCode))
      .sort((left, right) => left.sortNo - right.sortNo)
      .slice(0, input.limit ?? 10);

    const created: AiRecommendationRecord[] = [];
    for (const item of missingItems) {
      created.push(
        await this.createRecommendation({
          projectId: input.projectId,
          stageCode: currentVersion.stageCode,
          disciplineCode: currentVersion.disciplineCode,
          resourceType: "bill_version",
          resourceId: currentVersion.id,
          recommendationType: "bill_recommendation",
          inputPayload: {
            ...(input.inputPayload ?? {}),
            sourceBillVersionId: sourceVersion.id,
            aiProvider: {
              provider: "rules_engine",
              model: "bill_version_source_diff",
            },
          },
          outputPayload: {
            parentId: null,
            itemCode: item.itemCode,
            itemName: item.itemName,
            quantity: item.quantity,
            unit: item.unit,
            sortNo: item.sortNo,
            sourceBillItemId: item.id,
            recommendationReason: "source_version_missing_item",
          },
          userId: input.userId,
        }),
      );
    }

    return created;
  }

  private async generateQuotaRecommendationCandidates(
    input: RecommendationContext & {
      resourceType?: string;
      resourceId?: string;
      limit?: number;
      inputPayload?: Record<string, unknown>;
    },
  ): Promise<AiRecommendationRecord[]> {
    if (
      input.resourceType !== "bill_item" ||
      !input.resourceId ||
      !this.dependencies.quotaLineService
    ) {
      return [];
    }

    const billItem = await this.dependencies.billItemRepository?.findById(
      input.resourceId,
    );
    if (!billItem) {
      return [];
    }

    const billVersion = await this.dependencies.billVersionRepository?.findById(
      billItem.billVersionId,
    );
    if (!billVersion) {
      return [];
    }

    await this.assertProjectAccess(
      {
        projectId: input.projectId,
        stageCode: billVersion.stageCode,
        disciplineCode: billVersion.disciplineCode,
        userId: input.userId,
      },
      "edit",
    );

    const [existingQuotaLines, candidates] = await Promise.all([
      this.dependencies.quotaLineRepository?.listByBillItemId(billItem.id) ??
        Promise.resolve([]),
      this.dependencies.quotaLineService.listQuotaSourceCandidates({
        projectId: input.projectId,
        userId: input.userId,
        disciplineCode: billVersion.disciplineCode,
        keyword: billItem.itemName,
      }),
    ]);
    const existingSources = new Set(
      existingQuotaLines.map((line) =>
        [line.sourceStandardSetCode, line.sourceQuotaId].join(":"),
      ),
    );
    const freshCandidates = candidates
      .filter(
        (candidate) =>
          !existingSources.has(
            [candidate.sourceStandardSetCode, candidate.sourceQuotaId].join(":"),
          ),
      )
      .slice(0, input.limit ?? 10);

    if (freshCandidates.length === 0 && existingQuotaLines.length === 0) {
      return [
        await this.createRecommendation({
          projectId: input.projectId,
          stageCode: billVersion.stageCode,
          disciplineCode: billVersion.disciplineCode,
          resourceType: "bill_item",
          resourceId: billItem.id,
          recommendationType: "quota_recommendation",
          inputPayload: {
            ...(input.inputPayload ?? {}),
            billVersionId: billVersion.id,
            existingQuotaLineCount: 0,
            aiProvider: {
              provider: "rules_engine",
              model: "quota_missing_prompt",
            },
          },
          outputPayload: buildMissingQuotaPromptPayload(
            billVersion.id,
            billItem.itemCode,
            billItem.itemName,
          ),
          userId: input.userId,
        }),
      ];
    }

    const created: AiRecommendationRecord[] = [];
    for (const candidate of freshCandidates) {
      created.push(
        await this.createRecommendation({
          projectId: input.projectId,
          stageCode: billVersion.stageCode,
          disciplineCode: billVersion.disciplineCode,
          resourceType: "bill_item",
          resourceId: billItem.id,
          recommendationType: "quota_recommendation",
          inputPayload: {
            ...(input.inputPayload ?? {}),
            billVersionId: billVersion.id,
            existingQuotaLineCount: existingQuotaLines.length,
            aiProvider: {
              provider: "rules_engine",
              model: "quota_source_candidates",
            },
          },
          outputPayload: buildQuotaRecommendationPayload(
            billVersion.id,
            billItem.quantity,
            candidate,
            existingQuotaLines.length === 0
              ? "bill_item_missing_quota"
              : "bill_item_alternative_quota",
          ),
          userId: input.userId,
        }),
      );
    }

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
    const thresholds = await this.resolveVarianceThresholds({
      projectId: input.projectId,
      stageCode: input.stageCode,
      disciplineCode: input.disciplineCode,
      thresholdAmount: input.thresholdAmount,
      thresholdRate: input.thresholdRate,
    });
    const thresholdAmount = thresholds.thresholdAmount;
    const thresholdRate = thresholds.thresholdRate;
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
            thresholdScope: thresholds.scope,
            contextType: "variance_warning",
          },
          outputPayload: {
            warning: "清单最终金额与系统金额偏差超过阈值",
            warningScope: "bill_item",
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

    const [disciplineBreakdown, unitBreakdown] = await Promise.all([
      this.dependencies.summaryService.getVarianceBreakdown({
        projectId: input.projectId,
        groupBy: "discipline",
        billVersionId: input.billVersionId,
        stageCode: input.stageCode,
        disciplineCode: input.disciplineCode,
        userId: input.userId,
      }),
      this.dependencies.summaryService.getVarianceBreakdown({
        projectId: input.projectId,
        groupBy: "unit",
        billVersionId: input.billVersionId,
        stageCode: input.stageCode,
        disciplineCode: input.disciplineCode,
        userId: input.userId,
      }),
    ]);
    for (const item of [...disciplineBreakdown.items, ...unitBreakdown.items]) {
      if (!isVarianceExceeded(item, thresholdAmount, thresholdRate)) {
        continue;
      }
      const isDiscipline = disciplineBreakdown.items.includes(item);
      created.push(
        await this.createRecommendation({
          projectId: input.projectId,
          stageCode: input.stageCode,
          disciplineCode: isDiscipline ? item.groupKey : input.disciplineCode,
          resourceType: isDiscipline ? "discipline" : "unit",
          resourceId: item.groupKey,
          recommendationType: "variance_warning",
          inputPayload: {
            billVersionId: input.billVersionId,
            thresholdAmount,
            thresholdRate,
            thresholdScope: thresholds.scope,
            contextType: isDiscipline ? "variance_by_discipline" : "variance_by_unit",
          },
          outputPayload: {
            warning: isDiscipline ? "专业级偏差超过阈值" : "单体级偏差超过阈值",
            warningScope: isDiscipline ? "discipline" : "unit",
            groupKey: item.groupKey,
            groupLabel: item.groupLabel,
            totalSystemAmount: item.totalSystemAmount,
            totalFinalAmount: item.totalFinalAmount,
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

    const version = input.billVersionId
      ? await this.dependencies.billVersionRepository?.findById(input.billVersionId)
      : null;
    if (version?.sourceVersionId) {
      const comparison = await this.dependencies.summaryService.compareVersions({
        projectId: input.projectId,
        baseBillVersionId: version.sourceVersionId,
        targetBillVersionId: version.id,
        userId: input.userId,
      });
      for (const item of comparison.items) {
        const varianceAmount = Math.abs(item.finalVarianceAmount);
        const baseAmount = Math.abs(item.baseFinalAmount);
        const varianceRate = baseAmount > 0 ? varianceAmount / baseAmount : 0;
        if (
          !(
            (thresholdAmount > 0 && varianceAmount >= thresholdAmount) ||
            (thresholdRate > 0 && varianceRate >= thresholdRate)
          )
        ) {
          continue;
        }
        created.push(
          await this.createRecommendation({
            projectId: input.projectId,
            stageCode: version.stageCode,
            disciplineCode: version.disciplineCode,
            resourceType: "bill_version",
            resourceId: version.id,
            recommendationType: "variance_warning",
            inputPayload: {
              baseBillVersionId: comparison.baseBillVersionId,
              targetBillVersionId: comparison.targetBillVersionId,
              thresholdAmount,
              thresholdRate,
              thresholdScope: thresholds.scope,
              contextType: "upstream_version_compare",
            },
            outputPayload: {
              warning: "当前版本与上游版本偏差超过阈值",
              warningScope: "upstream_version",
              itemCode: item.itemCode,
              itemNameBase: item.itemNameBase,
              itemNameTarget: item.itemNameTarget,
              baseVersionName: comparison.baseVersionName,
              targetVersionName: comparison.targetVersionName,
              baseFinalAmount: item.baseFinalAmount,
              targetFinalAmount: item.targetFinalAmount,
              varianceAmount,
              varianceRate,
              thresholdAmount,
              thresholdRate,
              severity: varianceRate >= thresholdRate * 2 ? "high" : "warning",
            },
            userId: input.userId,
          }),
        );
      }
    }

    return created;
  }

  async buildRecommendationInputContext(input: RecommendationContext & {
    recommendationType: AiRecommendationType;
    resourceType?: string;
    resourceId?: string;
    billVersionId?: string;
  }): Promise<Record<string, unknown>> {
    await this.assertProjectAccess(input, "view");
    const [project, stages, disciplines, memories] = await Promise.all([
      this.dependencies.projectRepository.findById(input.projectId),
      this.dependencies.projectStageRepository.listByProjectId(input.projectId),
      this.dependencies.projectDisciplineRepository.listByProjectId(input.projectId),
      this.dependencies.knowledgeService
        ? this.dependencies.knowledgeService.listMemoryEntries({
            projectId: input.projectId,
            stageCode: input.stageCode,
            subjectType: "ai_runtime",
            limit: 5,
            userId: input.userId,
          })
        : Promise.resolve([]),
    ]);
    const base = {
      contextType: input.recommendationType,
      project: project
        ? {
            id: project.id,
            code: project.code,
            name: project.name,
            defaultPriceVersionId: project.defaultPriceVersionId ?? null,
            defaultFeeTemplateId: project.defaultFeeTemplateId ?? null,
          }
        : null,
      stageCode: input.stageCode ?? null,
      disciplineCode: input.disciplineCode ?? null,
      stages: stages.map(({ stageCode, stageName, status, sequenceNo }) => ({
        stageCode,
        stageName,
        status,
        sequenceNo,
      })),
      disciplines: disciplines.map(
        ({ disciplineCode, disciplineName, defaultStandardSetCode, status }) => ({
          disciplineCode,
          disciplineName,
          defaultStandardSetCode,
          status,
        }),
      ),
      memoryHints: memories.map((memory) => ({
        memoryKey: memory.memoryKey,
        content: memory.content,
      })),
    };

    if (
      input.recommendationType === "bill_recommendation" &&
      input.resourceType === "bill_version" &&
      input.resourceId
    ) {
      const sourceChain = await this.buildBillVersionSourceChain(input.resourceId);
      const currentVersion = sourceChain[0] ?? null;
      const currentItems = currentVersion
        ? await this.dependencies.billItemRepository?.listByBillVersionId(
            currentVersion.id,
          )
        : [];
      const sourceItems = await Promise.all(
        sourceChain.slice(1).map(async (version) => ({
          billVersionId: version.id,
          versionName: version.versionName,
          items:
            await this.dependencies.billItemRepository?.listByBillVersionId(
              version.id,
            ) ?? [],
        })),
      );
      return {
        ...base,
        currentVersion,
        currentItemCount: currentItems?.length ?? 0,
        currentItems:
          currentItems?.map(({ id, itemCode, itemName, quantity, unit, sortNo }) => ({
            id,
            itemCode,
            itemName,
            quantity,
            unit,
            sortNo,
          })) ?? [],
        sourceChain,
        sourceItems,
      };
    }

    if (
      input.recommendationType === "quota_recommendation" &&
      input.resourceType === "bill_item" &&
      input.resourceId
    ) {
      const billItem = await this.dependencies.billItemRepository?.findById(
        input.resourceId,
      );
      const billVersion = billItem
        ? await this.dependencies.billVersionRepository?.findById(
            billItem.billVersionId,
          )
        : null;
      const existingQuotaLines = billItem
        ? await this.dependencies.quotaLineRepository?.listByBillItemId(billItem.id)
        : [];
      const candidates =
        billItem && this.dependencies.quotaLineService
          ? await this.dependencies.quotaLineService.listQuotaSourceCandidates({
              projectId: input.projectId,
              userId: input.userId,
              disciplineCode: billVersion?.disciplineCode,
              keyword: billItem.itemName,
            })
          : [];
      return {
        ...base,
        billVersion,
        billItem,
        existingQuotaLines: existingQuotaLines ?? [],
        quotaCandidates: candidates.slice(0, 10),
      };
    }

    if (input.recommendationType === "variance_warning") {
      const thresholds = await this.resolveVarianceThresholds({
        projectId: input.projectId,
        stageCode: input.stageCode,
        disciplineCode: input.disciplineCode,
      });
      const billVersionId = input.billVersionId ?? input.resourceId;
      const details = this.dependencies.summaryService
        ? await this.dependencies.summaryService.getSummaryDetails({
            projectId: input.projectId,
            billVersionId,
            stageCode: input.stageCode,
            disciplineCode: input.disciplineCode,
            limit: 10,
            userId: input.userId,
          })
        : null;
      return {
        ...base,
        thresholdAmount: thresholds.thresholdAmount,
        thresholdRate: thresholds.thresholdRate,
        thresholdScope: thresholds.scope,
        summaryDetails: details,
      };
    }

    return base;
  }

  async listVarianceWarningThresholds(input: RecommendationContext): Promise<
    VarianceWarningThresholdRecord[]
  > {
    await this.assertProjectAccess(input, "view");
    const thresholds =
      await this.dependencies.varianceWarningThresholdRepository?.listByProjectId(
        input.projectId,
      );

    return (thresholds ?? []).filter((threshold) => {
      if (input.stageCode && threshold.stageCode !== input.stageCode) {
        return false;
      }
      if (
        input.disciplineCode &&
        threshold.disciplineCode !== input.disciplineCode
      ) {
        return false;
      }
      return true;
    });
  }

  async configureVarianceWarningThreshold(input: RecommendationContext & {
    thresholdAmount: number;
    thresholdRate: number;
  }): Promise<VarianceWarningThresholdRecord> {
    await this.assertProjectAccess(input, "edit");
    if (!this.dependencies.varianceWarningThresholdRepository) {
      throw new AppError(
        500,
        "VARIANCE_WARNING_THRESHOLD_REPOSITORY_MISSING",
        "Variance warning threshold repository is not configured",
      );
    }

    const configured =
      await this.dependencies.varianceWarningThresholdRepository.upsert({
        projectId: input.projectId,
        stageCode: input.stageCode ?? null,
        disciplineCode: input.disciplineCode ?? null,
        thresholdAmount: input.thresholdAmount,
        thresholdRate: input.thresholdRate,
      });

    await this.expireStaleRecommendations({
      projectId: input.projectId,
      recommendationType: "variance_warning",
      reason: "variance_threshold_changed",
      userId: input.userId,
    });

    return configured;
  }

  async expireStaleRecommendations(input: RecommendationContext & {
    recommendationType?: AiRecommendationType;
    resourceType?: string;
    resourceId?: string;
    reason: string;
  }): Promise<AiRecommendationRecord[]> {
    await this.assertProjectAccess(input, "edit");
    const existing = await this.recommendationRepository.listByProjectId(
      input.projectId,
    );
    const stale = existing.filter((recommendation) => {
      if (recommendation.status !== "generated") {
        return false;
      }
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
    });

    return this.expireRecommendations(stale, input.userId, input.reason);
  }

  async expireRecommendationsOutsideStage(input: RecommendationContext & {
    activeStageCode: string;
    reason: string;
  }): Promise<AiRecommendationRecord[]> {
    await this.assertProjectAccess(input, "edit");
    const existing = await this.recommendationRepository.listByProjectId(
      input.projectId,
    );
    const stale = existing.filter(
      (recommendation) =>
        recommendation.status === "generated" &&
        recommendation.stageCode !== null &&
        recommendation.stageCode !== input.activeStageCode,
    );

    return this.expireRecommendations(stale, input.userId, input.reason);
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
        acceptedChanges: readAcceptedChanges(updated.outputPayload),
      },
    });

    await this.persistRecommendationFeedback(updated, input.userId);

    return updated;
  }

  async rollbackAcceptedRecommendation(input: {
    recommendationId: string;
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
    if (current.status !== "accepted") {
      throw new AppError(
        409,
        "AI_RECOMMENDATION_NOT_ROLLBACKABLE",
        "Only accepted recommendations can be rolled back",
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

    const changes = readAcceptedChanges(current.outputPayload);
    if (changes.length === 0 || changes.some((change) => !change.rollbackSupported)) {
      throw new AppError(
        422,
        "AI_RECOMMENDATION_ROLLBACK_UNSUPPORTED",
        "Accepted recommendation does not contain rollback metadata",
      );
    }

    const rollbackChanges: AcceptedChange[] = [];
    for (const change of changes.slice().reverse()) {
      if (change.action !== "create") {
        throw new AppError(
          422,
          "AI_RECOMMENDATION_ROLLBACK_UNSUPPORTED",
          "Only created resources can be rolled back automatically",
        );
      }

      if (change.resourceType === "quota_line") {
        await this.assertQuotaLineRollbackable(change);
        if (!this.dependencies.quotaLineService) {
          throw new AppError(
            500,
            "QUOTA_LINE_SERVICE_MISSING",
            "Quota line service is not configured",
          );
        }
        await this.dependencies.quotaLineService.deleteQuotaLine({
          projectId: current.projectId,
          quotaLineId: change.resourceId,
          userId: input.userId,
        });
      } else if (change.resourceType === "bill_item") {
        await this.assertBillItemRollbackable(change);
        if (!this.dependencies.billItemService) {
          throw new AppError(
            500,
            "BILL_ITEM_SERVICE_MISSING",
            "Bill item service is not configured",
          );
        }
        const billVersionId = readString(change.snapshot, "billVersionId");
        if (!billVersionId) {
          throw new AppError(
            422,
            "AI_RECOMMENDATION_ROLLBACK_UNSUPPORTED",
            "Bill item rollback requires billVersionId",
          );
        }
        await this.dependencies.billItemService.deleteBillItem({
          projectId: current.projectId,
          billVersionId,
          itemId: change.resourceId,
          userId: input.userId,
        });
      } else {
        throw new AppError(
          422,
          "AI_RECOMMENDATION_ROLLBACK_UNSUPPORTED",
          `Rollback is not supported for ${change.resourceType}`,
        );
      }

      rollbackChanges.push({ ...change, action: "delete" });
    }

    const updatedAt = new Date().toISOString();
    const updated = await this.recommendationRepository.update({
      ...current,
      outputPayload: {
        ...current.outputPayload,
        rollback: {
          rolledBackAt: updatedAt,
          rolledBackBy: input.userId,
          reason: input.reason ?? null,
          changes: rollbackChanges,
        },
      },
      status: "rolled_back",
      handledBy: input.userId,
      handledAt: updatedAt,
      statusReason: input.reason ?? "rollback_accepted_recommendation",
      updatedAt,
    });

    await this.auditLogService.writeAuditLog({
      projectId: updated.projectId,
      stageCode: updated.stageCode ?? null,
      resourceType: "ai_recommendation",
      resourceId: updated.id,
      action: "rolled_back",
      operatorId: input.userId,
      beforePayload: {
        status: current.status,
        acceptedChanges: changes,
      },
      afterPayload: {
        status: updated.status,
        reason: updated.statusReason,
        rollbackChanges,
      },
    });

    await this.persistRecommendationFeedback(updated, input.userId);

    return updated;
  }

  private async assertQuotaLineRollbackable(change: AcceptedChange) {
    const current = await this.dependencies.quotaLineRepository?.findById(
      change.resourceId,
    );
    if (!current) {
      throwRollbackBlocked(change, "resource_missing");
    }
    if (!recordsMatchSnapshot(current as unknown as Record<string, unknown>, change.snapshot)) {
      throwRollbackBlocked(change, "resource_modified");
    }
  }

  private async assertBillItemRollbackable(change: AcceptedChange) {
    const current = await this.dependencies.billItemRepository?.findById(
      change.resourceId,
    );
    if (!current) {
      throwRollbackBlocked(change, "resource_missing");
    }
    if (!recordsMatchSnapshot(current as unknown as Record<string, unknown>, change.snapshot)) {
      throwRollbackBlocked(change, "resource_modified");
    }

    const billVersionId = readString(change.snapshot, "billVersionId");
    const siblings = billVersionId
      ? await this.dependencies.billItemRepository?.listByBillVersionId(billVersionId)
      : [];
    if (siblings?.some((item) => item.parentId === change.resourceId)) {
      throwRollbackBlocked(change, "resource_has_children");
    }

    const quotaLines = await this.dependencies.quotaLineRepository?.listByBillItemId(
      change.resourceId,
    );
    if (quotaLines && quotaLines.length > 0) {
      throwRollbackBlocked(change, "resource_has_quota_lines");
    }
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

    await this.expireRecommendations(
      superseded,
      input.userId,
      "superseded_by_new_recommendation",
      now,
    );
  }

  private async expireRecommendations(
    recommendations: AiRecommendationRecord[],
    userId: string,
    reason: string,
    now = new Date().toISOString(),
  ): Promise<AiRecommendationRecord[]> {
    const expired: AiRecommendationRecord[] = [];
    for (const recommendation of recommendations) {
      const updated = await this.recommendationRepository.update({
        ...recommendation,
        status: "expired",
        handledBy: userId,
        handledAt: now,
        statusReason: reason,
        updatedAt: now,
      });

      await this.auditLogService.writeAuditLog({
        projectId: updated.projectId,
        stageCode: updated.stageCode ?? null,
        resourceType: "ai_recommendation",
        resourceId: updated.id,
        action: "expired",
        operatorId: userId,
        beforePayload: {
          status: recommendation.status,
        },
        afterPayload: {
          status: updated.status,
          reason: updated.statusReason,
        },
      });

      await this.persistRecommendationFeedback(updated, userId);
      expired.push(updated);
    }

    return expired;
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

  private async resolveVarianceThresholds(input: {
    projectId: string;
    stageCode?: string;
    disciplineCode?: string;
    thresholdAmount?: number;
    thresholdRate?: number;
  }): Promise<{
    thresholdAmount: number;
    thresholdRate: number;
    scope:
      | "request"
      | "stage_discipline"
      | "stage"
      | "discipline"
      | "project"
      | "default";
  }> {
    if (
      input.thresholdAmount !== undefined ||
      input.thresholdRate !== undefined
    ) {
      return {
        thresholdAmount: input.thresholdAmount ?? 0,
        thresholdRate: input.thresholdRate ?? 0.1,
        scope: "request",
      };
    }

    const thresholds =
      await this.dependencies.varianceWarningThresholdRepository?.listByProjectId(
        input.projectId,
      );
    const stageDisciplineThreshold = thresholds?.find(
      (threshold) =>
        threshold.stageCode === input.stageCode &&
        threshold.disciplineCode === input.disciplineCode,
    );
    if (stageDisciplineThreshold) {
      return {
        thresholdAmount: stageDisciplineThreshold.thresholdAmount,
        thresholdRate: stageDisciplineThreshold.thresholdRate,
        scope: "stage_discipline",
      };
    }

    const stageThreshold = thresholds?.find(
      (threshold) =>
        threshold.stageCode === input.stageCode &&
        threshold.disciplineCode === null,
    );
    if (stageThreshold) {
      return {
        thresholdAmount: stageThreshold.thresholdAmount,
        thresholdRate: stageThreshold.thresholdRate,
        scope: "stage",
      };
    }

    const disciplineThreshold = thresholds?.find(
      (threshold) =>
        threshold.stageCode === null &&
        threshold.disciplineCode === input.disciplineCode,
    );
    if (disciplineThreshold) {
      return {
        thresholdAmount: disciplineThreshold.thresholdAmount,
        thresholdRate: disciplineThreshold.thresholdRate,
        scope: "discipline",
      };
    }

    const projectThreshold = thresholds?.find(
      (threshold) =>
        threshold.stageCode === null && threshold.disciplineCode === null,
    );
    if (projectThreshold) {
      return {
        thresholdAmount: projectThreshold.thresholdAmount,
        thresholdRate: projectThreshold.thresholdRate,
        scope: "project",
      };
    }

    return {
      thresholdAmount: 0,
      thresholdRate: 0.1,
      scope: "default",
    };
  }

  private async buildBillVersionSourceChain(billVersionId: string) {
    const chain = [];
    let current =
      await this.dependencies.billVersionRepository?.findById(billVersionId);
    while (current) {
      chain.push(current);
      if (!current.sourceVersionId) {
        break;
      }
      current = await this.dependencies.billVersionRepository?.findById(
        current.sourceVersionId,
      );
    }
    return chain;
  }

  private async applyAcceptedRecommendation(
    recommendation: AiRecommendationRecord,
    userId: string,
  ): Promise<Record<string, unknown> | null> {
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

    return {
      acceptedQuotaLineId: created.id,
      acceptedChanges: [
        buildAcceptedChange({
          action: "create",
          resourceType: "quota_line",
          resourceId: created.id,
          label: `${created.quotaCode} ${created.quotaName}`,
          snapshot: clonePlainRecord(created as unknown as Record<string, unknown>),
          rollbackSupported: true,
        }),
      ],
    };
  }

  private async applyAcceptedBillRecommendation(
    recommendation: AiRecommendationRecord,
    userId: string,
  ): Promise<Record<string, unknown> | null> {
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

    return {
      acceptedBillItemId: created.id,
      acceptedChanges: [
        buildAcceptedChange({
          action: "create",
          resourceType: "bill_item",
          resourceId: created.id,
          label: `${created.itemCode} ${created.itemName}`,
          snapshot: clonePlainRecord(created as unknown as Record<string, unknown>),
          rollbackSupported: true,
        }),
      ],
    };
  }
}

type AcceptedChange = {
  action: "create" | "delete";
  resourceType: string;
  resourceId: string;
  label: string;
  snapshot: Record<string, unknown>;
  rollbackSupported: boolean;
};

function buildAcceptedChange(input: AcceptedChange): AcceptedChange {
  return input;
}

function clonePlainRecord(input: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(input)) as Record<string, unknown>;
}

function readAcceptedChanges(payload: Record<string, unknown>): AcceptedChange[] {
  const value = payload.acceptedChanges;
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is Record<string, unknown> =>
        item !== null && typeof item === "object" && !Array.isArray(item),
    )
    .map((item): AcceptedChange => ({
      action: item.action === "delete" ? "delete" : "create",
      resourceType: readString(item, "resourceType") ?? "",
      resourceId: readString(item, "resourceId") ?? "",
      label: readString(item, "label") ?? "",
      snapshot: readObject(item, "snapshot") ?? {},
      rollbackSupported: item.rollbackSupported === true,
    }))
    .filter((item) => item.resourceType.length > 0 && item.resourceId.length > 0);
}

function readString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readRequiredJobString(value: string | undefined, key: string): string {
  if (value && value.length > 0) {
    return value;
  }
  throw new AppError(
    422,
    "AI_RECOMMENDATION_JOB_PAYLOAD_INCOMPLETE",
    `AI recommendation job requires ${key}`,
  );
}

function readObject(
  payload: Record<string, unknown> | null,
  key: string,
): Record<string, unknown> | null {
  const value = payload?.[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readRequiredStringFromObject(
  payload: Record<string, unknown> | null,
  key: string,
): string {
  const value = payload?.[key];
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  throw new AppError(
    502,
    "AI_PROVIDER_RESPONSE_INVALID",
    `AI provider response requires ${key}`,
  );
}

function parseProviderRecommendations(
  content: string,
  recommendationType: AiRecommendationType,
): Array<{
  resourceType?: string;
  resourceId?: string;
  outputPayload: Record<string, unknown>;
}> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new AppError(
      502,
      "AI_PROVIDER_RESPONSE_INVALID",
      "AI provider response must be valid JSON",
    );
  }

  const root =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  const items = Array.isArray(root.recommendations)
    ? root.recommendations
    : Array.isArray(parsed)
      ? parsed
      : [];
  const recommendations = items
    .filter((item): item is Record<string, unknown> =>
      item !== null && typeof item === "object" && !Array.isArray(item),
    )
    .map((item) => {
      const outputPayload = readObject(item, "outputPayload");
      const parsedItem = {
        resourceType: readString(item, "resourceType") ?? undefined,
        resourceId: readString(item, "resourceId") ?? undefined,
        outputPayload: outputPayload ?? item,
      };
      validateProviderRecommendationPayload(
        parsedItem.outputPayload,
        recommendationType,
      );
      return parsedItem;
    });

  if (recommendations.length === 0) {
    throw new AppError(
      502,
      "AI_PROVIDER_RESPONSE_INVALID",
      "AI provider response must contain at least one recommendation",
    );
  }

  return recommendations;
}

function validateProviderRecommendationPayload(
  payload: Record<string, unknown>,
  recommendationType: AiRecommendationType,
) {
  if (Object.keys(payload).length === 0) {
    throw new AppError(
      502,
      "AI_PROVIDER_RESPONSE_INVALID",
      "AI provider recommendation outputPayload must not be empty",
    );
  }

  const requiredKeys =
    recommendationType === "bill_recommendation"
      ? ["itemCode", "itemName", "quantity", "unit", "sortNo"]
      : recommendationType === "quota_recommendation"
        ? [
            "billVersionId",
            "sourceStandardSetCode",
            "sourceQuotaId",
            "chapterCode",
            "quotaCode",
            "quotaName",
            "unit",
            "quantity",
          ]
        : ["warning", "severity"];
  const missing = requiredKeys.filter((key) => payload[key] === undefined);
  if (missing.length > 0) {
    throw new AppError(
      502,
      "AI_PROVIDER_RESPONSE_INVALID",
      `AI provider recommendation outputPayload is missing ${missing.join(", ")}`,
    );
  }
}

function recordsMatchSnapshot(
  current: Record<string, unknown>,
  snapshot: Record<string, unknown>,
) {
  for (const [key, snapshotValue] of Object.entries(snapshot)) {
    if (!valuesEquivalent(current[key], snapshotValue)) {
      return false;
    }
  }
  return true;
}

function valuesEquivalent(left: unknown, right: unknown) {
  if (left instanceof Date) {
    return left.toISOString() === right;
  }
  if (right instanceof Date) {
    return right.toISOString() === left;
  }
  if (typeof left === "number" && typeof right === "number") {
    return Math.abs(left - right) < 0.000001;
  }
  return left === right;
}

function buildQuotaRecommendationPayload(
  billVersionId: string,
  billItemQuantity: number,
  candidate: QuotaSourceCandidateRecord,
  recommendationReason: string,
): Record<string, unknown> {
  return {
    billVersionId,
    sourceStandardSetCode: candidate.sourceStandardSetCode,
    sourceQuotaId: candidate.sourceQuotaId,
    sourceSequence: candidate.sourceSequence ?? null,
    chapterCode: candidate.chapterCode,
    quotaCode: candidate.quotaCode,
    quotaName: candidate.quotaName,
    unit: candidate.unit,
    quantity: billItemQuantity,
    laborFee: candidate.laborFee ?? null,
    materialFee: candidate.materialFee ?? null,
    machineFee: candidate.machineFee ?? null,
    contentFactor: 1,
    sourceMode: candidate.sourceMode,
    sourceDataset: candidate.sourceDataset,
    sourceRegion: candidate.sourceRegion ?? null,
    matchReason: candidate.matchReason ?? null,
    matchScore: candidate.matchScore ?? null,
    recommendationReason,
  };
}

function buildMissingQuotaPromptPayload(
  billVersionId: string,
  billItemCode: string,
  billItemName: string,
): Record<string, unknown> {
  return {
    billVersionId,
    billItemCode,
    billItemName,
    promptType: "missing_quota",
    recommendationReason: "bill_item_missing_quota_prompt",
    prompt: `${billItemCode} ${billItemName} 没有匹配到候选定额，请补充定额库、调整清单名称关键字，或人工选择适用定额。`,
  };
}

function throwRollbackBlocked(change: AcceptedChange, reason: string): never {
  throw new AppError(
    409,
    "AI_RECOMMENDATION_ROLLBACK_BLOCKED",
    "Accepted recommendation cannot be rolled back automatically; please review and handle the business data manually",
    {
      reason,
      resourceType: change.resourceType,
      resourceId: change.resourceId,
      label: change.label,
    },
  );
}

function buildProviderFailureSummary(
  error: unknown,
  context: { provider: string; model: string | null; durationMs: number },
) {
  const appError = error instanceof AppError ? error : null;
  return {
    provider: context.provider,
    model: context.model,
    durationMs: context.durationMs,
    code: appError?.code ?? "AI_PROVIDER_REQUEST_FAILED",
    message:
      error instanceof Error ? error.message : "Unknown AI provider request failure",
    retryCount: null,
    manualActionRequired: true,
  };
}

function isVarianceExceeded(
  item: { varianceAmount: number; varianceRate: number },
  thresholdAmount: number,
  thresholdRate: number,
) {
  const amountExceeded =
    thresholdAmount > 0 && Math.abs(item.varianceAmount) >= thresholdAmount;
  const rateExceeded =
    thresholdRate > 0 && Math.abs(item.varianceRate) >= thresholdRate;
  return amountExceeded || rateExceeded;
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
  const generatedContextKeys = new Set([
    "billItem",
    "billVersion",
    "contextType",
    "currentItemCount",
    "currentItems",
    "currentVersion",
    "disciplineCode",
    "disciplines",
    "existingQuotaLines",
    "memoryHints",
    "project",
    "quotaCandidates",
    "sourceChain",
    "sourceItems",
    "stageCode",
    "stages",
    "summaryDetails",
    "thresholdAmount",
    "thresholdRate",
    "thresholdScope",
  ]);
  const payloadKeys = Object.keys(payload)
    .filter(
      (key) =>
        ![
          "aiAssistTraceId",
          "aiProvider",
          "aiRequestSummary",
          "aiResponseSummary",
        ].includes(key) && !generatedContextKeys.has(key),
    )
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
    rolled_back: items.filter((item) => item.status === "rolled_back").length,
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
