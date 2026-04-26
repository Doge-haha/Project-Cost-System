import { Link } from "react-router-dom";

import type { BackgroundJob, ImportTask } from "../../lib/types";
import { EmptyState } from "../shared/empty-state";
import { formatProjectDateTime } from "./project-date-utils";
import { formatJobType } from "./project-job-status-formatters";
import { findMatchingImportTaskIdForJob } from "./project-job-status-utils";

type ProjectJobStatusJobPanelsProps = {
  jobs: BackgroundJob[];
  importTasks: ImportTask[];
  selectedJob: BackgroundJob | null;
  selectedFailureReasonLabel: string | null;
  canRetryCurrentFailureScope: boolean;
  canRetryCurrentFailureSubset: boolean;
  hasFailureSubsetFilters: boolean;
  selectedJobMatchesImportTask: boolean;
  retrying: boolean;
  retryCompleted: boolean;
  currentFailureSubsetLabel: string;
  projectId: string;
  projectReturnParams: string;
  retryContextParams: string;
  onSelectJob: (jobId: string) => void;
  onSelectImportTask: (taskId: string) => void;
  onRetryJob: () => void;
};

export function ProjectJobStatusJobPanels({
  jobs,
  importTasks,
  selectedJob,
  selectedFailureReasonLabel,
  canRetryCurrentFailureScope,
  canRetryCurrentFailureSubset,
  hasFailureSubsetFilters,
  selectedJobMatchesImportTask,
  retrying,
  retryCompleted,
  currentFailureSubsetLabel,
  projectId,
  projectReturnParams,
  retryContextParams,
  onSelectJob,
  onSelectImportTask,
  onRetryJob,
}: ProjectJobStatusJobPanelsProps) {
  return (
    <section className="detail-grid">
      <article className="panel">
        <h3>任务列表</h3>
        <p className="page-description">当前筛选下共 {jobs.length} 个任务</p>
        {jobs.length > 0 ? (
          <div className="project-list">
            {jobs.map((job) => (
              <button
                className={job.id === selectedJob?.id ? "project-link selected" : "project-link"}
                key={job.id}
                onClick={() => {
                  onSelectJob(job.id);
                  const matchingImportTaskId = findMatchingImportTaskIdForJob(job, importTasks);
                  if (matchingImportTaskId) {
                    onSelectImportTask(matchingImportTaskId);
                  }
                }}
                type="button"
              >
                <div className="version-card-header">
                  <div>
                    <h3>
                      {formatJobType(job.jobType)} · {job.status}
                    </h3>
                    <p className="page-description">
                      创建于 {formatProjectDateTime(job.createdAt)}
                    </p>
                  </div>
                  <span className="version-status-chip">{job.id}</span>
                </div>
                <p className="page-description">
                  {job.errorMessage ?? "当前没有错误信息"}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState title="没有任务记录" body="当前筛选下还没有任务状态记录。" />
        )}
      </article>

      <article className={`panel ${selectedJob ? "panel-focus" : ""}`}>
        <h3>任务详情</h3>
        {selectedJob ? (
          <div className="page-stack">
            <p className="page-description">
              {formatJobType(selectedJob.jobType)} · {selectedJob.status}
            </p>
            <p className="page-description">请求人：{selectedJob.requestedBy}</p>
            <p className="page-description">
              完成时间：
              {selectedJob.completedAt
                ? formatProjectDateTime(selectedJob.completedAt)
                : "尚未完成"}
            </p>
            <p className="page-description">
              错误信息：{selectedJob.errorMessage ?? "当前没有错误信息"}
            </p>
            <label className="connection-label">
              任务载荷
              <textarea
                aria-label="任务载荷"
                className="connection-textarea"
                readOnly
                rows={8}
                value={JSON.stringify(selectedJob.payload, null, 2)}
              />
            </label>
            <label className="connection-label">
              执行结果
              <textarea
                aria-label="执行结果"
                className="connection-textarea"
                readOnly
                rows={8}
                value={
                  selectedJob.result
                    ? JSON.stringify(selectedJob.result, null, 2)
                    : "当前没有执行结果"
                }
              />
            </label>
            {selectedJob.status === "failed" ? (
              <div className="connection-actions">
                {selectedFailureReasonLabel ? (
                  <p className="page-description">
                    {canRetryCurrentFailureScope
                      ? `将按“${selectedFailureReasonLabel}”相关失败条目回流重试。`
                      : "当前筛选缺少完整可重建输入，本次将按整条任务重新入队。"}
                  </p>
                ) : null}
                {hasFailureSubsetFilters ? (
                  <p className="page-description">
                    {!selectedJobMatchesImportTask
                      ? "当前失败范围来自另一条导入批次，重试前请先切换到这条任务对应的导入批次。"
                      : canRetryCurrentFailureSubset
                        ? "当前子集已具备可重建输入，本次会只重试该失败子集。"
                        : "当前失败子集缺少完整可重建输入，本次重试仍会按整条任务重新入队。"}
                  </p>
                ) : null}
                <button
                  className="connection-button primary"
                  disabled={retrying || !selectedJobMatchesImportTask}
                  onClick={onRetryJob}
                  type="button"
                >
                  {retrying
                    ? "重试中"
                    : canRetryCurrentFailureSubset
                      ? `重试当前子集（${currentFailureSubsetLabel}）`
                      : selectedFailureReasonLabel && canRetryCurrentFailureScope
                        ? `重试当前筛选（${selectedFailureReasonLabel}）`
                        : "重试任务"}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <EmptyState title="选择一个任务" body="从左侧选择任务后，这里会展示详情和失败处理动作。" />
        )}
        {retryCompleted ? (
          <div className="project-list">
            <article className="project-link selected">
              <h3>处理完成</h3>
              <p className="page-description">
                {selectedFailureReasonLabel && canRetryCurrentFailureScope
                  ? `已按“${selectedFailureReasonLabel}”相关失败条目重新入队，可以回到工作台继续查看刷新后的摘要和最近动态。`
                  : "失败任务已重新入队，可以回到工作台继续查看刷新后的摘要和最近动态。"}
              </p>
              <div className="version-card-actions">
                <Link
                  className="app-nav-link active"
                  to={`/projects/${projectId}?${projectReturnParams}`}
                >
                  返回项目工作台
                </Link>
                <Link
                  className="app-nav-link active"
                  to={`/projects/${projectId}/inbox?${retryContextParams}`}
                >
                  返回待办页
                </Link>
              </div>
            </article>
          </div>
        ) : null}
        <div className="project-list">
          <Link className="project-link" to={`/projects/${projectId}/inbox?focus=import`}>
            <h3>返回待办页</h3>
            <p className="page-description">回到工作台待办页查看审核、风险和任务状态。</p>
          </Link>
        </div>
      </article>
    </section>
  );
}
