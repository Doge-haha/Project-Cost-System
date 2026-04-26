import type { ProcessDocument } from "../../lib/types";

export type ProcessDocumentFilter = "all" | "draft" | "submitted" | "rejected" | "actionable";
export type ProcessDocumentSummaryFocus = "draft" | "submitted" | "rejected" | null;

export type CompletedProcessDocumentState = {
  documentId: string;
  title: string;
  status: string;
  detail: string;
};

export type ProcessDocumentActionState = {
  mode: "submit" | "approve" | "reject" | "reopen";
  documentId: string;
};

type ProcessDocumentStatusHintInput = {
  status: "draft" | "submitted" | "approved" | "rejected" | "settled";
  isEditable: boolean;
  isReviewable: boolean;
};

type ProcessDocumentActionCandidate = {
  id: string;
  status: "draft" | "submitted" | "approved" | "rejected" | "settled";
  isEditable: boolean;
  isReviewable: boolean;
  lastComment?: string | null;
};

export function formatDocumentType(value: ProcessDocument["documentType"]) {
  if (value === "change_order") {
    return "设计变更";
  }
  if (value === "site_visa") {
    return "现场签证";
  }
  return "进度款";
}

export function buildProcessDocumentStatusHint(document: ProcessDocumentStatusHintInput) {
  if (document.status === "draft" && document.isEditable) {
    return "草稿待完善，当前角色可直接补充后提交。";
  }
  if (document.status === "draft") {
    return "草稿待完善，当前角色暂无编辑权限，请等待负责人补充。";
  }
  if (document.status === "submitted" && document.isReviewable) {
    return "已提交，当前角色可直接审核。";
  }
  if (document.status === "submitted") {
    return "已提交，正在等待审核人处理。";
  }
  if (document.status === "approved") {
    return "单据已通过，可回到工作台继续跟进后续联动。";
  }
  if (document.status === "settled") {
    return "单据已计入结算，金额类字段已锁定。";
  }
  if (document.isEditable) {
    return "单据已退回，当前角色可回退草稿补充后重新提交。";
  }
  return "单据已退回，建议先根据备注补充后再重新提交。";
}

export function buildProcessDocumentReturnQuery(
  resultStatus: string,
  title: string,
  documentId: string,
) {
  const query = new URLSearchParams();
  query.set("refresh", "process-documents");
  query.set("resultStatus", resultStatus);
  query.set("resultName", title);
  query.set("resultKind", "process-document");
  query.set("resultId", documentId);
  return query.toString();
}

export function appendProcessDocumentBatchSummary(
  queryString: string,
  completedDocuments: CompletedProcessDocumentState[],
) {
  if (completedDocuments.length <= 1) {
    return queryString;
  }

  const query = new URLSearchParams(queryString);
  query.set("batchCount", String(completedDocuments.length));
  query.set(
    "batchSummary",
    completedDocuments
      .map(
        (document) =>
          `${document.title}${
            document.status === "approved"
              ? "已通过"
              : document.status === "rejected"
                ? "已驳回"
                : document.status === "draft"
                  ? "已回退草稿"
                  : "已提交"
          }`,
      )
      .join("、"),
  );
  query.set("batchIds", completedDocuments.map((document) => document.documentId).join(","));
  return query.toString();
}

export function normalizeProcessDocumentFilter(
  value: string | null,
): ProcessDocumentFilter {
  if (
    value === "draft" ||
    value === "submitted" ||
    value === "rejected" ||
    value === "actionable"
  ) {
    return value;
  }
  return "all";
}

export function normalizeProcessDocumentSummaryFocus(
  value: string | null,
): ProcessDocumentSummaryFocus {
  if (value === "draft" || value === "submitted" || value === "rejected") {
    return value;
  }
  return null;
}

export function buildNextProcessDocumentActionState(
  documents: ProcessDocumentActionCandidate[],
  excludeDocumentId?: string,
) {
  const nextDocument = documents.find(
    (document) =>
      document.id !== excludeDocumentId &&
      ((document.isEditable && document.status === "draft") ||
        (document.isEditable && document.status === "rejected") ||
        (document.isReviewable && document.status === "submitted")),
  );

  if (!nextDocument) {
    return null;
  }

  return {
    documentId: nextDocument.id,
    mode:
      nextDocument.isEditable && nextDocument.status === "draft"
        ? ("submit" as const)
        : nextDocument.isEditable && nextDocument.status === "rejected"
          ? ("reopen" as const)
          : ("approve" as const),
    comment: nextDocument.lastComment ?? "",
  };
}
