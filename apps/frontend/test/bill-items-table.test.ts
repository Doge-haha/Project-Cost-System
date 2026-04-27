import { describe, expect, test } from "vitest";

import {
  buildBillTableRows,
  countLeafBillItems,
  getVisibleBillTableRows,
} from "../src/features/bills/bill-items-table";
import type { BillItem } from "../src/lib/types";

const seedItems: BillItem[] = [
  {
    id: "bill-item-001",
    parentId: null,
    code: "A",
    name: "土建工程",
    level: 1,
    quantity: 1,
    unit: "项",
  },
  {
    id: "bill-item-002",
    parentId: "bill-item-001",
    code: "A.1",
    name: "土方开挖",
    level: 2,
    quantity: 12,
    unit: "m3",
    systemUnitPrice: 10,
    manualUnitPrice: 12.5,
    finalUnitPrice: 12.5,
    systemAmount: 120,
    finalAmount: 150,
  },
  {
    id: "bill-item-003",
    parentId: null,
    code: "B",
    name: "安装工程",
    level: 1,
    quantity: 1,
    unit: "项",
  },
];

describe("bill items table helpers", () => {
  test("buildBillTableRows preserves list order and exposes indent level", () => {
    expect(buildBillTableRows(seedItems)).toEqual([
      {
        id: "bill-item-001",
        parentId: null,
        code: "A",
        name: "土建工程",
        indentLevel: 0,
        isLeaf: false,
        quantity: 1,
        unit: "项",
        systemUnitPrice: null,
        manualUnitPrice: null,
        finalUnitPrice: null,
        systemAmount: null,
        finalAmount: null,
      },
      {
        id: "bill-item-002",
        parentId: "bill-item-001",
        code: "A.1",
        name: "土方开挖",
        indentLevel: 1,
        isLeaf: true,
        quantity: 12,
        unit: "m3",
        systemUnitPrice: 10,
        manualUnitPrice: 12.5,
        finalUnitPrice: 12.5,
        systemAmount: 120,
        finalAmount: 150,
      },
      {
        id: "bill-item-003",
        parentId: null,
        code: "B",
        name: "安装工程",
        indentLevel: 0,
        isLeaf: true,
        quantity: 1,
        unit: "项",
        systemUnitPrice: null,
        manualUnitPrice: null,
        finalUnitPrice: null,
        systemAmount: null,
        finalAmount: null,
      },
    ]);
  });

  test("countLeafBillItems returns only rows without children", () => {
    expect(countLeafBillItems(seedItems)).toBe(2);
  });

  test("getVisibleBillTableRows hides descendants when parent is collapsed", () => {
    const rows = buildBillTableRows(seedItems);

    expect(getVisibleBillTableRows(rows, new Set())).toEqual(rows);
    expect(getVisibleBillTableRows(rows, new Set(["bill-item-001"]))).toEqual([
      rows[0],
      rows[2],
    ]);
  });
});
