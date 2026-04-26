import type { BackgroundJob, ImportTask } from "../../lib/types";
import { EmptyState } from "../shared/empty-state";
import { formatProjectDateTime } from "./project-date-utils";
import {
  formatImportSource,
  formatImportStatus,
} from "./project-job-status-formatters";
import { findMatchingJobIdForImportTask } from "./project-job-status-utils";

type ProjectJobStatusImportTaskListProps = {
  importTasks: ImportTask[];
  jobs: BackgroundJob[];
  selectedImportTask: ImportTask | null;
  onSelectImportTask: (taskId: string) => void;
  onSelectJob: (jobId: string) => void;
};

export function ProjectJobStatusImportTaskList({
  importTasks,
  jobs,
  selectedImportTask,
  onSelectImportTask,
  onSelectJob,
}: ProjectJobStatusImportTaskListProps) {
  return (
    <article className="panel">
      <h3>导入任务</h3>
      <p className="page-description">
        共 {importTasks.length} 条导入任务，工作台摘要已切到这组正式任务模型。
      </p>
      {importTasks.length > 0 ? (
        <div className="project-list">
          {importTasks.map((task) => (
            <button
              className={
                task.id === selectedImportTask?.id ? "project-link selected" : "project-link"
              }
              key={task.id}
              onClick={() => {
                onSelectImportTask(task.id);
                const matchingJobId = findMatchingJobIdForImportTask(task, jobs);
                if (matchingJobId) {
                  onSelectJob(matchingJobId);
                }
              }}
              type="button"
            >
              <div className="version-card-header">
                <div>
                  <h3>
                    {task.sourceLabel} · {formatImportStatus(task.status)}
                  </h3>
                  <p className="page-description">
                    {task.sourceFileName ?? "未提供文件"} · {task.sourceBatchNo ?? "未分配批次"}
                  </p>
                </div>
                <span className="version-status-chip">{task.id}</span>
              </div>
              <p className="page-description">
                来源 {formatImportSource(task.sourceType)} · 创建于{" "}
                {formatProjectDateTime(task.createdAt)}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState title="没有导入任务" body="当前项目还没有正式导入任务记录。" />
      )}
    </article>
  );
}
