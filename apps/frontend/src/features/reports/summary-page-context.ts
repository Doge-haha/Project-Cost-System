import type { BillVersion } from "../../lib/types";

export function findSelectedBillVersion(
  versions: BillVersion[],
  billVersionId?: string,
) {
  return versions.find((version) => version.id === billVersionId) ?? null;
}

export function buildSummaryPageContext(input: {
  projectId: string;
  billVersionId: string;
}) {
  return {
    projectDetailPath: `/projects/${input.projectId}`,
    billItemsPath: `/projects/${input.projectId}/bill-versions/${input.billVersionId}/items`,
  };
}
