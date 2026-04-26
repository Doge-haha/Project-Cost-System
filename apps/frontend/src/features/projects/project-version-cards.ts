import type { BillVersion } from "../../lib/types";

export function formatBillVersionStatus(status: string) {
  if (status === "editable") {
    return "可编辑";
  }
  if (status === "submitted") {
    return "已提交";
  }
  if (status === "approved") {
    return "已通过";
  }
  if (status === "locked") {
    return "已锁定";
  }
  return status;
}

export function buildProjectVersionCards(input: {
  projectId: string;
  selectedBillVersionId: string | null;
  versions: BillVersion[];
  canEditProject?: boolean;
}) {
  return input.versions.map((version) => ({
    id: version.id,
    title: version.versionName,
    subtitle: `${version.stageCode} · ${version.disciplineCode}`,
    status: version.status,
    statusLabel: formatBillVersionStatus(version.status),
    itemCountLabel:
      typeof version.itemCount === "number"
        ? `${version.itemCount} 条清单项`
        : "条目数待补充",
    isSelected: version.id === input.selectedBillVersionId,
    canLock: Boolean(input.canEditProject) && version.status === "approved",
    canUnlock: Boolean(input.canEditProject) && version.status === "locked",
    billItemsPath: `/projects/${input.projectId}/bill-versions/${version.id}/items`,
    summaryPath: `/projects/${input.projectId}/summary?billVersionId=${version.id}`,
  }));
}
