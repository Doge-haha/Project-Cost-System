import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { apiClient, ApiError } from "../../lib/api";
import type { ProcessDocument, ProjectWorkspace } from "../../lib/types";
import {
  clearRecentProcessingLink,
  readRecentProcessingLink,
  saveRecentProcessingLink,
} from "./recent-processing-link";
import { RecentProcessingSummaryCard } from "./recent-processing-summary-card";
import { formatProjectDateTime } from "./project-date-utils";
import {
  appendProcessDocumentBatchSummary,
  buildNextProcessDocumentActionState,
  buildProcessDocumentReturnQuery,
  buildProcessDocumentStatusHint,
  formatDocumentType,
  normalizeProcessDocumentFilter,
  normalizeProcessDocumentSummaryFocus,
  type CompletedProcessDocumentState,
  type ProcessDocumentActionState,
  type ProcessDocumentFilter,
  type ProcessDocumentSummaryFocus,
} from "./project-process-documents-model";
import { buildAbsoluteAppUrl } from "./project-link-utils";
import { AppBreadcrumbs, buildProjectVersionBreadcrumbs } from "../shared/breadcrumbs";
import { EmptyState } from "../shared/empty-state";
import { ErrorState } from "../shared/error-state";
import { LoadingState } from "../shared/loading-state";

type ProjectProcessDocumentsState = {
  workspace: ProjectWorkspace;
  processDocuments: ProcessDocument[];
};

export function ProjectProcessDocumentsPage() {
  const params = useParams();
  const projectId = params.projectId;
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState<ProjectProcessDocumentsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionState, setActionState] = useState<ProcessDocumentActionState | null>(null);
  const [comment, setComment] = useState("");
  const [completedAction, setCompletedAction] = useState<ProcessDocumentActionState["mode"] | null>(
    null,
  );
  const [completedDocument, setCompletedDocument] = useState<CompletedProcessDocumentState | null>(
    null,
  );
  const [completedDocuments, setCompletedDocuments] = useState<CompletedProcessDocumentState[]>([]);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [copiedLinkPath, setCopiedLinkPath] = useState<string | null>(null);
  const [recentCopiedLink, setRecentCopiedLink] = useState(
    readRecentProcessingLink(projectId),
  );
  const focusedDocumentId = searchParams.get("documentId");
  const focusedAction = searchParams.get("action");
  const activeFilter = normalizeProcessDocumentFilter(searchParams.get("filter"));
  const summaryFocus = normalizeProcessDocumentSummaryFocus(searchParams.get("summaryFocus"));

  const activeDocument = useMemo(
    () =>
      actionState && state
        ? state.processDocuments.find((document) => document.id === actionState.documentId) ?? null
        : null,
    [actionState, state],
  );
  const completedDocumentDetail = useMemo(
    () =>
      completedDocument && state
        ? state.processDocuments.find((document) => document.id === completedDocument.documentId) ??
          null
        : null,
    [completedDocument, state],
  );
  const filteredDocuments = useMemo(() => {
    const documents = state?.processDocuments ?? [];
    if (activeFilter === "draft") {
      return documents.filter((document) => document.status === "draft");
    }
    if (activeFilter === "submitted") {
      return documents.filter((document) => document.status === "submitted");
    }
    if (activeFilter === "rejected") {
      return documents.filter((document) => document.status === "rejected");
    }
    if (activeFilter === "settled") {
      return documents.filter((document) => document.status === "settled");
    }
    if (activeFilter === "actionable") {
      return documents.filter(
        (document) =>
          (document.isEditable && document.status === "draft") ||
          (document.isReviewable && document.status === "submitted"),
      );
    }
    return documents;
  }, [activeFilter, state?.processDocuments]);
  const summaryFocusedDocumentId = useMemo(() => {
    if (actionState || !summaryFocus) {
      return null;
    }

    if (summaryFocus === "draft") {
      return (
        filteredDocuments.find((document) => document.isEditable && document.status === "draft")
          ?.id ??
        filteredDocuments[0]?.id ??
        null
      );
    }

    if (summaryFocus === "submitted") {
      return (
        filteredDocuments.find(
          (document) => document.isReviewable && document.status === "submitted",
        )?.id ??
        filteredDocuments[0]?.id ??
        null
      );
    }

    if (summaryFocus === "rejected") {
      return filteredDocuments[0]?.id ?? null;
    }

    if (summaryFocus === "settled") {
      return filteredDocuments[0]?.id ?? null;
    }

    return null;
  }, [actionState, filteredDocuments, summaryFocus]);
  const orderedDocuments = useMemo(() => {
    if (!summaryFocusedDocumentId) {
      return filteredDocuments;
    }

    const focusedDocument = filteredDocuments.find(
      (document) => document.id === summaryFocusedDocumentId,
    );
    if (!focusedDocument) {
      return filteredDocuments;
    }

    return [
      focusedDocument,
      ...filteredDocuments.filter((document) => document.id !== summaryFocusedDocumentId),
    ];
  }, [filteredDocuments, summaryFocusedDocumentId]);

  function syncFocusedDocumentParams(
    nextActionState: ProcessDocumentActionState | null,
    replace = false,
  ) {
    const next = new URLSearchParams(searchParams);

    if (nextActionState) {
      next.set("documentId", nextActionState.documentId);
      next.set("action", nextActionState.mode);
    } else {
      next.delete("documentId");
      next.delete("action");
    }

    setSearchParams(next, replace ? { replace: true } : undefined);
  }

  function openDocumentAction(nextActionState: ProcessDocumentActionState, nextComment = "") {
    setActionState(nextActionState);
    setComment(nextComment);
    syncFocusedDocumentParams(nextActionState);
  }

  function closeDocumentAction(replace = false) {
    setActionState(null);
    setComment("");
    syncFocusedDocumentParams(null, replace);
  }

  function applyFilter(nextFilter: ProcessDocumentFilter) {
    const next = new URLSearchParams(searchParams);
    if (nextFilter === "all") {
      next.delete("filter");
    } else {
      next.set("filter", nextFilter);
    }
    setSearchParams(next);
  }

  async function loadProcessDocuments() {
    if (!projectId) {
      setError("项目标识缺失，无法加载过程单据。");
      setLoading(false);
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const [workspace, processDocuments] = await Promise.all([
        apiClient.getProjectWorkspace(projectId),
        apiClient.listProcessDocuments(projectId),
      ]);

      const nextState = {
        workspace,
        processDocuments: processDocuments.items,
      };
      setState(nextState);
      return nextState;
    } catch (fetchError) {
      setError(
        fetchError instanceof ApiError
          ? fetchError.message
          : "过程单据加载失败，请检查 API 连通性。",
      );
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProcessDocuments();
  }, [projectId]);

  useEffect(() => {
    setRecentCopiedLink(readRecentProcessingLink(projectId));
  }, [projectId]);

  useEffect(() => {
    if (!state) {
      return;
    }

    if (!focusedDocumentId) {
      if (focusedAction) {
        syncFocusedDocumentParams(null, true);
      }
      return;
    }

    const target = state.processDocuments.find((document) => document.id === focusedDocumentId);
    if (!target) {
      syncFocusedDocumentParams(null, true);
      return;
    }

    const preferredMode =
      focusedAction === "submit" ||
      focusedAction === "approve" ||
      focusedAction === "reject" ||
      focusedAction === "reopen"
        ? focusedAction
        : null;

    const nextMode =
      preferredMode === "submit" && target.isEditable && target.status === "draft"
        ? "submit"
        : preferredMode === "reopen" && target.isEditable && target.status === "rejected"
          ? "reopen"
        : preferredMode === "approve" && target.isReviewable && target.status === "submitted"
          ? "approve"
          : preferredMode === "reject" && target.isReviewable && target.status === "submitted"
            ? "reject"
            : target.isEditable && target.status === "draft"
              ? "submit"
              : target.isEditable && target.status === "rejected"
                ? "reopen"
              : target.isReviewable && target.status === "submitted"
                ? "approve"
                : null;

    if (!nextMode) {
      syncFocusedDocumentParams(null, true);
      return;
    }

    setActionState({ mode: nextMode, documentId: target.id });
    setComment(target.lastComment ?? "");
    if (focusedAction !== nextMode) {
      syncFocusedDocumentParams({ mode: nextMode, documentId: target.id }, true);
    }
  }, [focusedAction, focusedDocumentId, searchParams, setSearchParams, state]);

  async function submitAction() {
    if (!projectId || !actionState || !activeDocument) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const nextStatus =
        actionState.mode === "submit"
          ? "submitted"
          : actionState.mode === "approve"
            ? "approved"
            : actionState.mode === "reopen"
              ? "draft"
              : "rejected";

      await apiClient.updateProcessDocumentStatus(
        projectId,
        activeDocument.id,
        nextStatus,
        comment.trim() || undefined,
      );

      const nextCompletedDocument = {
        documentId: activeDocument.id,
        title: activeDocument.title,
        status: nextStatus,
        detail: `备注：${comment.trim() || "无"}`,
      };
      setCompletedDocument(nextCompletedDocument);
      setCompletedDocuments((current) => [nextCompletedDocument, ...current].slice(0, 3));
      setCompletedAction(actionState.mode);
      closeDocumentAction(true);
      const nextState = await loadProcessDocuments();
      const nextActionState = buildNextProcessDocumentActionState(
        nextState?.processDocuments ?? [],
        activeDocument.id,
      );
      if (nextActionState) {
        setActionState({
          mode: nextActionState.mode,
          documentId: nextActionState.documentId,
        });
        setComment(nextActionState.comment);
        syncFocusedDocumentParams(
          {
            mode: nextActionState.mode,
            documentId: nextActionState.documentId,
          },
          true,
        );
      }
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : "过程单据处理失败，请稍后重试。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function copyCurrentProcessingLink() {
    if (
      !projectId ||
      !actionState ||
      typeof window === "undefined" ||
      !window.navigator?.clipboard?.writeText
    ) {
      setError("当前环境不支持复制链接，请手动复制地址栏。");
      return;
    }

    try {
      const copiedPath = `/projects/${projectId}/process-documents${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
      await window.navigator.clipboard.writeText(buildAbsoluteAppUrl(copiedPath));
      setCopyMessage("已复制当前处理链接，可直接发给协作同事。");
      setCopiedLinkPath(copiedPath);
      setRecentCopiedLink(
        saveRecentProcessingLink({
          projectId,
          path: copiedPath,
          label: "过程单据处理入口",
          sourceLabel: "过程单据页",
        }),
      );
      setError(null);
    } catch {
      setError("处理链接复制失败，请稍后重试。");
    }
  }

  if (loading) {
    return <LoadingState title="正在加载过程单据" />;
  }

  if (error && !state) {
    return (
      <ErrorState
        title="过程单据暂时不可用"
        body={error}
        onRetry={() => {
          void loadProcessDocuments();
        }}
      />
    );
  }

  if (!state || !projectId) {
    return (
      <EmptyState title="过程单据为空" body="还没有拿到过程单据数据，请稍后重试。" />
    );
  }

  const breadcrumbs = buildProjectVersionBreadcrumbs({
    currentLabel: "过程单据处理页",
    projectId,
    projectName: state.workspace.project.name,
    versionLabel: "过程单据",
  });

  return (
    <div className="page-stack">
      <AppBreadcrumbs items={breadcrumbs} />

      <header className="page-header">
        <div>
          <p className="app-eyebrow">{state.workspace.project.code}</p>
          <h2 className="page-title">过程单据处理页</h2>
          <p className="page-description">
            从项目待办页继续处理过程单据，优先消化待提交、待审核和退回单据。
          </p>
        </div>
      </header>

      {error ? <ErrorState body={error} /> : null}

      <section className="detail-grid">
        <article className="panel">
          <h3>单据列表</h3>
          <p className="page-description">
            共 {state.processDocuments.length} 条，待提交{" "}
            {state.processDocuments.filter((document) => document.status === "draft").length} 条，
            待审核{" "}
            {state.processDocuments.filter((document) => document.status === "submitted").length} 条，
            已结算{" "}
            {state.processDocuments.filter((document) => document.status === "settled").length} 条
          </p>
          <div className="version-card-actions">
            <button
              className="connection-button secondary"
              onClick={() => {
                applyFilter("all");
              }}
              type="button"
            >
              全部 {state.processDocuments.length}
            </button>
            <button
              className="connection-button secondary"
              onClick={() => {
                applyFilter("draft");
              }}
              type="button"
            >
              草稿 {state.processDocuments.filter((document) => document.status === "draft").length}
            </button>
            <button
              className="connection-button secondary"
              onClick={() => {
                applyFilter("submitted");
              }}
              type="button"
            >
              待审核{" "}
              {state.processDocuments.filter((document) => document.status === "submitted").length}
            </button>
            <button
              className="connection-button secondary"
              onClick={() => {
                applyFilter("actionable");
              }}
              type="button"
            >
              仅看我可处理{" "}
              {
                state.processDocuments.filter(
                  (document) =>
                    (document.isEditable && document.status === "draft") ||
                    (document.isReviewable && document.status === "submitted"),
                ).length
              }
            </button>
            <button
              className="connection-button secondary"
              onClick={() => {
                applyFilter("rejected");
              }}
              type="button"
            >
              已退回{" "}
              {state.processDocuments.filter((document) => document.status === "rejected").length}
            </button>
            <button
              className="connection-button secondary"
              onClick={() => {
                applyFilter("settled");
              }}
              type="button"
            >
              已结算{" "}
              {state.processDocuments.filter((document) => document.status === "settled").length}
            </button>
          </div>
          {activeFilter !== "all" ? (
            <p className="page-description">{`当前筛选：${activeFilter}`}</p>
          ) : null}
          {orderedDocuments.length > 0 ? (
            <div className="project-list">
              {orderedDocuments.map((document) => (
                <article
                  className={
                    document.id === activeDocument?.id ||
                    (!activeDocument && document.id === summaryFocusedDocumentId)
                      ? "list-card selected"
                      : "list-card"
                  }
                  key={document.id}
                >
                  <div className="version-card-header">
                    <div>
                      <h3>
                        {document.title} · {document.status}
                      </h3>
                      <p className="page-description">
                        {document.stageName} · {document.disciplineName} ·{" "}
                        {formatDocumentType(document.documentType)} · 提交于{" "}
                        {formatProjectDateTime(document.submittedAt)}
                      </p>
                    </div>
                    <span className="version-status-chip">{document.referenceNo}</span>
                  </div>
                  <p className="page-description">
                    {document.lastComment ?? "暂无备注"}
                  </p>
                  <p className="page-description">{buildProcessDocumentStatusHint(document)}</p>
                  <div className="version-card-actions">
                    {document.isEditable && document.status === "draft" ? (
                      <button
                        className="connection-button primary"
                        onClick={() => {
                          openDocumentAction(
                            { mode: "submit", documentId: document.id },
                            document.lastComment ?? "",
                          );
                        }}
                        type="button"
                      >
                        提交
                      </button>
                    ) : null}
                    {document.isReviewable && document.status === "submitted" ? (
                      <button
                        className="connection-button primary"
                        onClick={() => {
                          openDocumentAction(
                            { mode: "approve", documentId: document.id },
                            document.lastComment ?? "",
                          );
                        }}
                        type="button"
                      >
                        通过
                      </button>
                    ) : null}
                    {document.isReviewable && document.status === "submitted" ? (
                      <button
                        className="connection-button secondary"
                        onClick={() => {
                          openDocumentAction(
                            { mode: "reject", documentId: document.id },
                            document.lastComment ?? "",
                          );
                        }}
                        type="button"
                      >
                        驳回
                      </button>
                    ) : null}
                    {document.isEditable && document.status === "rejected" ? (
                      <button
                        className="connection-button primary"
                        onClick={() => {
                          openDocumentAction(
                            { mode: "reopen", documentId: document.id },
                            document.lastComment ?? "",
                          );
                        }}
                        type="button"
                      >
                        回退草稿
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title={activeFilter === "all" ? "没有过程单据" : "当前筛选下没有过程单据"}
              body="当前项目还没有符合条件的过程单据记录。"
            />
          )}
        </article>

        <article className={`panel ${actionState ? "panel-focus" : ""}`}>
          <h3>处理动作</h3>
          {activeDocument && actionState ? (
            <div className="page-stack">
              <p className="page-description">
                当前处理：{activeDocument.title} · {actionState.mode}
              </p>
              <div className="page-stack">
                <p className="page-description">
                  提交对象：{activeDocument.title} · {activeDocument.referenceNo} ·{" "}
                  {activeDocument.documentType}
                </p>
                <p className="page-description">提交人：{activeDocument.submittedBy}</p>
                <p className="page-description">
                  提交时间：{formatProjectDateTime(activeDocument.submittedAt)}
                </p>
              </div>
              <label className="connection-label">
                备注
                <textarea
                  aria-label="备注"
                  className="connection-textarea"
                  onChange={(event) => {
                    setComment(event.target.value);
                  }}
                  rows={4}
                  value={comment}
                />
              </label>
              <div className="connection-actions">
                <button
                  className="connection-button secondary"
                  disabled={submitting}
                  onClick={() => {
                    void copyCurrentProcessingLink();
                  }}
                  type="button"
                >
                  复制当前处理链接
                </button>
                <button
                  className="connection-button primary"
                  disabled={submitting}
                  onClick={() => {
                    void submitAction();
                  }}
                  type="button"
                >
                  {submitting ? "提交中" : "确认处理"}
                </button>
                <button
                  className="connection-button secondary"
                  disabled={submitting}
                  onClick={() => {
                    closeDocumentAction();
                  }}
                  type="button"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <EmptyState
              title="选择一条过程单据"
              body="从左侧选择可处理的过程单据，这里会出现提交、通过或驳回动作。"
            />
          )}
          {copyMessage ? (
            <div className="version-card-actions">
              <p className="page-description">{copyMessage}</p>
              {copiedLinkPath ? (
                <Link className="breadcrumbs-link" to={copiedLinkPath}>
                  打开刚复制入口
                </Link>
              ) : null}
            </div>
          ) : null}
          {!copyMessage && recentCopiedLink ? (
            <RecentProcessingSummaryCard
              formatDateTime={formatProjectDateTime}
              link={recentCopiedLink}
              onClear={() => {
                clearRecentProcessingLink();
                setRecentCopiedLink(null);
              }}
            />
          ) : null}
          {completedAction ? (
            <div className="project-list">
              <article className="project-link selected">
                <h3>{completedDocuments.length > 1 ? `本轮已处理 ${completedDocuments.length} 条` : "处理完成"}</h3>
                <p className="page-description">
                  {completedDocument?.title ?? "当前过程单据"} 已完成本次处理，可回到工作台继续查看刷新后的摘要和最近动态。
                </p>
                {completedDocuments.length > 1 ? (
                  <ul className="inline-list">
                    {completedDocuments.map((document) => (
                      <li key={document.documentId}>{`${document.title} · ${document.status} · ${document.detail}`}</li>
                    ))}
                  </ul>
                ) : completedDocumentDetail ? (
                  <>
                    <p className="page-description">{`当前状态：${completedDocumentDetail.status}`}</p>
                    <p className="page-description">{`当前备注：${completedDocumentDetail.lastComment ?? "无"}`}</p>
                  </>
                ) : (
                  <p className="page-description">
                    过程单据已
                    {completedAction === "submit"
                      ? "提交"
                      : completedAction === "approve"
                        ? "通过"
                        : "驳回"}
                    。
                  </p>
                )}
                <div className="version-card-actions">
                  <Link
                    className="app-nav-link active"
                    to={`/projects/${projectId}?${appendProcessDocumentBatchSummary(
                      buildProcessDocumentReturnQuery(
                        completedDocumentDetail?.status ?? "approved",
                        completedDocument?.title ?? "当前过程单据",
                        completedDocument?.documentId ?? "",
                      ),
                      completedDocuments,
                    )}`}
                  >
                    返回项目工作台
                  </Link>
                  <Link
                    className="app-nav-link active"
                    to={`/projects/${projectId}/inbox?focus=risk&${appendProcessDocumentBatchSummary(
                      buildProcessDocumentReturnQuery(
                        completedDocumentDetail?.status ?? "approved",
                        completedDocument?.title ?? "当前过程单据",
                        completedDocument?.documentId ?? "",
                      ),
                      completedDocuments,
                    )}`}
                  >
                    返回待办页
                  </Link>
                </div>
              </article>
            </div>
          ) : null}
          <div className="project-list">
            <Link className="project-link" to={`/projects/${projectId}/inbox?focus=risk`}>
              <h3>返回待办页</h3>
              <p className="page-description">回到工作台待办页查看审核、风险和任务状态。</p>
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}
