import type {
  BillVersion,
  ProjectListItem,
  ProjectStage,
  SummaryResponse,
} from "../../lib/types";

function formatMoney(value: number | string | null | undefined) {
  if (value === undefined || value === null || value === "") {
    return "-";
  }

  const normalized = Number(value);
  if (Number.isNaN(normalized)) {
    return String(value);
  }

  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(normalized);
}

export function formatProjectStatus(status: string) {
  if (status === "draft") {
    return "草稿";
  }
  return status;
}

export function formatVarianceTone(value: number | string | null | undefined) {
  const normalized = Number(value ?? 0);
  if (normalized > 0) {
    return "上涨";
  }
  if (normalized < 0) {
    return "下降";
  }
  return "持平";
}

export function buildProjectDashboardSummary(input: {
  project: ProjectListItem;
  selectedBillVersion: BillVersion;
  summary: SummaryResponse;
  currentStage?: ProjectStage | null;
  permissionSummary?: {
    roleLabel: string;
    canEditProject: boolean;
  } | null;
}) {
  const varianceTone = formatVarianceTone(input.summary.varianceAmount);
  const varianceValue = formatMoney(input.summary.varianceAmount);
  const currentStageLabel = input.currentStage
    ? `${input.currentStage.stageName} · ${input.currentStage.stageCode}`
    : `${input.selectedBillVersion.stageCode} · ${input.selectedBillVersion.disciplineCode}`;
  const permissionLabel = input.permissionSummary
    ? `${input.permissionSummary.roleLabel} · ${
        input.permissionSummary.canEditProject ? "可编辑" : "只读"
      }`
    : `${input.selectedBillVersion.stageCode} · ${input.selectedBillVersion.disciplineCode}`;

  return [
    {
      label: "项目状态",
      value: formatProjectStatus(input.project.status),
      helper: `当前阶段：${currentStageLabel}`,
    },
    {
      label: "系统值",
      value: formatMoney(input.summary.totalSystemAmount),
      helper: `当前版本：${input.selectedBillVersion.versionName}`,
    },
    {
      label: "最终值",
      value: formatMoney(input.summary.totalFinalAmount),
      helper:
        typeof input.summary.itemCount === "number"
          ? `${input.summary.itemCount} 条清单项`
          : "条目数待补充",
    },
    {
      label: "偏差趋势",
      value: `${varianceTone} ${varianceValue}`,
      helper:
        typeof input.summary.billVersionCount === "number"
          ? `${permissionLabel} · 共 ${input.summary.billVersionCount} 个版本`
          : permissionLabel,
    },
  ];
}
