import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import {
  buildRecentProcessingSummary,
  saveRecentProcessingLink,
  type RecentProcessingLink,
} from "./recent-processing-link";
import { formatProjectDateTime } from "./project-date-utils";

type RecentProcessingSummaryCardProps = {
  link: RecentProcessingLink;
  formatDateTime: (value: string) => string;
  onClear: () => void;
};

function buildSourceActionLabel(link: RecentProcessingLink) {
  if (typeof window === "undefined") {
    return `回到${link.sourceLabel}`;
  }

  const url = new URL(link.path, window.location.origin);
  if (link.sourceLabel === "审核处理页") {
    const filter = url.searchParams.get("filter");
    const filterLabel =
      filter === "pending" ? "待处理" : filter === "rejected" ? "已驳回" : null;
    if (filterLabel) {
      return `回到审核处理页（${filterLabel}）`;
    }
  }

  if (link.sourceLabel === "待办页") {
    const focus = url.searchParams.get("focus");
    const focusLabel =
      focus === "todo" ? "待办" : focus === "risk" ? "风险" : focus === "import" ? "导入" : null;
    if (focusLabel) {
      return `回到待办页（${focusLabel}）`;
    }
  }

  if (link.sourceLabel === "过程单据页") {
    const filter = url.searchParams.get("filter");
    const filterLabel =
      filter === "submitted"
        ? "待审核"
        : filter === "draft"
          ? "草稿"
          : filter === "rejected"
            ? "已驳回"
            : null;
    if (filterLabel) {
      return `回到过程单据页（${filterLabel}）`;
    }
  }

  if (link.sourceLabel === "项目工作台") {
    const refresh = url.searchParams.get("refresh");
    const refreshLabel =
      refresh === "reviews"
        ? "审核摘要"
        : refresh === "process-documents"
          ? "过程单据摘要"
          : refresh === "jobs"
            ? "导入摘要"
            : null;
    if (refreshLabel) {
      return `回到项目工作台（${refreshLabel}）`;
    }
  }

  if (link.sourceLabel === "任务状态页") {
    const status = url.searchParams.get("status");
    const statusLabel =
      status === "failed"
        ? "失败"
        : status === "processing"
          ? "处理中"
          : status === "completed"
            ? "已完成"
            : status === "queued"
              ? "排队中"
              : null;
    if (statusLabel) {
      return `回到任务状态页（${statusLabel}）`;
    }
  }

  return `回到${link.sourceLabel}`;
}

export function RecentProcessingSummaryCard({
  link,
  formatDateTime,
  onClear,
}: RecentProcessingSummaryCardProps) {
  const location = useLocation();
  const batchEntryRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const [expanded, setExpanded] = useState(false);
  const [expandedByHighlight, setExpandedByHighlight] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [highlightedBatchEntryId, setHighlightedBatchEntryId] = useState<string | null>(
    link.highlightedBatchEntryId ?? null,
  );
  const [highlightedBatchEntryLabel, setHighlightedBatchEntryLabel] = useState<string | null>(
    link.highlightedBatchEntryLabel ?? null,
  );
  const [highlightedBatchEntryPath, setHighlightedBatchEntryPath] = useState<string | null>(
    link.highlightedBatchEntryPath ?? null,
  );
  const batchEntryCount = link.batchEntries?.length ?? 0;
  const hasBatchEntries = batchEntryCount > 0;
  const batchEntriesId = `recent-processing-batch-${link.projectId}-${link.copiedAt}`;
  const sourcePathname =
    typeof window === "undefined" ? link.path : new URL(link.path, window.location.origin).pathname;
  const sourceIsCurrentPage = location.pathname === sourcePathname;
  const sourceActionLabel = buildSourceActionLabel(link);
  const groupedBatchEntries = hasBatchEntries
      ? (link.batchEntries ?? []).reduce<
        Array<{
          key: "review" | "process-document" | "job" | "unknown";
          title: string;
          entries: NonNullable<RecentProcessingLink["batchEntries"]>;
        }>
      >((groups, entry) => {
        const key = entry.sourceType ?? "unknown";
        const existingGroup = groups.find((group) => group.key === key);

        if (existingGroup) {
          existingGroup.entries.push(entry);
          return groups;
        }

        groups.push({
          key,
          title:
            key === "review"
              ? "审核对象"
              : key === "process-document"
                ? "过程单据对象"
                : key === "job"
                  ? "失败条目"
                : "协作对象",
          entries: [entry],
        });
        return groups;
      }, [])
    : [];

  useEffect(() => {
    const nextExpanded = Boolean(link.highlightedBatchEntryId);
    setExpanded(
      nextExpanded
        ? true
        : hasBatchEntries && typeof link.batchEntriesExpandedPreference === "boolean"
          ? link.batchEntriesExpandedPreference
          : false,
    );
    setExpandedByHighlight(nextExpanded);
    setCopyMessage(null);
    setCopiedPath(null);
    setHighlightedBatchEntryId(link.highlightedBatchEntryId ?? null);
    setHighlightedBatchEntryLabel(link.highlightedBatchEntryLabel ?? null);
    setHighlightedBatchEntryPath(link.highlightedBatchEntryPath ?? null);
  }, [hasBatchEntries, link.batchEntriesExpandedPreference, link.copiedAt, link.path]);

  useEffect(() => {
    if (!expanded || !highlightedBatchEntryId) {
      return;
    }

    const target = batchEntryRefs.current[highlightedBatchEntryId];
    if (typeof target?.scrollIntoView === "function") {
      target.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [expanded, highlightedBatchEntryId]);

  useEffect(() => {
    if (!copyMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCopyMessage(null);
      setCopiedPath(null);
    }, 2500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [copyMessage]);

  async function copyBatchEntryPath(entry: {
    id: string;
    label: string;
    path: string;
  }) {
    if (typeof window === "undefined" || !window.navigator?.clipboard?.writeText) {
      return;
    }

    await window.navigator.clipboard.writeText(new URL(entry.path, window.location.origin).toString());
    saveRecentProcessingLink({
      projectId: link.projectId,
      path: link.path,
      label: link.label,
      sourceLabel: link.sourceLabel,
      actionType: link.actionType,
      batchEntries: link.batchEntries,
      batchEntriesExpandedPreference: true,
      highlightedBatchEntryId: entry.id,
      highlightedBatchEntryLabel: entry.label,
      highlightedBatchEntryPath: entry.path,
    });
    setCopyMessage(`已复制${entry.label}入口，可直接发给协作同事。`);
    setCopiedPath(entry.path);
    setExpanded(true);
    setExpandedByHighlight(true);
    setHighlightedBatchEntryId(entry.id);
    setHighlightedBatchEntryLabel(entry.label);
    setHighlightedBatchEntryPath(entry.path);
  }

  function clearHighlightedBatchEntry() {
    saveRecentProcessingLink({
      projectId: link.projectId,
      path: link.path,
      label: link.label,
      sourceLabel: link.sourceLabel,
      actionType: link.actionType,
      batchEntries: link.batchEntries,
      batchEntriesExpandedPreference: expandedByHighlight ? null : expanded,
      highlightedBatchEntryId: null,
      highlightedBatchEntryLabel: null,
      highlightedBatchEntryPath: null,
    });
    setCopyMessage(null);
    setCopiedPath(null);
    if (expandedByHighlight) {
      setExpanded(false);
    }
    setExpandedByHighlight(false);
    setHighlightedBatchEntryId(null);
    setHighlightedBatchEntryLabel(null);
    setHighlightedBatchEntryPath(null);
  }

  return (
    <div className="version-card-actions">
      <p className="page-description">{buildRecentProcessingSummary(link)}</p>
      {link.collaborationUnitLabel ? (
        <p className="page-description">
          当前协作处理单元：{link.collaborationUnitLabel}
        </p>
      ) : null}
      <p className="page-description">{`协作时间：${formatProjectDateTime(link.copiedAt)}`}</p>
      <div className="recent-processing-action-block recent-processing-action-block-primary">
        <p className="page-description recent-processing-action-caption">
          {hasBatchEntries ? "本轮来源：" : "来源入口："}
          {sourceIsCurrentPage ? "已在此处" : sourceActionLabel}
        </p>
        <div className="recent-processing-action-links">
          {!sourceIsCurrentPage ? (
            <Link
              className="breadcrumbs-link recent-processing-action-link recent-processing-action-link-primary"
              to={link.path}
            >
              {sourceActionLabel}
            </Link>
          ) : (
            <Link
              className="breadcrumbs-link recent-processing-action-link recent-processing-action-link-secondary"
              to={link.path}
            >
              打开最近协作入口
            </Link>
          )}
        </div>
      </div>
      {hasBatchEntries ? (
        <>
          <p className="page-description">{`本轮对象：${batchEntryCount} 条`}</p>
          <button
            aria-controls={batchEntriesId}
            aria-expanded={expanded}
            className="connection-button secondary"
            onClick={() => {
              const nextExpanded = !expanded;
              setExpanded(nextExpanded);
              setExpandedByHighlight(false);
              saveRecentProcessingLink({
                projectId: link.projectId,
                path: link.path,
                label: link.label,
                sourceLabel: link.sourceLabel,
                actionType: link.actionType,
                batchEntries: link.batchEntries,
                batchEntriesExpandedPreference: nextExpanded,
                highlightedBatchEntryId,
                highlightedBatchEntryLabel,
                highlightedBatchEntryPath,
              });
            }}
            type="button"
          >
            {expanded ? `收起本轮对象（${batchEntryCount}）` : `展开本轮对象（${batchEntryCount}）`}
          </button>
          {expanded ? (
            <ul className="inline-list" id={batchEntriesId}>
              {groupedBatchEntries.map((group) => (
                <li key={group.key}>
                  <span>{group.title}：</span>
                  {group.entries.map((entry, index) => (
                    <span key={entry.id}>
                      <span
                        ref={(node) => {
                          batchEntryRefs.current[entry.id] = node;
                        }}
                      />
                      {index > 0 ? "、" : ""}
                      <Link className="breadcrumbs-link" to={entry.path}>
                        {entry.label}
                      </Link>
                      {highlightedBatchEntryId === entry.id ? (
                        <span>{`（最近复制）`}</span>
                      ) : null}
                      <button
                        className="connection-button secondary"
                        onClick={() => {
                          void copyBatchEntryPath(entry);
                        }}
                        type="button"
                      >
                        复制入口
                      </button>
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
      {copyMessage ? (
        <div className="recent-processing-action-block recent-processing-action-block-secondary">
          <p className="page-description recent-processing-action-caption">{copyMessage}</p>
          {copiedPath ? (
            <Link
              className="breadcrumbs-link recent-processing-action-link recent-processing-action-link-secondary"
              to={copiedPath}
            >
              打开刚复制入口
            </Link>
          ) : null}
        </div>
      ) : null}
      {highlightedBatchEntryLabel ? (
        <div className="recent-processing-action-block recent-processing-action-block-secondary">
          <p className="page-description recent-processing-action-caption">{`最近复制对象：${highlightedBatchEntryLabel}`}</p>
          <div className="recent-processing-action-links">
            {highlightedBatchEntryPath ? (
              <Link
                className="breadcrumbs-link recent-processing-action-link recent-processing-action-link-secondary"
                to={highlightedBatchEntryPath}
              >
                打开最近复制对象
              </Link>
            ) : null}
            <button
              className="connection-button secondary"
              onClick={clearHighlightedBatchEntry}
              type="button"
            >
              清除最近复制对象
            </button>
          </div>
        </div>
      ) : null}
      <button className="connection-button secondary" onClick={onClear} type="button">
        清除最近协作记录
      </button>
    </div>
  );
}
