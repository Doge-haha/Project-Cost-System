import { describe, expect, test } from "vitest";

import {
  buildSummaryHighlights,
  classifyVarianceAmount,
} from "../src/features/reports/summary-highlights";
import type { SummaryDetailItem } from "../src/lib/types";

const details: SummaryDetailItem[] = [
  {
    itemId: "item-001",
    itemCode: "A.1",
    itemName: "土方开挖",
    systemAmount: 100,
    finalAmount: 180,
    varianceAmount: 80,
  },
  {
    itemId: "item-002",
    itemCode: "B.1",
    itemName: "模板工程",
    systemAmount: 300,
    finalAmount: 210,
    varianceAmount: -90,
  },
  {
    itemId: "item-003",
    itemCode: "C.1",
    itemName: "钢筋工程",
    systemAmount: 200,
    finalAmount: 200,
    varianceAmount: 0,
  },
];

describe("summary highlights", () => {
  test("classifyVarianceAmount returns expected tone", () => {
    expect(classifyVarianceAmount(10)).toBe("positive");
    expect(classifyVarianceAmount(-1)).toBe("negative");
    expect(classifyVarianceAmount(0)).toBe("neutral");
  });

  test("buildSummaryHighlights returns sorted highlight cards", () => {
    expect(buildSummaryHighlights(details)).toEqual([
      {
        itemId: "item-002",
        itemCode: "B.1",
        itemName: "模板工程",
        varianceLabel: "-90.00",
        tone: "negative",
        priorityLabel: "高优先级",
      },
      {
        itemId: "item-001",
        itemCode: "A.1",
        itemName: "土方开挖",
        varianceLabel: "80.00",
        tone: "positive",
        priorityLabel: "高优先级",
      },
    ]);
  });
});
