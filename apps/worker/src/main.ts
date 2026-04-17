export const workerDescriptor = {
  name: "@saas-pricing/worker",
  role: "async-worker",
  jobs: [
    "import-parse",
    "report-export",
    "batch-recalc",
    "ai-recommendation",
    "knowledge-extraction"
  ]
} as const;

export function describeWorker(): string {
  return `${workerDescriptor.name}:${workerDescriptor.role}`;
}
