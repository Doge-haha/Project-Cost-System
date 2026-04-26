import { describe, expect, test } from "vitest";

import {
  buildProjectVersionCards,
  formatBillVersionStatus,
} from "../src/features/projects/project-version-cards";
import type { BillVersion } from "../src/lib/types";

const versions: BillVersion[] = [
  {
    id: "version-001",
    versionName: "估算版 V1",
    stageCode: "estimate",
    disciplineCode: "building",
    status: "editable",
    itemCount: 12,
  },
  {
    id: "version-002",
    versionName: "概算版 V2",
    stageCode: "budget",
    disciplineCode: "install",
    status: "submitted",
    itemCount: 8,
  },
];

describe("project version cards", () => {
  test("formatBillVersionStatus returns user-facing labels", () => {
    expect(formatBillVersionStatus("editable")).toBe("可编辑");
    expect(formatBillVersionStatus("submitted")).toBe("已提交");
    expect(formatBillVersionStatus("approved")).toBe("已通过");
    expect(formatBillVersionStatus("locked")).toBe("已锁定");
    expect(formatBillVersionStatus("draft")).toBe("draft");
  });

  test("buildProjectVersionCards annotates selected card and navigation targets", () => {
    expect(
      buildProjectVersionCards({
        projectId: "project-001",
        selectedBillVersionId: "version-002",
        versions,
      }),
    ).toEqual([
      {
        id: "version-001",
        title: "估算版 V1",
        subtitle: "estimate · building",
        status: "editable",
        statusLabel: "可编辑",
        itemCountLabel: "12 条清单项",
        isSelected: false,
        canLock: false,
        canUnlock: false,
        billItemsPath: "/projects/project-001/bill-versions/version-001/items",
        summaryPath: "/projects/project-001/summary?billVersionId=version-001",
      },
      {
        id: "version-002",
        title: "概算版 V2",
        subtitle: "budget · install",
        status: "submitted",
        statusLabel: "已提交",
        itemCountLabel: "8 条清单项",
        isSelected: true,
        canLock: false,
        canUnlock: false,
        billItemsPath: "/projects/project-001/bill-versions/version-002/items",
        summaryPath: "/projects/project-001/summary?billVersionId=version-002",
      },
    ]);
  });

  test("buildProjectVersionCards exposes lock and unlock actions for editable project users", () => {
    expect(
      buildProjectVersionCards({
        projectId: "project-001",
        selectedBillVersionId: null,
        canEditProject: true,
        versions: [
          {
            id: "version-003",
            versionName: "审核通过版",
            stageCode: "budget",
            disciplineCode: "building",
            status: "approved",
          },
          {
            id: "version-004",
            versionName: "锁定版",
            stageCode: "budget",
            disciplineCode: "building",
            status: "locked",
          },
        ],
      }).map((card) => ({
        id: card.id,
        canLock: card.canLock,
        canUnlock: card.canUnlock,
      })),
    ).toEqual([
      {
        id: "version-003",
        canLock: true,
        canUnlock: false,
      },
      {
        id: "version-004",
        canLock: false,
        canUnlock: true,
      },
    ]);
  });
});
