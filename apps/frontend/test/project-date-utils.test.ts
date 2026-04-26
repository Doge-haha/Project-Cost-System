import { describe, expect, test } from "vitest";

import { formatProjectDateTime } from "../src/features/projects/project-date-utils";

describe("project-date-utils", () => {
  test("formats valid timestamps and preserves invalid values", () => {
    expect(formatProjectDateTime("2026-04-24T10:30:00.000Z")).toContain("2026");
    expect(formatProjectDateTime("not-a-date")).toBe("not-a-date");
  });
});
