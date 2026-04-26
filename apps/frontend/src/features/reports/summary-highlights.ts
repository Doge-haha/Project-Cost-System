import type { SummaryDetailItem } from "../../lib/types";

function formatMoney(value: number | string | null | undefined) {
  const normalized = Number(value ?? 0);

  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(normalized);
}

export function classifyVarianceAmount(value: number | string | null | undefined) {
  const normalized = Number(value ?? 0);
  if (normalized > 0) {
    return "positive" as const;
  }
  if (normalized < 0) {
    return "negative" as const;
  }
  return "neutral" as const;
}

export function buildSummaryHighlights(details: SummaryDetailItem[]) {
  return [...details]
    .sort(
      (left, right) =>
        Math.abs(Number(right.varianceAmount ?? 0)) -
        Math.abs(Number(left.varianceAmount ?? 0)),
    )
    .slice(0, 3)
    .map((detail) => ({
      itemId: detail.itemId,
      itemCode: detail.itemCode,
      itemName: detail.itemName,
      varianceLabel: formatMoney(detail.varianceAmount),
      tone: classifyVarianceAmount(detail.varianceAmount),
    }));
}
