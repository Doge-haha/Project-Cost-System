import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { apiClient, ApiError } from "../../lib/api";
import type { ProjectWorkspace, ReviewSubmission } from "../../lib/types";
import {
  clearRecentProcessingLink,
  readRecentProcessingLink,
  saveRecentProcessingLink,
} from "./recent-processing-link";
import { RecentProcessingSummaryCard } from "./recent-processing-summary-card";
import { formatProjectDateTime } from "./project-date-utils";
import {
  appendReviewBatchSummary,
  buildNextReviewActionState,
  buildReviewReturnQuery,
  buildReviewStatusHint,
  normalizeReviewFilter,
  normalizeReviewSummaryFocus,
  type CompletedReviewState,
  type ReviewActionState,
  type ReviewFilter,
  type ReviewSummaryFocus,
} from "./project-reviews-model";
import { buildAbsoluteAppUrl } from "./project-link-utils";
import { AppBreadcrumbs, buildProjectVersionBreadcrumbs } from "../shared/breadcrumbs";
import { EmptyState } from "../shared/empty-state";
import { ErrorState } from "../shared/error-state";
import { LoadingState } from "../shared/loading-state";

type ProjectReviewsState = {
  workspace: ProjectWorkspace;
  reviews: ReviewSubmission[];
};

export function ProjectReviewsPage() {
  const params = useParams();
  const projectId = params.projectId;
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState<ProjectReviewsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionState, setActionState] = useState<ReviewActionState | null>(null);
  const [comment, setComment] = useState("");
  const [reason, setReason] = useState("");
  const [completedAction, setCompletedAction] = useState<ReviewActionState["mode"] | null>(null);
  const [completedReview, setCompletedReview] = useState<CompletedReviewState | null>(null);
  const [completedReviews, setCompletedReviews] = useState<CompletedReviewState[]>([]);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [copiedLinkPath, setCopiedLinkPath] = useState<string | null>(null);
  const [recentCopiedLink, setRecentCopiedLink] = useState(
    readRecentProcessingLink(projectId),
  );
  const focusedReviewId = searchParams.get("reviewId");
  const focusedAction = searchParams.get("action");
  const activeFilter = normalizeReviewFilter(searchParams.get("filter"));
  const summaryFocus = normalizeReviewSummaryFocus(searchParams.get("summaryFocus"));

  const activeReview = useMemo(
    () =>
      actionState && state
        ? state.reviews.find((review) => review.id === actionState.reviewId) ?? null
        : null,
    [actionState, state],
  );
  const completedReviewDetail = useMemo(
    () =>
      completedReview && state
        ? state.reviews.find((review) => review.id === completedReview.reviewId) ?? null
        : null,
    [completedReview, state],
  );
  const filteredReviews = useMemo(() => {
    const reviews = state?.reviews ?? [];
    if (activeFilter === "pending") {
      return reviews.filter((review) => review.status === "pending");
    }
    if (activeFilter === "rejected") {
      return reviews.filter((review) => review.status === "rejected");
    }
    if (activeFilter === "actionable") {
      return reviews.filter(
        (review) => review.canApprove || review.canReject || review.canCancel,
      );
    }
    return reviews;
  }, [activeFilter, state?.reviews]);
  const summaryFocusedReviewId = useMemo(() => {
    if (actionState || !summaryFocus) {
      return null;
    }

    if (summaryFocus === "pending") {
      return (
        filteredReviews.find((review) => review.canApprove || review.canReject || review.canCancel)
          ?.id ??
        filteredReviews[0]?.id ??
        null
      );
    }

    if (summaryFocus === "rejected") {
      return filteredReviews[0]?.id ?? null;
    }

    return null;
  }, [actionState, filteredReviews, summaryFocus]);
  const orderedReviews = useMemo(() => {
    if (!summaryFocusedReviewId) {
      return filteredReviews;
    }

    const focusedReview = filteredReviews.find((review) => review.id === summaryFocusedReviewId);
    if (!focusedReview) {
      return filteredReviews;
    }

    return [
      focusedReview,
      ...filteredReviews.filter((review) => review.id !== summaryFocusedReviewId),
    ];
  }, [filteredReviews, summaryFocusedReviewId]);

  function syncFocusedReviewParams(nextActionState: ReviewActionState | null, replace = false) {
    const next = new URLSearchParams(searchParams);

    if (nextActionState) {
      next.set("reviewId", nextActionState.reviewId);
      next.set("action", nextActionState.mode);
    } else {
      next.delete("reviewId");
      next.delete("action");
    }

    setSearchParams(next, replace ? { replace: true } : undefined);
  }

  function openReviewAction(nextActionState: ReviewActionState, nextReasonValue = "") {
    setActionState(nextActionState);
    setComment("");
    setReason(nextReasonValue);
    syncFocusedReviewParams(nextActionState);
  }

  function closeReviewAction(replace = false) {
    setActionState(null);
    setComment("");
    setReason("");
    syncFocusedReviewParams(null, replace);
  }

  function applyFilter(nextFilter: ReviewFilter) {
    const next = new URLSearchParams(searchParams);
    if (nextFilter === "all") {
      next.delete("filter");
    } else {
      next.set("filter", nextFilter);
    }
    setSearchParams(next);
  }

  async function loadReviews() {
    if (!projectId) {
      setError("项目标识缺失，无法加载审核待办。");
      setLoading(false);
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const [workspace, reviews] = await Promise.all([
        apiClient.getProjectWorkspace(projectId),
        apiClient.listProjectReviews(projectId),
      ]);

      const nextState = {
        workspace,
        reviews: reviews.items,
      };
      setState(nextState);
      return nextState;
    } catch (fetchError) {
      setError(
        fetchError instanceof ApiError
          ? fetchError.message
          : "审核待办加载失败，请检查 API 连通性。",
      );
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReviews();
  }, [projectId]);

  useEffect(() => {
    setRecentCopiedLink(readRecentProcessingLink(projectId));
  }, [projectId]);

  useEffect(() => {
    if (!state) {
      return;
    }

    if (!focusedReviewId) {
      if (focusedAction) {
        syncFocusedReviewParams(null, true);
      }
      return;
    }

    const target = state.reviews.find((review) => review.id === focusedReviewId);
    if (!target) {
      syncFocusedReviewParams(null, true);
      return;
    }

    const preferredMode =
      focusedAction === "approve" || focusedAction === "reject" || focusedAction === "cancel"
        ? focusedAction
        : null;

    const nextMode =
      preferredMode === "approve" && target.canApprove
        ? "approve"
        : preferredMode === "reject" && target.canReject
          ? "reject"
          : preferredMode === "cancel" && target.canCancel
            ? "cancel"
            : target.canApprove
              ? "approve"
              : target.canReject
                ? "reject"
                : target.canCancel
                  ? "cancel"
                  : null;

    if (!nextMode) {
      syncFocusedReviewParams(null, true);
      return;
    }

    setActionState({ mode: nextMode, reviewId: target.id });
    setComment("");
    setReason(nextMode === "reject" ? (target.rejectionReason ?? "") : "");
    if (focusedAction !== nextMode) {
      syncFocusedReviewParams({ mode: nextMode, reviewId: target.id }, true);
    }
  }, [focusedAction, focusedReviewId, searchParams, setSearchParams, state]);

  async function submitAction() {
    if (!projectId || !actionState || !activeReview) {
      return;
    }

    if (actionState.mode === "reject" && !reason.trim()) {
      setError("驳回时必须填写原因。");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (actionState.mode === "approve") {
        await apiClient.approveReview(projectId, activeReview.id, comment.trim() || undefined);
      } else if (actionState.mode === "reject") {
        await apiClient.rejectReview(
          projectId,
          activeReview.id,
          reason.trim(),
          comment.trim() || undefined,
        );
      } else {
        await apiClient.cancelReview(projectId, activeReview.id, comment.trim() || undefined);
      }

      const nextCompletedReview = {
        reviewId: activeReview.id,
        versionName: activeReview.billVersionSummary.versionName,
        status:
          actionState.mode === "approve"
            ? "approved"
            : actionState.mode === "reject"
              ? "rejected"
              : "cancelled",
        detail:
          actionState.mode === "reject"
            ? `驳回原因：${reason.trim() || "未填写"}`
            : `备注：${comment.trim() || "无"}`,
      };
      setCompletedReview(nextCompletedReview);
      setCompletedReviews((current) => [nextCompletedReview, ...current].slice(0, 3));
      setCompletedAction(actionState.mode);
      closeReviewAction(true);
      const nextState = await loadReviews();
      const nextActionState = buildNextReviewActionState(nextState?.reviews ?? [], activeReview.id);
      if (nextActionState) {
        setActionState({ mode: nextActionState.mode, reviewId: nextActionState.reviewId });
        setComment("");
        setReason(nextActionState.mode === "reject" ? nextActionState.reason : "");
        syncFocusedReviewParams(
          { mode: nextActionState.mode, reviewId: nextActionState.reviewId },
          true,
        );
      }
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : "审核处理失败，请稍后重试。",
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
      const copiedPath = `/projects/${projectId}/reviews${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
      await window.navigator.clipboard.writeText(buildAbsoluteAppUrl(copiedPath));
      setCopyMessage("已复制当前处理链接，可直接发给协作同事。");
      setCopiedLinkPath(copiedPath);
      setRecentCopiedLink(
        saveRecentProcessingLink({
          projectId,
          path: copiedPath,
          label: "审核处理入口",
          sourceLabel: "审核处理页",
        }),
      );
      setError(null);
    } catch {
      setError("处理链接复制失败，请稍后重试。");
    }
  }

  if (loading) {
    return <LoadingState title="正在加载审核待办" />;
  }

  if (error && !state) {
    return (
      <ErrorState
        title="审核待办暂时不可用"
        body={error}
        onRetry={() => {
          void loadReviews();
        }}
      />
    );
  }

  if (!state || !projectId) {
    return (
      <EmptyState title="审核待办为空" body="还没有拿到审核待办数据，请稍后重试。" />
    );
  }

  const breadcrumbs = buildProjectVersionBreadcrumbs({
    currentLabel: "审核处理页",
    projectId,
    projectName: state.workspace.project.name,
    versionLabel: "审核待办",
  });

  return (
    <div className="page-stack">
      <AppBreadcrumbs items={breadcrumbs} />

      <header className="page-header">
        <div>
          <p className="app-eyebrow">{state.workspace.project.code}</p>
          <h2 className="page-title">审核处理页</h2>
          <p className="page-description">
            从项目工作台直接进入审核处理，优先消化待处理的版本审核。
          </p>
        </div>
      </header>

      {error ? <ErrorState body={error} /> : null}

      <section className="detail-grid">
        <article className="panel">
          <h3>审核列表</h3>
          <p className="page-description">
            共 {state.reviews.length} 条，待处理{" "}
            {state.reviews.filter((review) => review.status === "pending").length} 条
          </p>
          <div className="version-card-actions">
            <button
              className="connection-button secondary"
              onClick={() => {
                applyFilter("all");
              }}
              type="button"
            >
              全部 {state.reviews.length}
            </button>
            <button
              className="connection-button secondary"
              onClick={() => {
                applyFilter("pending");
              }}
              type="button"
            >
              待处理 {state.reviews.filter((review) => review.status === "pending").length}
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
                state.reviews.filter(
                  (review) => review.canApprove || review.canReject || review.canCancel,
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
              已驳回 {state.reviews.filter((review) => review.status === "rejected").length}
            </button>
          </div>
          {activeFilter !== "all" ? (
            <p className="page-description">{`当前筛选：${activeFilter}`}</p>
          ) : null}
          {orderedReviews.length > 0 ? (
            <div className="project-list">
              {orderedReviews.map((review) => (
                <article
                  className={
                    review.id === activeReview?.id ||
                    (!activeReview && review.id === summaryFocusedReviewId)
                      ? "list-card selected"
                      : "list-card"
                  }
                  key={review.id}
                >
                  <div className="version-card-header">
                    <div>
                      <h3>
                        {review.billVersionSummary.versionName} · {review.status}
                      </h3>
                      <p className="page-description">
                        {review.stageCode} · {review.disciplineCode} · 提交于{" "}
                        {formatProjectDateTime(review.submittedAt)}
                      </p>
                    </div>
                    <span className="version-status-chip">
                      {review.billVersionSummary.versionStatus}
                    </span>
                  </div>
                  <p className="page-description">
                    {review.rejectionReason ??
                      review.reviewComment ??
                      review.submissionComment ??
                      "暂无备注"}
                  </p>
                  <p className="page-description">{buildReviewStatusHint(review)}</p>
                  <div className="version-card-actions">
                    {review.canApprove ? (
                      <button
                        className="connection-button primary"
                        onClick={() => {
                          openReviewAction({ mode: "approve", reviewId: review.id });
                        }}
                        type="button"
                      >
                        通过
                      </button>
                    ) : null}
                    {review.canReject ? (
                      <button
                        className="connection-button secondary"
                        onClick={() => {
                          openReviewAction(
                            { mode: "reject", reviewId: review.id },
                            review.rejectionReason ?? "",
                          );
                        }}
                        type="button"
                      >
                        驳回
                      </button>
                    ) : null}
                    {review.canCancel ? (
                      <button
                        className="connection-button secondary"
                        onClick={() => {
                          openReviewAction({ mode: "cancel", reviewId: review.id });
                        }}
                        type="button"
                      >
                        撤回
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title={activeFilter === "all" ? "没有审核记录" : "当前筛选下没有审核记录"}
              body="当前项目还没有符合条件的审核记录。"
            />
          )}
        </article>

        <article className={`panel ${actionState ? "panel-focus" : ""}`}>
          <h3>处理动作</h3>
          {activeReview && actionState ? (
            <div className="page-stack">
              <p className="page-description">
                当前处理：{activeReview.billVersionSummary.versionName} · {actionState.mode}
              </p>
              {actionState.mode === "reject" ? (
                <label className="connection-label">
                  驳回原因
                  <textarea
                    className="connection-textarea"
                    onChange={(event) => {
                      setReason(event.target.value);
                    }}
                    rows={4}
                    value={reason}
                  />
                </label>
              ) : null}
              <label className="connection-label">
                备注
                <textarea
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
                    closeReviewAction();
                  }}
                  type="button"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <EmptyState
              title="选择一条审核"
              body="从左侧选择可处理的审核记录，这里会出现通过、驳回或撤回动作。"
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
                <h3>{completedReviews.length > 1 ? `本轮已处理 ${completedReviews.length} 条` : "处理完成"}</h3>
                <p className="page-description">
                  {completedReview?.versionName ?? "当前审核"} 已完成本次处理，可回到工作台继续查看刷新后的摘要和最近动态。
                </p>
                {completedReviews.length > 1 ? (
                  <ul className="inline-list">
                    {completedReviews.map((review) => (
                      <li key={review.reviewId}>{`${review.versionName} · ${review.status} · ${review.detail}`}</li>
                    ))}
                  </ul>
                ) : completedReviewDetail ? (
                  <>
                    <p className="page-description">{`当前状态：${completedReviewDetail.status}`}</p>
                    <p className="page-description">
                      {completedReviewDetail.status === "rejected"
                        ? `当前驳回原因：${completedReviewDetail.rejectionReason ?? "未填写"}`
                        : `当前备注：${completedReviewDetail.reviewComment ?? completedReviewDetail.submissionComment ?? "无"}`}
                    </p>
                  </>
                ) : (
                  <p className="page-description">
                    审核已{completedAction === "approve" ? "通过" : completedAction === "reject" ? "驳回" : "撤回"}。
                  </p>
                )}
                <div className="version-card-actions">
                  <Link
                    className="app-nav-link active"
                    to={`/projects/${projectId}?${appendReviewBatchSummary(
                      buildReviewReturnQuery(
                        completedReviewDetail?.status ?? "approved",
                        completedReview?.versionName ?? "当前审核",
                        completedReview?.reviewId ?? "",
                      ),
                      completedReviews,
                    )}`}
                  >
                    返回项目工作台
                  </Link>
                  <Link
                    className="app-nav-link active"
                    to={`/projects/${projectId}/inbox?focus=todo&${appendReviewBatchSummary(
                      buildReviewReturnQuery(
                        completedReviewDetail?.status ?? "approved",
                        completedReview?.versionName ?? "当前审核",
                        completedReview?.reviewId ?? "",
                      ),
                      completedReviews,
                    )}`}
                  >
                    返回待办页
                  </Link>
                </div>
              </article>
            </div>
          ) : null}
          <div className="project-list">
            <Link className="project-link" to={`/projects/${projectId}/inbox?focus=todo`}>
              <h3>返回待办页</h3>
              <p className="page-description">回到工作台待办页查看审核、风险和任务状态。</p>
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}
