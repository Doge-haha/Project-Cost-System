import { describe, expect, test } from "vitest";

import {
  buildVersionCompareHighlights,
  buildVersionCompareTableRows,
  formatCompareVarianceTone,
} from "../src/features/reports/summary-compare";
import type { VersionCompareItem } from "../src/lib/types";

const items: VersionCompareItem[] = [
  {
    itemCode: "A.1",
    itemNameBase: "土石方工程",
    itemNameTarget: "土石方工程",
    baseSystemAmount: 1080,
    targetSystemAmount: 1200,
    baseFinalAmount: 1198.8,
    targetFinalAmount: 1320,
    systemVarianceAmount: 120,
    finalVarianceAmount: 121.2,
  },
  {
    itemCode: "B.1",
    itemNameBase: "模板工程",
    itemNameTarget: "模板工程",
    baseSystemAmount: 900,
    targetSystemAmount: 840,
    baseFinalAmount: 990,
    targetFinalAmount: 860,
    systemVarianceAmount: -60,
    finalVarianceAmount: -130,
  },
];

describe("summary compare helpers", () => {
  test("formatCompareVarianceTone returns expected tone", () => {
    expect(formatCompareVarianceTone(10)).toBe("上涨");
    expect(formatCompareVarianceTone(-1)).toBe("下降");
    expect(formatCompareVarianceTone(0)).toBe("持平");
  });

  test("buildVersionCompareHighlights sorts by absolute final variance", () => {
    expect(buildVersionCompareHighlights(items)).toEqual([
      {
        itemCode: "B.1",
        itemName: "模板工程",
        finalVarianceLabel: "-130.00",
        tone: "negative",
      },
      {
        itemCode: "A.1",
        itemName: "土石方工程",
        finalVarianceLabel: "121.20",
        tone: "positive",
      },
    ]);
  });

  test("buildVersionCompareTableRows formats compare table rows", () => {
    expect(buildVersionCompareTableRows(items)).toEqual([
      {
        itemCode: "B.1",
        itemName: "模板工程",
        baseSystemAmountLabel: "900.00",
        targetSystemAmountLabel: "840.00",
        systemVarianceAmountLabel: "-60.00",
        baseFinalAmountLabel: "990.00",
        targetFinalAmountLabel: "860.00",
        finalVarianceAmountLabel: "-130.00",
        systemTone: "negative",
        finalTone: "negative",
      },
      {
        itemCode: "A.1",
        itemName: "土石方工程",
        baseSystemAmountLabel: "1,080.00",
        targetSystemAmountLabel: "1,200.00",
        systemVarianceAmountLabel: "120.00",
        baseFinalAmountLabel: "1,198.80",
        targetFinalAmountLabel: "1,320.00",
        finalVarianceAmountLabel: "121.20",
        systemTone: "positive",
        finalTone: "positive",
      },
    ]);
  });
});
