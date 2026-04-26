import type { WorkerProcessorResult } from "./contracts.js";

type ProjectRecalculatePayload = {
  projectId: string;
  stageCode?: string | null;
  disciplineCode?: string | null;
  priceVersionId?: string | null;
  feeTemplateId?: string | null;
  requestedBy: string;
};

type Dependencies = {
  recalculateProject: (input: {
    projectId: string;
    stageCode?: string;
    disciplineCode?: string;
    priceVersionId?: string;
    feeTemplateId?: string;
    userId: string;
  }) => Promise<Record<string, unknown>>;
};

export async function processProjectRecalculateJob(
  payload: ProjectRecalculatePayload,
  dependencies: Dependencies,
): Promise<WorkerProcessorResult> {
  try {
    const result = await dependencies.recalculateProject({
      projectId: payload.projectId,
      stageCode: payload.stageCode ?? undefined,
      disciplineCode: payload.disciplineCode ?? undefined,
      priceVersionId: payload.priceVersionId ?? undefined,
      feeTemplateId: payload.feeTemplateId ?? undefined,
      userId: payload.requestedBy,
    });

    return {
      status: "completed",
      result,
    };
  } catch (error) {
    return {
      status: "failed",
      errorMessage:
        error instanceof Error
          ? error.message
          : "Unknown project recalculate error",
    };
  }
}
