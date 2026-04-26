import type { VersionCompareItem } from "../../lib/types";

function formatMoney(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCompareVarianceTone(value: number) {
  if (value > 0) {
    return "上涨";
  }
  if (value < 0) {
    return "下降";
  }
  return "持平";
}

export function buildVersionCompareHighlights(items: VersionCompareItem[]) {
  return [...items]
    .sort((left, right) => Math.abs(right.finalVarianceAmount) - Math.abs(left.finalVarianceAmount))
    .slice(0, 5)
    .map((item) => ({
      itemCode: item.itemCode,
      itemName: item.itemNameTarget ?? item.itemNameBase ?? item.itemCode,
      finalVarianceLabel: formatMoney(item.finalVarianceAmount),
      tone:
        item.finalVarianceAmount > 0
          ? ("positive" as const)
          : item.finalVarianceAmount < 0
            ? ("negative" as const)
            : ("neutral" as const),
    }));
}

export function buildVersionCompareTableRows(items: VersionCompareItem[]) {
  return [...items]
    .sort((left, right) => Math.abs(right.finalVarianceAmount) - Math.abs(left.finalVarianceAmount))
    .map((item) => ({
      itemCode: item.itemCode,
      itemName: item.itemNameTarget ?? item.itemNameBase ?? item.itemCode,
      baseSystemAmountLabel: formatMoney(item.baseSystemAmount),
      targetSystemAmountLabel: formatMoney(item.targetSystemAmount),
      systemVarianceAmountLabel: formatMoney(item.systemVarianceAmount),
      baseFinalAmountLabel: formatMoney(item.baseFinalAmount),
      targetFinalAmountLabel: formatMoney(item.targetFinalAmount),
      finalVarianceAmountLabel: formatMoney(item.finalVarianceAmount),
      systemTone:
        item.systemVarianceAmount > 0
          ? ("positive" as const)
          : item.systemVarianceAmount < 0
            ? ("negative" as const)
            : ("neutral" as const),
      finalTone:
        item.finalVarianceAmount > 0
          ? ("positive" as const)
          : item.finalVarianceAmount < 0
            ? ("negative" as const)
            : ("neutral" as const),
    }));
}
