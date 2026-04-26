import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { apiClient, ApiError } from "../../lib/api";
import type {
  BackgroundJobListResponse,
  ProcessDocumentListResponse,
  ProjectWorkspace,
  ReviewSubmissionListResponse,
} from "../../lib/types";
import { AppBreadcrumbs, buildProjectVersionBreadcrumbs } from "../shared/breadcrumbs";
import { EmptyState } from "../shared/empty-state";
import { ErrorState } from "../shared/error-state";
import { LoadingState } from "../shared/loading-state";
import {
  appendFailureCollaborationParams,
  buildFailureCollaborationUnitLabel,
  formatFailureReasonLabel,
  normalizeFailureSubsetFilter,
  normalizeFailureReason,
} from "./failure-reason-label";
import {
  clearRecentProcessingLink,
  readRecentProcessingLink,
  saveRecentProcessingLink,
} from "./recent-processing-link";
import { RecentProcessingSummaryCard } from "./recent-processing-summary-card";
import { formatProjectDateTime } from "./project-date-utils";
import {
  buildAdjustedProcessDocumentSummary,
  buildAdjustedReviewSummary,
  normalizeRefreshResultKind,
  normalizeRefreshResultStatus,
} from "./processing-refresh-summary";
import { buildProcessingRefreshBatchEntries } from "./processing-refresh-batch";
import {
  buildInboxFocusTitle,
  buildInboxBatchRefreshLabel,
  buildInboxRefreshNotice,
  formatJobType,
} from "./project-workspace-inbox-model";
import { buildAbsoluteAppUrl } from "./project-link-utils";
import { clearRefreshState, formatResultStatus } from "./project-detail-model";

type InboxState = {
  workspace: ProjectWorkspace;
  reviews: ReviewSubmissionListResponse;
  processDocuments: ProcessDocumentListResponse;
  jobs: BackgroundJobListResponse;
};

export function ProjectWorkspaceInboxPage() {
  const params = useParams();
  const projectId = params.projectId;
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState<InboxState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [copiedLinkPath, setCopiedLinkPath] = useState<string | null>(null);
  const [recentCopiedLink, setRecentCopiedLink] = useState(
    readRecentProcessingLink(projectId),
  );

  const focus = searchParams.get("focus") ?? "todo";
  const refreshSource = searchParams.get("refresh");
  const refreshResultStatus = normalizeRefreshResultStatus(searchParams.get("resultStatus"));
  const refreshResult = formatResultStatus(refreshResultStatus);
  const refreshItemName = searchParams.get("resultName");
  const refreshItemKind = normalizeRefreshResultKind(searchParams.get("resultKind"));
  const refreshItemId = searchParams.get("resultId");
  const refreshBatchCount = Number(searchParams.get("batchCount") ?? "0");
  const refreshBatchSummary = searchParams.get("batchSummary");
  const refreshBatchIdList = useMemo(
    () =>
      (searchParams.get("batchIds") ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    [searchParams],
  );
  const refreshBatchIds = useMemo(
    () => new Set(refreshBatchIdList),
    [refreshBatchIdList],
  );
  const failureReason = normalizeFailureReason(searchParams.get("failureReason"));
  const failureReasonLabel = formatFailureReasonLabel(failureReason);
  const failureResourceType = normalizeFailureSubsetFilter(
    searchParams.get("failureResourceType"),
  );
  const failureAction = normalizeFailureSubsetFilter(searchParams.get("failureAction"));
  const failureCollaborationUnitLabel = useMemo(
    () =>
      failureReasonLabel
        ? buildFailureCollaborationUnitLabel({
            failureReasonLabel,
            failureResourceType,
            failureAction,
          })
        : null,
    [failureAction, failureReasonLabel, failureResourceType],
  );
  const focusTitle = useMemo(() => buildInboxFocusTitle(focus), [focus]);
  const refreshNotice = buildInboxRefreshNotice({
    refreshSource,
    refreshBatchCount,
    refreshBatchSummary,
    refreshResult,
    refreshItemName,
  });
  const refreshBatchEntries = projectId
    ? buildProcessingRefreshBatchEntries({
        projectId,
        refreshItemKind,
        refreshResultStatus,
        refreshBatchIds: refreshBatchIdList,
        refreshBatchSummary,
      })
    : [];

  async function loadInbox() {
    if (!projectId) {
      setError("项目标识缺失，无法加载工作台待办。");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [workspace, reviews, processDocuments, jobs] = await Promise.all([
        apiClient.getProjectWorkspace(projectId),
        apiClient.listProjectReviews(projectId),
        apiClient.listProcessDocuments(projectId),
        apiClient.listBackgroundJobs(projectId),
      ]);

      setState({
        workspace,
        reviews,
        processDocuments,
        jobs,
      });
    } catch (fetchError) {
      setError(
        fetchError instanceof ApiError
          ? fetchError.message
          : "工作台待办加载失败，请检查 API 连通性。",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInbox();
  }, [projectId]);

  useEffect(() => {
    const rawFailureReason = searchParams.get("failureReason");
    if (!rawFailureReason || rawFailureReason === failureReason) {
      return;
    }

    const next = new URLSearchParams(searchParams);
    next.delete("failureReason");
    next.delete("failureResourceType");
    next.delete("failureAction");
    setSearchParams(next, { replace: true });
  }, [failureReason, searchParams, setSearchParams]);

  useEffect(() => {
    if (failureReason) {
      return;
    }

    if (!searchParams.get("failureResourceType") && !searchParams.get("failureAction")) {
      return;
    }

    const next = new URLSearchParams(searchParams);
    next.delete("failureResourceType");
    next.delete("failureAction");
    setSearchParams(next, { replace: true });
  }, [failureReason, searchParams, setSearchParams]);

  useEffect(() => {
    setCopyMessage(null);
    setCopiedLinkPath(null);
  }, [failureReason]);

  useEffect(() => {
    setRecentCopiedLink(readRecentProcessingLink(projectId));
  }, [projectId]);

  useEffect(() => {
    if (!copyMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCopyMessage(null);
      setCopiedLinkPath(null);
    }, 2500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [copyMessage]);

  async function copyCurrentInboxLink() {
    if (typeof window === "undefined" || !window.navigator?.clipboard?.writeText) {
      setError("当前环境不支持复制链接，请手动复制地址栏。");
      return;
    }

    try {
      const url = new URL(window.location.href);
      url.search = searchParams.toString();
      await window.navigator.clipboard.writeText(url.toString());
      const copiedPath = `/projects/${projectId}/inbox${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
      setCopyMessage("已复制当前回流链接，可直接发给协作同事。");
      setCopiedLinkPath(copiedPath);
      setRecentCopiedLink(
        saveRecentProcessingLink({
          projectId: projectId ?? "",
          path: copiedPath,
          label: "项目待办回流视角",
          collaborationUnitLabel: failureCollaborationUnitLabel,
          sourceLabel: "项目待办页",
        }),
      );
      setError(null);
    } catch {
      setError("回流链接复制失败，请稍后重试。");
    }
  }

  async function copyResourceActionLink(path: string, resourceLabel: string) {
    if (typeof window === "undefined" || !window.navigator?.clipboard?.writeText) {
      setError("当前环境不支持复制链接，请手动复制地址栏。");
      return;
    }

    try {
      await window.navigator.clipboard.writeText(buildAbsoluteAppUrl(path));
      setCopyMessage(`已复制${resourceLabel}处理链接，可直接发给协作同事。`);
      setCopiedLinkPath(path);
      setRecentCopiedLink(
        saveRecentProcessingLink({
          projectId: projectId ?? "",
          path,
          label: `${resourceLabel}处理入口`,
          sourceLabel: "项目待办页",
        }),
      );
      setError(null);
    } catch {
      setError("处理链接复制失败，请稍后重试。");
    }
  }

  function clearCollaborationView() {
    const next = new URLSearchParams(searchParams);
    next.delete("failureReason");
    next.delete("failureResourceType");
    next.delete("failureAction");
    setSearchParams(next);
  }

  function dismissRefreshNotice() {
    const batchRefreshLabel = buildInboxBatchRefreshLabel({
      refreshSource,
      refreshBatchCount,
      refreshBatchSummary,
    });

    if (projectId && batchRefreshLabel && refreshSource) {
      const currentPath = `/projects/${projectId}/inbox${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
      setRecentCopiedLink(
        saveRecentProcessingLink({
          projectId,
          path: currentPath,
          label: batchRefreshLabel,
          sourceLabel: "待办页",
          actionType: "batch-refresh",
          batchEntries: refreshBatchEntries,
        }),
      );
    }

    setSearchParams(clearRefreshState(searchParams), { replace: true });
  }

  if (loading) {
    return <LoadingState title="正在加载工作台待办" />;
  }

  if (error) {
    return (
      <ErrorState
        title="工作台待办暂时不可用"
        body={error}
        onRetry={() => {
          void loadInbox();
        }}
      />
    );
  }

  if (!state || !projectId) {
    return (
      <EmptyState
        title="工作台待办为空"
        body="还没有拿到工作台待办数据，请稍后重试。"
      />
    );
  }

  const { workspace, reviews, processDocuments, jobs } = state;
  const adjustedReviewSummary = buildAdjustedReviewSummary(
    reviews,
    refreshItemKind,
    refreshResultStatus,
  );
  const adjustedProcessDocumentSummary = buildAdjustedProcessDocumentSummary(
    processDocuments,
    refreshItemKind,
    refreshResultStatus,
  );
  const breadcrumbs = buildProjectVersionBreadcrumbs({
    currentLabel: "待办页",
    projectId,
    projectName: workspace.project.name,
    versionLabel: focusTitle,
  });

  return (
    <div className="page-stack">
      <AppBreadcrumbs items={breadcrumbs} />

      <header className="page-header">
        <div>
          <p className="app-eyebrow">{workspace.project.code}</p>
          <h2 className="page-title">项目待办页</h2>
          <p className="page-description">
            这里收拢项目工作台里的待办、风险和导入状态，方便顺着摘要继续处理。
          </p>
        </div>
      </header>

      {refreshNotice ? (
        <section className="panel panel-focus">
          <h3>刷新提示</h3>
          <p className="page-description">{refreshNotice}</p>
          {refreshBatchEntries.length > 0 ? (
            <>
              <p className="page-description">本轮处理对象</p>
              <ul className="inline-list">
                {refreshBatchEntries.map((entry) => (
                  <li key={entry.id}>
                    <Link className="breadcrumbs-link" to={entry.path}>
                      {entry.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <div className="version-card-actions">
            <button
              className="connection-button secondary"
              onClick={dismissRefreshNotice}
              type="button"
            >
              收起提示
            </button>
          </div>
        </section>
      ) : null}

      <section className="detail-grid">
        <article className={`panel ${focus === "todo" ? "panel-focus" : ""}`}>
          <h3>审核待办</h3>
          <p className="page-description">
            共 {adjustedReviewSummary.totalCount} 条，待处理{" "}
            {adjustedReviewSummary.statusCounts.pending} 条
          </p>
          <p className="page-description">
            <Link className="breadcrumbs-link" to={`/projects/${projectId}/reviews`}>
              进入审核处理页
            </Link>
          </p>
          {reviews.items.length > 0 ? (
            <div className="project-list">
              {reviews.items.map((review) => (
                <article
                  className={
                    refreshItemKind === "review" &&
                    (refreshItemId === review.id || refreshBatchIds.has(review.id))
                      ? "list-card selected"
                      : "list-card"
                  }
                  key={review.id}
                >
                  <h3>
                    {review.billVersionSummary.versionName} · {review.status}
                  </h3>
                  <p className="page-description">
                    {review.stageCode} · {review.disciplineCode} · 提交于{" "}
                    {formatProjectDateTime(review.submittedAt)}
                  </p>
                  <p className="page-description">
                    {review.rejectionReason ?? review.reviewComment ?? review.submissionComment ?? "无备注"}
                  </p>
                  <div className="version-card-actions">
                    <button
                      className="connection-button secondary"
                      onClick={() => {
                        const action = review.canApprove
                          ? "approve"
                          : review.canReject
                            ? "reject"
                            : review.canCancel
                              ? "cancel"
                              : null;

                        if (!action) {
                          return;
                        }

                        void copyResourceActionLink(
                          `/projects/${projectId}/reviews?reviewId=${review.id}&action=${action}`,
                          "审核",
                        );
                      }}
                      type="button"
                    >
                      复制审核处理链接
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="没有审核待办" body="当前项目还没有审核记录。" />
          )}
        </article>

        <article className={`panel ${focus === "risk" ? "panel-focus" : ""}`}>
          <h3>过程单据</h3>
          <p className="page-description">
            共 {adjustedProcessDocumentSummary.totalCount} 条，待审核{" "}
            {adjustedProcessDocumentSummary.statusCounts.submitted} 条，退回{" "}
            {adjustedProcessDocumentSummary.statusCounts.rejected} 条
          </p>
          <p className="page-description">
            <Link
              className="breadcrumbs-link"
              to={`/projects/${projectId}/process-documents`}
            >
              进入过程单据处理页
            </Link>
          </p>
          {processDocuments.items.length > 0 ? (
            <div className="project-list">
              {processDocuments.items.map((document) => (
                <article
                  className={
                    refreshItemKind === "process-document" &&
                    (refreshItemId === document.id || refreshBatchIds.has(document.id))
                      ? "list-card selected"
                      : "list-card"
                  }
                  key={document.id}
                >
                  <h3>
                    {document.title} · {document.status}
                  </h3>
                  <p className="page-description">
                    {document.stageName} · {document.disciplineName} · {document.referenceNo}
                  </p>
                  <p className="page-description">
                    {document.lastComment ?? "暂无备注"}
                  </p>
                  <div className="version-card-actions">
                    <button
                      className="connection-button secondary"
                      onClick={() => {
                        const action =
                          document.isEditable && document.status === "draft"
                            ? "submit"
                            : document.isReviewable && document.status === "submitted"
                              ? "approve"
                              : null;

                        if (!action) {
                          return;
                        }

                        void copyResourceActionLink(
                          `/projects/${projectId}/process-documents?documentId=${document.id}&action=${action}`,
                          "过程单据",
                        );
                      }}
                      type="button"
                    >
                      复制过程单据处理链接
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="没有过程单据" body="当前项目还没有过程单据记录。" />
          )}
        </article>
      </section>

      <section className="detail-grid">
        <article className={`panel ${focus === "import" ? "panel-focus" : ""}`}>
          <h3>异步任务状态</h3>
          <p className="page-description">
            共 {jobs.summary.totalCount} 个任务，处理中 {jobs.summary.statusCounts.processing}
            个，失败 {jobs.summary.statusCounts.failed} 个
          </p>
          {failureReasonLabel ? (
            <p className="page-description">
              当前协作视角：{failureReasonLabel}
            </p>
          ) : null}
          {failureCollaborationUnitLabel ? (
            <p className="page-description">
              当前协作处理单元：{failureCollaborationUnitLabel}
            </p>
          ) : null}
          {failureReasonLabel ? (
            <p className="page-description">
              当前正跟进“{failureReasonLabel}”相关失败条目，可继续回到任务状态页逐条定位。
            </p>
          ) : null}
          {failureReasonLabel ? (
            <div className="connection-actions">
              <button
                className="connection-button secondary"
                onClick={() => {
                  void copyCurrentInboxLink();
                }}
                type="button"
              >
                复制当前回流链接
              </button>
              <button
                className="connection-button secondary"
                onClick={() => {
                  clearCollaborationView();
                }}
                type="button"
              >
                清除协作视角
              </button>
            </div>
          ) : null}
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
          <p className="page-description">
            <Link
              className="breadcrumbs-link"
              to={(() => {
                const next = new URLSearchParams();
                if (failureReason) {
                  next.set("status", "failed");
                  appendFailureCollaborationParams(next, {
                    failureReason,
                    failureResourceType,
                    failureAction,
                  });
                }
                return `/projects/${projectId}/jobs${next.toString() ? `?${next.toString()}` : ""}`;
              })()}
            >
              进入任务状态页
            </Link>
          </p>
          {jobs.items.length > 0 ? (
            <div className="project-list">
              {jobs.items.map((job) => (
                <article className="list-card" key={job.id}>
                  <h3>
                    {formatJobType(job.jobType)} · {job.status}
                  </h3>
                  <p className="page-description">
                    创建于 {formatProjectDateTime(job.createdAt)}
                  </p>
                  <p className="page-description">
                    {job.errorMessage ?? "当前没有错误信息"}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="没有异步任务" body="当前项目还没有异步任务记录。" />
          )}
        </article>

        <article className="panel">
          <h3>继续处理</h3>
          <div className="project-list">
            <Link
              className="project-link"
              to={(() => {
                const next = new URLSearchParams();
                appendFailureCollaborationParams(next, {
                  failureReason,
                  failureResourceType,
                  failureAction,
                });
                return `/projects/${projectId}${next.toString() ? `?${next.toString()}` : ""}`;
              })()}
            >
              <h3>返回项目工作台</h3>
              <p className="page-description">回到 workspace 总览继续切换版本和摘要。</p>
            </Link>
            {workspace.billVersions[0] ? (
              <Link
                className="project-link"
                to={`/projects/${projectId}/summary?billVersionId=${workspace.billVersions[0].id}`}
              >
                <h3>查看当前汇总页</h3>
                <p className="page-description">
                  默认进入 {workspace.billVersions[0].versionName} 的汇总视图。
                </p>
              </Link>
            ) : null}
          </div>
        </article>
      </section>
    </div>
  );
}
