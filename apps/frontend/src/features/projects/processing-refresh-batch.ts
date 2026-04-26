export type ProcessingRefreshBatchEntry = {
  id: string;
  label: string;
  path: string;
  sourceType: "review" | "process-document";
};

function buildRefreshAction(status: string | null) {
  if (status === "approved") {
    return "approve";
  }
  if (status === "rejected") {
    return "reject";
  }
  if (status === "cancelled") {
    return "cancel";
  }
  if (status === "submitted") {
    return "submit";
  }
  return null;
}

function buildRefreshItemPath(
  projectId: string,
  kind: string | null,
  id: string,
  status: string | null,
) {
  const action = buildRefreshAction(status);

  if (kind === "review") {
    return `/projects/${projectId}/reviews?reviewId=${id}${action ? `&action=${action}` : ""}`;
  }

  if (kind === "process-document") {
    return `/projects/${projectId}/process-documents?documentId=${id}${action ? `&action=${action}` : ""}`;
  }

  return null;
}

export function buildProcessingRefreshBatchEntries({
  projectId,
  refreshItemKind,
  refreshResultStatus,
  refreshBatchIds,
  refreshBatchSummary,
}: {
  projectId: string;
  refreshItemKind: string | null;
  refreshResultStatus: string | null;
  refreshBatchIds: string[];
  refreshBatchSummary: string | null;
}): ProcessingRefreshBatchEntry[] {
  const labels = (refreshBatchSummary ?? "")
    .split("、")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return refreshBatchIds
    .map((id, index) => {
      const path = buildRefreshItemPath(
        projectId,
        refreshItemKind,
        id,
        refreshResultStatus,
      );

      if (!path) {
        return null;
      }

      return {
        id,
        label: labels[index] ?? id,
        path,
        sourceType: refreshItemKind,
      };
    })
    .filter((item): item is ProcessingRefreshBatchEntry => item !== null);
}
