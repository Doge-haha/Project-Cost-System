export const workerDescriptor = {
  name: "@saas-pricing/worker",
  role: "async-worker",
  jobs: [
    "report_export",
    "project_recalculate",
    "ai_recommendation",
    "knowledge_extraction"
  ]
} as const;

export function describeWorker(): string {
  return `${workerDescriptor.name}:${workerDescriptor.role}`;
}

export * from "./jobs/contracts.js";
export * from "./jobs/job-runner.js";
export * from "./jobs/knowledge-extraction-worker.js";
export * from "./jobs/project-recalculate-worker.js";
export * from "./jobs/report-export-worker.js";
export * from "./runtime/background-job-executor.js";
export * from "./runtime/api-background-job-source.js";
export * from "./runtime/api-worker-platform-client.js";
export * from "./runtime/ai-runtime-cli-client.js";
export * from "./runtime/background-job-queue.js";
export * from "./runtime/queue-backed-worker.js";
export * from "./runtime/worker-polling-runner.js";
export * from "./runtime/worker-polling-loop.js";
