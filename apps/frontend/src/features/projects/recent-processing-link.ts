export type RecentProcessingBatchEntry = {
  id: string;
  label: string;
  path: string;
  sourceType?: "review" | "process-document" | "job";
};

export type RecentProcessingLink = {
  projectId: string;
  path: string;
  label: string;
  collaborationUnitLabel?: string | null;
  sourceLabel: string;
  copiedAt: string;
  actionType: "copied" | "batch-refresh";
  batchEntries?: RecentProcessingBatchEntry[];
  batchEntriesExpandedPreference?: boolean | null;
  highlightedBatchEntryId?: string | null;
  highlightedBatchEntryLabel?: string | null;
  highlightedBatchEntryPath?: string | null;
};

const storageKey = "saas-pricing-frontend.recent-processing-link";

function inferBatchEntrySourceType(path: string) {
  if (path.includes("/reviews")) {
    return "review" as const;
  }
  if (path.includes("/process-documents")) {
    return "process-document" as const;
  }
  if (path.includes("/jobs")) {
    return "job" as const;
  }
  return undefined;
}

function inferSourceLabel(path: string) {
  if (path.includes("/reviews")) {
    return "审核处理页";
  }
  if (path.includes("/process-documents")) {
    return "过程单据页";
  }
  if (path.includes("/jobs")) {
    return "任务状态页";
  }
  if (path.includes("/inbox")) {
    return "待办页";
  }
  if (path.includes("/projects/")) {
    return "项目工作台";
  }
  return "协作页";
}

function normalizeRecentProcessingLink(
  input: Partial<RecentProcessingLink> | null,
): RecentProcessingLink | null {
  if (!input) {
    return null;
  }

  if (
    typeof input.projectId !== "string" ||
    input.projectId.length === 0 ||
    typeof input.path !== "string" ||
    input.path.length === 0 ||
    typeof input.label !== "string" ||
    input.label.length === 0
  ) {
    return null;
  }

  return {
    projectId: input.projectId,
    path: input.path,
    label: input.label,
    collaborationUnitLabel:
      typeof input.collaborationUnitLabel === "string" &&
      input.collaborationUnitLabel.length > 0
        ? input.collaborationUnitLabel
        : null,
    sourceLabel:
      typeof input.sourceLabel === "string" && input.sourceLabel.length > 0
        ? input.sourceLabel
        : inferSourceLabel(input.path ?? ""),
    copiedAt:
      typeof input.copiedAt === "string" && input.copiedAt.length > 0
        ? input.copiedAt
        : new Date().toISOString(),
    actionType: input.actionType === "batch-refresh" ? "batch-refresh" : "copied",
    batchEntriesExpandedPreference:
      typeof input.batchEntriesExpandedPreference === "boolean"
        ? input.batchEntriesExpandedPreference
        : null,
    highlightedBatchEntryId:
      typeof input.highlightedBatchEntryId === "string" && input.highlightedBatchEntryId.length > 0
        ? input.highlightedBatchEntryId
        : null,
    highlightedBatchEntryLabel:
      typeof input.highlightedBatchEntryLabel === "string" &&
      input.highlightedBatchEntryLabel.length > 0
        ? input.highlightedBatchEntryLabel
        : null,
    highlightedBatchEntryPath:
      typeof input.highlightedBatchEntryPath === "string" &&
      input.highlightedBatchEntryPath.length > 0
        ? input.highlightedBatchEntryPath
        : null,
    batchEntries: Array.isArray(input.batchEntries)
      ? input.batchEntries.filter(
          (entry): entry is RecentProcessingBatchEntry =>
            typeof entry?.id === "string" &&
            entry.id.length > 0 &&
            typeof entry.label === "string" &&
            entry.label.length > 0 &&
            typeof entry.path === "string" &&
            entry.path.length > 0 &&
            (entry.sourceType === undefined ||
              entry.sourceType === "review" ||
              entry.sourceType === "process-document" ||
              entry.sourceType === "job"),
        )
        .map((entry) => ({
          ...entry,
          sourceType: entry.sourceType ?? inferBatchEntrySourceType(entry.path),
        }))
      : [],
  };
}

export function readRecentProcessingLink(projectId: string | null | undefined) {
  if (!projectId || typeof window === "undefined") {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(storageKey);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = normalizeRecentProcessingLink(
      JSON.parse(rawValue) as Partial<RecentProcessingLink>,
    );
    if (!parsed || parsed.projectId !== projectId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveRecentProcessingLink(input: {
  projectId: string;
  path: string;
  label: string;
  collaborationUnitLabel?: string | null;
  sourceLabel?: string;
  actionType?: "copied" | "batch-refresh";
  batchEntries?: RecentProcessingBatchEntry[];
  batchEntriesExpandedPreference?: boolean | null;
  highlightedBatchEntryId?: string | null;
  highlightedBatchEntryLabel?: string | null;
  highlightedBatchEntryPath?: string | null;
}) {
  if (typeof window === "undefined") {
    return null;
  }

  const nextValue = normalizeRecentProcessingLink({
    ...input,
    copiedAt: new Date().toISOString(),
  });
  if (!nextValue) {
    return null;
  }

  window.sessionStorage.setItem(storageKey, JSON.stringify(nextValue));
  return nextValue;
}

export function clearRecentProcessingLink() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(storageKey);
}

export function buildRecentProcessingSummary(link: RecentProcessingLink) {
  return link.actionType === "batch-refresh"
    ? `最近协作动作：${link.sourceLabel}记录了${link.label}`
    : `最近协作动作：${link.sourceLabel}复制了${link.label}`;
}
