export const importTaskStatuses = [
  "queued",
  "processing",
  "completed",
  "failed",
] as const;

export type ImportTaskStatus = (typeof importTaskStatuses)[number];

export const importTaskErrorCodes = [
  "IMPORT_TASK_NOT_FOUND",
  "IMPORT_TASK_RETRY_LIMIT_REACHED",
  "IMPORT_TASK_RETRY_INPUT_INCOMPLETE",
  "IMPORT_TASK_RETRY_INPUT_UNAVAILABLE",
] as const;

export type ImportTaskErrorCode = (typeof importTaskErrorCodes)[number];

export type ImportTaskErrorResponse = {
  error: {
    code: ImportTaskErrorCode;
    message: string;
    details?: unknown;
  };
};
