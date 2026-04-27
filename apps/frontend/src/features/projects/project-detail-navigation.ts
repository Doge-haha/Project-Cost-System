import type { BillVersion } from "../../lib/types";

export function pickInitialBillVersionId(versions: BillVersion[]) {
  return versions[0]?.id ?? null;
}

export function buildProjectDetailNavigation(input: {
  projectId: string;
  billVersionId: string;
}) {
  return {
    billItemsPath: `/projects/${input.projectId}/bill-versions/${input.billVersionId}/items`,
    summaryPath: `/projects/${input.projectId}/summary?billVersionId=${input.billVersionId}`,
    auditLogsPath: `/projects/${input.projectId}/audit-logs`,
    knowledgePath: `/projects/${input.projectId}/knowledge`,
    aiRecommendationsPath: `/projects/${input.projectId}/ai-recommendations`,
  };
}
