import { describe, expect, test } from "vitest";

import {
  buildSummaryPageContext,
  findSelectedBillVersion,
} from "../src/features/reports/summary-page-context";
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

describe("summary page context helpers", () => {
  test("findSelectedBillVersion returns matching version or null", () => {
    expect(findSelectedBillVersion(versions, "version-002")?.versionName).toBe("概算版 V2");
    expect(findSelectedBillVersion(versions, "missing")).toBeNull();
  });

  test("buildSummaryPageContext returns version-aware navigation", () => {
    expect(
      buildSummaryPageContext({
        projectId: "project-001",
        billVersionId: "version-002",
      }),
    ).toEqual({
      projectDetailPath: "/projects/project-001",
      billItemsPath: "/projects/project-001/bill-versions/version-002/items",
    });
  });
});
