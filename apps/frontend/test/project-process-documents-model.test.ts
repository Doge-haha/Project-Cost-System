import { describe, expect, test } from "vitest";

import {
  appendProcessDocumentBatchSummary,
  buildNextProcessDocumentActionState,
  buildProcessDocumentReturnQuery,
  buildProcessDocumentStatusHint,
  formatDocumentType,
  normalizeProcessDocumentFilter,
  normalizeProcessDocumentSummaryFocus,
} from "../src/features/projects/project-process-documents-model";

const processDocuments = [
  {
    id: "document-001",
    status: "draft" as const,
    isEditable: true,
    isReviewable: false,
    lastComment: null,
  },
  {
    id: "document-002",
    status: "submitted" as const,
    isEditable: false,
    isReviewable: true,
    lastComment: "请补齐附件",
  },
];

describe("process document model helpers", () => {
  test("normalizes process document filters and summary focus values", () => {
    expect(normalizeProcessDocumentFilter("draft")).toBe("draft");
    expect(normalizeProcessDocumentFilter("unknown")).toBe("all");
    expect(normalizeProcessDocumentSummaryFocus("submitted")).toBe("submitted");
    expect(normalizeProcessDocumentSummaryFocus("other")).toBeNull();
  });

  test("formats document types and status hints", () => {
    expect(formatDocumentType("change_order")).toBe("设计变更");
    expect(formatDocumentType("site_visa")).toBe("现场签证");
    expect(
      buildProcessDocumentStatusHint({
        status: "submitted",
        isEditable: false,
        isReviewable: true,
      }),
    ).toBe("已提交，当前角色可直接审核。");
    expect(
      buildProcessDocumentStatusHint({
        status: "settled",
        isEditable: false,
        isReviewable: false,
      }),
    ).toBe("单据已计入结算，金额类字段已锁定。");
  });

  test("builds process document return query and batch summary", () => {
    const query = buildProcessDocumentReturnQuery("approved", "现场签证 A", "document-001");
    expect(query).toContain("refresh=process-documents");
    expect(query).toContain("resultStatus=approved");
    expect(query).toContain("resultKind=process-document");
    expect(query).toContain("resultId=document-001");

    expect(
      appendProcessDocumentBatchSummary(query, [
        {
          documentId: "document-001",
          title: "现场签证 A",
          status: "approved",
          detail: "",
        },
        {
          documentId: "document-002",
          title: "设计变更 B",
          status: "rejected",
          detail: "",
        },
      ]),
    ).toContain("batchCount=2");
  });

  test("picks the next actionable process document after one is completed", () => {
    expect(buildNextProcessDocumentActionState(processDocuments, "document-001")).toEqual({
      documentId: "document-002",
      mode: "approve",
      comment: "请补齐附件",
    });
  });

  test("picks rejected editable process documents for draft reopening", () => {
    expect(
      buildNextProcessDocumentActionState([
        {
          id: "document-003",
          status: "rejected",
          isEditable: true,
          isReviewable: false,
          lastComment: "补充依据",
        },
      ]),
    ).toEqual({
      documentId: "document-003",
      mode: "reopen",
      comment: "补充依据",
    });
  });
});
