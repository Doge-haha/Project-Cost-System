import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { BillVersionSelector } from "../src/features/shared/bill-version-selector";
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
    disciplineCode: "install",
    status: "submitted",
  },
];

describe("BillVersionSelector", () => {
  test("renders current version options and emits selected id", () => {
    const onChange = vi.fn();

    render(
      <BillVersionSelector
        label="当前版本"
        onChange={onChange}
        selectedVersionId="version-001"
        versions={versions}
      />,
    );

    expect(screen.getByLabelText("当前版本")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "估算版 V1 · estimate · building" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("当前版本"), {
      target: { value: "version-002" },
    });

    expect(onChange).toHaveBeenCalledWith("version-002");
  });
});
