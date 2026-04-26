import type { WorkerProcessorResult } from "./contracts.js";

type ReportExportPayload = {
  projectId: string;
  reportType: "summary" | "variance";
  stageCode?: string | null;
  disciplineCode?: string | null;
  requestedBy: string;
};

type Dependencies = {
  fetchSummary: (input: {
    projectId: string;
    stageCode?: string;
    disciplineCode?: string;
    userId: string;
  }) => Promise<Record<string, unknown>>;
  fetchVariance: (input: {
    projectId: string;
    stageCode?: string;
    disciplineCode?: string;
    userId: string;
    limit?: number;
  }) => Promise<Record<string, unknown>>;
};

export async function processReportExportJob(
  payload: ReportExportPayload,
  dependencies: Dependencies,
): Promise<WorkerProcessorResult> {
  try {
    const result =
      payload.reportType === "summary"
        ? await dependencies.fetchSummary({
            projectId: payload.projectId,
            stageCode: payload.stageCode ?? undefined,
            disciplineCode: payload.disciplineCode ?? undefined,
            userId: payload.requestedBy,
          })
        : await dependencies.fetchVariance({
            projectId: payload.projectId,
            stageCode: payload.stageCode ?? undefined,
            disciplineCode: payload.disciplineCode ?? undefined,
            userId: payload.requestedBy,
            limit: 20,
          });

    return {
      status: "completed",
      result,
    };
  } catch (error) {
    return {
      status: "failed",
      errorMessage:
        error instanceof Error ? error.message : "Unknown report export error",
    };
  }
}
