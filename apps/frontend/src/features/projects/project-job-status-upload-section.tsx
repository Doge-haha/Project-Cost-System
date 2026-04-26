import { type RefObject } from "react";
import { Link } from "react-router-dom";

import type { ParsedImportTaskFailedItem } from "./import-task-failure-snapshots";
import { readSelectedFile } from "./project-job-status-utils";

export type ProjectJobStatusUploadCompleted = {
  fileName: string;
  eventCount: number;
  uploadedTaskId: string;
  uploadedTaskLabel: string | null;
  returnToFailurePath: string | null;
  returnToFailureLabel: string | null;
  comparisonBaselineItems: ParsedImportTaskFailedItem[];
};

type ProjectJobStatusUploadSectionProps = {
  uploadCallout: string | null;
  uploadSectionRef: RefObject<HTMLElement | null>;
  uploadFileName: string;
  uploadFileContent: string;
  uploading: boolean;
  uploadCompleted: ProjectJobStatusUploadCompleted | null;
  uploadComparisonSummary: { headline: string; detail: string } | null;
  onClearUploadCompleted: () => void;
  onFileSelected: (file: { fileName: string; content: string }) => void;
  onUpload: () => void;
};

export function ProjectJobStatusUploadSection({
  uploadCallout,
  uploadSectionRef,
  uploadFileName,
  uploadFileContent,
  uploading,
  uploadCompleted,
  uploadComparisonSummary,
  onClearUploadCompleted,
  onFileSelected,
  onUpload,
}: ProjectJobStatusUploadSectionProps) {
  return (
    <section
      className={uploadCallout ? "panel panel-focus" : "panel"}
      id="import-upload-section"
      ref={uploadSectionRef}
    >
      <h3>发起导入</h3>
      <p className="page-description">
        首版支持上传 `JSON` 数组或 `JSONL/NDJSON` 文本文件，系统会自动创建导入批次并排入处理。
      </p>
      {uploadCallout ? <p className="page-description">{uploadCallout}</p> : null}
      <label className="connection-label">
        选择文件
        <input
          accept=".json,.jsonl,.ndjson,.txt"
          className="connection-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) {
              return;
            }
            onClearUploadCompleted();
            void readSelectedFile(file).then((content) => {
              onFileSelected({ fileName: file.name, content });
            });
          }}
          type="file"
        />
      </label>
      <p className="page-description">当前文件：{uploadFileName || "尚未选择"}</p>
      <div className="connection-actions">
        <button
          className="connection-button primary"
          disabled={uploading || !uploadFileName || !uploadFileContent}
          onClick={onUpload}
          type="button"
        >
          {uploading ? "上传中" : "上传并创建导入批次"}
        </button>
      </div>
      {uploadCompleted ? (
        <div className="version-card-actions">
          <p className="page-description">
            已上传 {uploadCompleted.fileName}，生成 {uploadCompleted.eventCount} 条导入事件。
          </p>
          {uploadCompleted.uploadedTaskLabel && uploadCompleted.returnToFailurePath ? (
            <p className="page-description">
              当前已切到新上传批次 {uploadCompleted.uploadedTaskLabel}，可与刚才失败范围交替核对。
            </p>
          ) : null}
          {uploadCompleted.returnToFailurePath ? (
            <Link className="breadcrumbs-link" to={uploadCompleted.returnToFailurePath}>
              {uploadCompleted.returnToFailureLabel
                ? `回到刚才失败范围（${uploadCompleted.returnToFailureLabel}）`
                : "回到刚才失败范围"}
            </Link>
          ) : null}
          {uploadComparisonSummary ? (
            <>
              <p className="page-description">{uploadComparisonSummary.headline}</p>
              <p className="page-description">{uploadComparisonSummary.detail}</p>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
