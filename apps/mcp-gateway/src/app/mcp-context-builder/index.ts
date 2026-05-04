export type ResourceEnvelopeInput = {
  resourceType: string;
  scope: Record<string, unknown>;
  data: Record<string, unknown>;
};

export type ProjectContextParts = {
  projectSummary: Record<string, unknown>;
  jobsSummary: Record<string, unknown>;
  jobStatus: Record<string, unknown> | null;
  latestKnowledgeExtractionJobs: Record<string, unknown>;
  latestKnowledgeEntries: Record<string, unknown>;
  latestMemoryEntries: Record<string, unknown>;
};

export type StageContextParts = {
  projectSummary: Record<string, unknown>;
  latestKnowledgeEntries: Record<string, unknown>;
  latestMemoryEntries: Record<string, unknown>;
};

export type BillVersionContextParts = StageContextParts & {
  summaryDetails: Record<string, unknown>;
};

export function buildProjectContextResource(input: {
  scope: {
    projectId: string;
    stageCode?: string;
    disciplineCode?: string;
    jobId?: string;
  };
  parts: ProjectContextParts;
}): ResourceEnvelopeInput {
  return {
    resourceType: "project_context",
    scope: {
      projectId: input.scope.projectId,
      stageCode: input.scope.stageCode ?? null,
      disciplineCode: input.scope.disciplineCode ?? null,
      jobId: input.scope.jobId ?? null,
    },
    data: {
      projectSummary: input.parts.projectSummary,
      jobsSummary: input.parts.jobsSummary,
      jobStatus: input.parts.jobStatus,
      latestKnowledgeExtractionJob: firstItem(
        input.parts.latestKnowledgeExtractionJobs,
      ),
      latestKnowledgeSummary: summaryOrNull(input.parts.latestKnowledgeEntries),
      latestKnowledgeEntries: itemsOrEmpty(input.parts.latestKnowledgeEntries),
      latestMemorySummary: summaryOrNull(input.parts.latestMemoryEntries),
      latestMemoryEntries: itemsOrEmpty(input.parts.latestMemoryEntries),
    },
  };
}

export function buildStageContextResource(input: {
  scope: {
    projectId: string;
    stageCode: string;
    disciplineCode?: string;
  };
  parts: StageContextParts;
}): ResourceEnvelopeInput {
  return {
    resourceType: "stage_context",
    scope: {
      projectId: input.scope.projectId,
      stageCode: input.scope.stageCode,
      disciplineCode: input.scope.disciplineCode ?? null,
    },
    data: {
      projectSummary: input.parts.projectSummary,
      latestKnowledgeSummary: summaryOrNull(input.parts.latestKnowledgeEntries),
      latestKnowledgeEntries: itemsOrEmpty(input.parts.latestKnowledgeEntries),
      latestMemorySummary: summaryOrNull(input.parts.latestMemoryEntries),
      latestMemoryEntries: itemsOrEmpty(input.parts.latestMemoryEntries),
    },
  };
}

export function buildBillVersionContextResource(input: {
  scope: {
    projectId: string;
    billVersionId: string;
    stageCode?: string;
    disciplineCode?: string;
  };
  parts: BillVersionContextParts;
}): ResourceEnvelopeInput {
  return {
    resourceType: "bill_version_context",
    scope: {
      projectId: input.scope.projectId,
      billVersionId: input.scope.billVersionId,
      stageCode: input.scope.stageCode ?? null,
      disciplineCode: input.scope.disciplineCode ?? null,
    },
    data: {
      projectSummary: input.parts.projectSummary,
      summaryDetails: input.parts.summaryDetails,
      latestKnowledgeSummary: summaryOrNull(input.parts.latestKnowledgeEntries),
      latestKnowledgeEntries: itemsOrEmpty(input.parts.latestKnowledgeEntries),
      latestMemorySummary: summaryOrNull(input.parts.latestMemoryEntries),
      latestMemoryEntries: itemsOrEmpty(input.parts.latestMemoryEntries),
    },
  };
}

function firstItem(payload: Record<string, unknown>): unknown {
  return Array.isArray(payload.items) && payload.items.length > 0
    ? payload.items[0]
    : null;
}

function summaryOrNull(payload: Record<string, unknown>): unknown {
  return typeof payload.summary === "object" && payload.summary !== null
    ? payload.summary
    : null;
}

function itemsOrEmpty(payload: Record<string, unknown>): unknown[] {
  return Array.isArray(payload.items) ? payload.items : [];
}
