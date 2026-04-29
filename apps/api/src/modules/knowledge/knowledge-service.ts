import { AppError } from "../../shared/errors/app-error.js";
import { ProjectAuthorizationService } from "../project/project-authorization-service.js";
import type { ProjectDisciplineRepository } from "../project/project-discipline-repository.js";
import type { ProjectMemberRepository } from "../project/project-member-repository.js";
import type { ProjectRepository } from "../project/project-repository.js";
import type { ProjectStageRepository } from "../project/project-stage-repository.js";
import type {
  KnowledgeEntryRecord,
  KnowledgeEntryRepository,
} from "./knowledge-entry-repository.js";
import type {
  MemoryEntryRecord,
  MemoryEntryRepository,
} from "./memory-entry-repository.js";

type ExtractionBatchResult = {
  runtime?: string;
  source?: string;
  result?: {
    knowledgeCandidates?: Array<{
      title: string;
      summary: string;
      source_type: string;
      source_action: string;
      project_id: string;
      stage_code?: string | null;
      tags?: string[];
      metadata?: Record<string, unknown>;
    }>;
    memoryCandidates?: Array<{
      memory_key: string;
      subject_type: string;
      subject_id: string;
      content: string;
      project_id: string;
      stage_code?: string | null;
      metadata?: Record<string, unknown>;
    }>;
    summary?: Record<string, unknown>;
  };
};

type RecommendationFeedbackStatus = "accepted" | "ignored" | "expired";

export const KNOWLEDGE_AUDIT_ACTIONS = {
  createKnowledgeEntry: "knowledge_entry.create",
  createMemoryEntry: "memory_entry.create",
} as const;

export class KnowledgeService {
  constructor(
    private readonly knowledgeEntryRepository: KnowledgeEntryRepository,
    private readonly memoryEntryRepository: MemoryEntryRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly projectStageRepository: ProjectStageRepository,
    private readonly projectDisciplineRepository: ProjectDisciplineRepository,
    private readonly projectMemberRepository: ProjectMemberRepository,
  ) {}

  async listKnowledgeEntries(input: {
    projectId: string;
    sourceJobId?: string;
    sourceType?: string;
    sourceAction?: string;
    stageCode?: string;
    limit?: number;
    userId: string;
  }): Promise<KnowledgeEntryRecord[]> {
    await this.assertProjectVisible(input.projectId, input.userId);
    const entries = await this.knowledgeEntryRepository.listByProjectId(
      input.projectId,
    );
    return entries
      .filter((entry) => {
        if (input.sourceJobId && entry.sourceJobId !== input.sourceJobId) {
          return false;
        }
        if (input.sourceType && entry.sourceType !== input.sourceType) {
          return false;
        }
        if (input.sourceAction && entry.sourceAction !== input.sourceAction) {
          return false;
        }
        if (input.stageCode && entry.stageCode !== input.stageCode) {
          return false;
        }
        return true;
      })
      .slice(0, input.limit ?? 50);
  }

  summarizeKnowledgeEntries(entries: KnowledgeEntryRecord[]): {
    totalCount: number;
    sourceTypeCounts: Record<string, number>;
    sourceActionCounts: Record<string, number>;
    stageCounts: Record<string, number>;
  } {
    return {
      totalCount: entries.length,
      sourceTypeCounts: countBy(entries, (entry) => entry.sourceType),
      sourceActionCounts: countBy(entries, (entry) => entry.sourceAction),
      stageCounts: countBy(entries, (entry) => entry.stageCode ?? "unscoped"),
    };
  }

  async listMemoryEntries(input: {
    projectId: string;
    sourceJobId?: string;
    subjectType?: string;
    subjectId?: string;
    stageCode?: string;
    limit?: number;
    userId: string;
  }): Promise<MemoryEntryRecord[]> {
    await this.assertProjectVisible(input.projectId, input.userId);
    const entries = await this.memoryEntryRepository.listByProjectId(input.projectId);
    return entries
      .filter((entry) => {
        if (input.sourceJobId && entry.sourceJobId !== input.sourceJobId) {
          return false;
        }
        if (input.subjectType && entry.subjectType !== input.subjectType) {
          return false;
        }
        if (input.subjectId && entry.subjectId !== input.subjectId) {
          return false;
        }
        if (input.stageCode && entry.stageCode !== input.stageCode) {
          return false;
        }
        return true;
      })
      .slice(0, input.limit ?? 50);
  }

  summarizeMemoryEntries(entries: MemoryEntryRecord[]): {
    totalCount: number;
    subjectTypeCounts: Record<string, number>;
    stageCounts: Record<string, number>;
  } {
    return {
      totalCount: entries.length,
      subjectTypeCounts: countBy(entries, (entry) => entry.subjectType),
      stageCounts: countBy(entries, (entry) => entry.stageCode ?? "unscoped"),
    };
  }

  async searchKnowledgeEntries(input: {
    projectId: string;
    query: string;
    sourceType?: string;
    stageCode?: string;
    limit?: number;
    userId: string;
  }): Promise<KnowledgeEntryRecord[]> {
    const normalizedQuery = input.query.trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }

    const entries = await this.listKnowledgeEntries({
      projectId: input.projectId,
      sourceType: input.sourceType,
      stageCode: input.stageCode,
      limit: input.limit ? input.limit * 4 : 200,
      userId: input.userId,
    });

    return entries
      .filter((entry) => {
        const haystacks = [
          entry.title,
          entry.summary,
          entry.sourceType,
          entry.sourceAction,
          ...entry.tags,
        ]
          .filter(Boolean)
          .map((value) => value.toLowerCase());

        return haystacks.some((value) => value.includes(normalizedQuery));
      })
      .slice(0, input.limit ?? 20);
  }

  async persistExtractionResult(input: {
    projectId: string;
    sourceJobId: string;
    result: ExtractionBatchResult;
  }): Promise<{
    knowledgeEntries: KnowledgeEntryRecord[];
    memoryEntries: MemoryEntryRecord[];
  }> {
    const knowledgeCandidates = input.result.result?.knowledgeCandidates ?? [];
    const memoryCandidates = input.result.result?.memoryCandidates ?? [];
    const createdAt = new Date().toISOString();

    const knowledgeEntries: KnowledgeEntryRecord[] = [];
    for (const candidate of knowledgeCandidates) {
      if (candidate.project_id !== input.projectId) {
        continue;
      }
      knowledgeEntries.push(
        await this.knowledgeEntryRepository.create({
          projectId: candidate.project_id,
          stageCode: candidate.stage_code ?? null,
          sourceJobId: input.sourceJobId,
          sourceType: candidate.source_type,
          sourceAction: candidate.source_action,
          title: candidate.title,
          summary: candidate.summary,
          tags: candidate.tags ?? [],
          metadata: candidate.metadata ?? {},
          createdAt,
        }),
      );
    }

    const memoryEntries: MemoryEntryRecord[] = [];
    for (const candidate of memoryCandidates) {
      if (candidate.project_id != input.projectId) {
        continue;
      }
      memoryEntries.push(
        await this.memoryEntryRepository.create({
          projectId: candidate.project_id,
          stageCode: candidate.stage_code ?? null,
          sourceJobId: input.sourceJobId,
          memoryKey: candidate.memory_key,
          subjectType: candidate.subject_type,
          subjectId: candidate.subject_id,
          content: candidate.content,
          metadata: candidate.metadata ?? {},
          createdAt,
        }),
      );
    }

    return {
      knowledgeEntries,
      memoryEntries,
    };
  }

  async persistProjectRetrospective(input: {
    projectId: string;
    stageCode?: string | null;
    title: string;
    summary: string;
    tags?: string[];
    sourceId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<KnowledgeEntryRecord> {
    const createdAt = new Date().toISOString();
    return this.knowledgeEntryRepository.create({
      projectId: input.projectId,
      stageCode: input.stageCode ?? null,
      sourceJobId: null,
      sourceType: "project_retrospective",
      sourceAction: "conclusion",
      title: input.title,
      summary: input.summary,
      tags: ["project_retrospective", ...(input.tags ?? [])],
      metadata: {
        ...(input.metadata ?? {}),
        sourceId: input.sourceId ?? null,
      },
      createdAt,
    });
  }

  async persistReviewRejectionTags(input: {
    projectId: string;
    stageCode?: string | null;
    reviewSubmissionId: string;
    reason: string;
    tags: string[];
    operatorId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<KnowledgeEntryRecord> {
    const normalizedTags = Array.from(
      new Set(["review_rejection", "reject", ...input.tags]),
    );
    const createdAt = new Date().toISOString();

    return this.knowledgeEntryRepository.create({
      projectId: input.projectId,
      stageCode: input.stageCode ?? null,
      sourceJobId: null,
      sourceType: "review_submission",
      sourceAction: "reject",
      title: "Review rejection reason",
      summary: input.reason,
      tags: normalizedTags,
      metadata: {
        ...(input.metadata ?? {}),
        reviewSubmissionId: input.reviewSubmissionId,
        operatorId: input.operatorId ?? null,
      },
      createdAt,
    });
  }

  async persistProjectPreference(input: {
    projectId: string;
    stageCode?: string | null;
    preferenceKey: string;
    content: string;
    sourceJobId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<MemoryEntryRecord> {
    return this.persistPreferenceMemory({
      projectId: input.projectId,
      stageCode: input.stageCode ?? null,
      sourceJobId: input.sourceJobId ?? null,
      memoryKey: [input.projectId, "project", input.preferenceKey].join(":"),
      subjectType: "project",
      subjectId: input.projectId,
      content: input.content,
      metadata: {
        ...(input.metadata ?? {}),
        preferenceKey: input.preferenceKey,
      },
    });
  }

  async persistOrganizationPreference(input: {
    projectId: string;
    organizationId: string;
    preferenceKey: string;
    content: string;
    sourceJobId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<MemoryEntryRecord> {
    return this.persistPreferenceMemory({
      projectId: input.projectId,
      stageCode: null,
      sourceJobId: input.sourceJobId ?? null,
      memoryKey: [input.organizationId, "organization", input.preferenceKey].join(
        ":",
      ),
      subjectType: "organization",
      subjectId: input.organizationId,
      content: input.content,
      metadata: {
        ...(input.metadata ?? {}),
        preferenceKey: input.preferenceKey,
      },
    });
  }

  async persistAiRuntimeFeedback(input: {
    projectId: string;
    stageCode?: string | null;
    sourceJobId: string;
    feedbackKey: string;
    content: string;
    status: string;
    metadata?: Record<string, unknown>;
  }): Promise<MemoryEntryRecord> {
    return this.persistPreferenceMemory({
      projectId: input.projectId,
      stageCode: input.stageCode ?? null,
      sourceJobId: input.sourceJobId,
      memoryKey: [input.projectId, "ai_runtime", input.feedbackKey].join(":"),
      subjectType: "ai_runtime",
      subjectId: input.sourceJobId,
      content: input.content,
      metadata: {
        ...(input.metadata ?? {}),
        feedbackKey: input.feedbackKey,
        status: input.status,
      },
    });
  }

  async persistRecommendationFeedback(input: {
    projectId: string;
    stageCode?: string | null;
    recommendationId: string;
    recommendationType: string;
    resourceType: string;
    resourceId: string;
    status: RecommendationFeedbackStatus;
    reason?: string | null;
    operatorId: string;
    outputPayload?: Record<string, unknown>;
  }): Promise<{
    knowledgeEntry: KnowledgeEntryRecord;
    memoryEntries: MemoryEntryRecord[];
  }> {
    const createdAt = new Date().toISOString();
    const summary = [
      `AI recommendation ${input.recommendationType} was ${input.status}.`,
      `Resource ${input.resourceType}/${input.resourceId}.`,
      input.reason ? `Reason: ${input.reason}.` : null,
    ]
      .filter(Boolean)
      .join(" ");

    const metadata = {
      recommendationId: input.recommendationId,
      recommendationType: input.recommendationType,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      status: input.status,
      reason: input.reason ?? null,
      outputPayload: input.outputPayload ?? {},
    };

    const knowledgeEntry = await this.knowledgeEntryRepository.create({
      projectId: input.projectId,
      stageCode: input.stageCode ?? null,
      sourceJobId: null,
      sourceType: "ai_recommendation",
      sourceAction: input.status,
      title: "AI recommendation feedback",
      summary,
      tags: ["ai_recommendation", input.status, input.recommendationType],
      metadata,
      createdAt,
    });

    const userMemoryEntry = await this.memoryEntryRepository.create({
      projectId: input.projectId,
      stageCode: input.stageCode ?? null,
      sourceJobId: null,
      memoryKey: [
        input.projectId,
        input.operatorId,
        "ai_recommendation",
        input.status,
      ].join(":"),
      subjectType: "user",
      subjectId: input.operatorId,
      content: summary,
      metadata,
      createdAt,
    });

    const projectMemoryEntry = await this.memoryEntryRepository.create({
      projectId: input.projectId,
      stageCode: input.stageCode ?? null,
      sourceJobId: null,
      memoryKey: [input.projectId, "project", "ai_recommendation", input.status].join(
        ":",
      ),
      subjectType: "project",
      subjectId: input.projectId,
      content: summary,
      metadata: {
        ...metadata,
        operatorId: input.operatorId,
      },
      createdAt,
    });

    return { knowledgeEntry, memoryEntries: [userMemoryEntry, projectMemoryEntry] };
  }

  private async assertProjectVisible(projectId: string, userId: string): Promise<void> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
    }

    const authorizationService = new ProjectAuthorizationService({
      stages: await this.projectStageRepository.listByProjectId(projectId),
      disciplines: await this.projectDisciplineRepository.listByProjectId(projectId),
      members: await this.projectMemberRepository.listByProjectId(projectId),
    });

    if (!authorizationService.canViewContext({ projectId, userId })) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have permission to access this resource",
      );
    }
  }

  private async persistPreferenceMemory(
    input: Omit<MemoryEntryRecord, "id" | "createdAt">,
  ): Promise<MemoryEntryRecord> {
    return this.memoryEntryRepository.create({
      ...input,
      createdAt: new Date().toISOString(),
    });
  }
}

function countBy<T>(
  items: T[],
  selectKey: (item: T) => string,
): Record<string, number> {
  return items.reduce<Record<string, number>>((accumulator, item) => {
    const key = selectKey(item);
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});
}
