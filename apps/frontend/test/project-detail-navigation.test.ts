import { describe, expect, test } from "vitest";

import {
  buildProjectDetailNavigation,
  pickInitialBillVersionId,
} from "../src/features/projects/project-detail-navigation";
import type { BillVersion } from "../src/lib/types";

const versions: BillVersion[] = [
  {
    id: "version-001",
    versionName: "估算版 V1",
    stageCode: "estimate",
    disciplineCode: "building",
    status: "editable",
  },
  {
    id: "version-002",
    versionName: "概算版 V2",
    stageCode: "budget",
    disciplineCode: "building",
    status: "submitted",
  },
];

describe("project detail navigation helpers", () => {
  test("pickInitialBillVersionId prefers the first available version", () => {
    expect(pickInitialBillVersionId(versions)).toBe("version-001");
    expect(pickInitialBillVersionId([])).toBeNull();
  });

  test("buildProjectDetailNavigation returns version-aware links", () => {
    expect(
      buildProjectDetailNavigation({
        projectId: "project-001",
        billVersionId: "version-002",
      }),
    ).toEqual({
      auditLogsPath: "/projects/project-001/audit-logs",
      aiRecommendationsPath: "/projects/project-001/ai-recommendations",
      billItemsPath: "/projects/project-001/bill-versions/version-002/items",
      knowledgePath: "/projects/project-001/knowledge",
      reportsPath: "/projects/project-001/reports?billVersionId=version-002",
      summaryPath: "/projects/project-001/summary?billVersionId=version-002",
    });
  });
});
