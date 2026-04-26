import type { JobStatusFilter } from "./project-job-status-utils";

const filters: Array<{ label: string; value: JobStatusFilter }> = [
  { label: "全部", value: "all" },
  { label: "排队中", value: "queued" },
  { label: "处理中", value: "processing" },
  { label: "已完成", value: "completed" },
  { label: "失败", value: "failed" },
];

type ProjectJobStatusFilterSectionProps = {
  statusFilter: JobStatusFilter;
  onStatusFilterChange: (statusFilter: JobStatusFilter) => void;
};

export function ProjectJobStatusFilterSection({
  statusFilter,
  onStatusFilterChange,
}: ProjectJobStatusFilterSectionProps) {
  return (
    <section className="panel">
      <h3>状态筛选</h3>
      <div className="version-card-actions">
        {filters.map((filter) => (
          <button
            className={
              filter.value === statusFilter
                ? "connection-button primary"
                : "connection-button secondary"
            }
            key={filter.value}
            onClick={() => {
              onStatusFilterChange(filter.value);
            }}
            type="button"
          >
            {filter.label}
          </button>
        ))}
      </div>
    </section>
  );
}
