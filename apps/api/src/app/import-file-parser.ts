import { z } from "zod";

import { AppError } from "../shared/errors/app-error.js";

export const uploadImportTaskSchema = z.object({
  fileName: z.string().min(1),
  fileContent: z.string().min(1),
  sourceType: z.string().min(1).default("file_upload"),
  sourceLabel: z.string().min(1).optional(),
});

type ImportFailureReasonCode = "missing_field" | "parse_error" | "invalid_value";

type ImportFailedItem = {
  lineNo: number;
  reasonCode: ImportFailureReasonCode;
  reasonLabel: string;
  errorMessage: string;
  projectId: string | null;
  resourceType: string | null;
  action: string | null;
  keys: string[];
  retryEventSnapshot: Record<string, unknown> | null;
};

type ParsedImportFile = {
  events: Array<Record<string, unknown>>;
  totalItemCount: number;
  detectedFormat: "json_array" | "json_lines";
  failedItems: ImportFailedItem[];
};

export function buildGeneratedBatchNo(prefix: string): string {
  const now = new Date();
  const parts = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
    String(now.getUTCHours()).padStart(2, "0"),
    String(now.getUTCMinutes()).padStart(2, "0"),
    String(now.getUTCSeconds()).padStart(2, "0"),
  ];
  return `${prefix}-${parts.join("")}`;
}

export function parseImportFileContent(
  fileName: string,
  fileContent: string,
): ParsedImportFile {
  const trimmed = fileContent.trim();
  if (!trimmed) {
    throw new AppError(422, "IMPORT_FILE_EMPTY", "Import file is empty");
  }

  const normalizedFileName = fileName.toLowerCase();
  const isJsonArray =
    normalizedFileName.endsWith(".json") || trimmed.startsWith("[");
  const isJsonLines =
    normalizedFileName.endsWith(".jsonl") ||
    normalizedFileName.endsWith(".ndjson") ||
    normalizedFileName.endsWith(".txt");

  if (isJsonArray) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new AppError(
        422,
        "IMPORT_FILE_INVALID_JSON",
        "Import file is not valid JSON array content",
      );
    }
    if (!Array.isArray(parsed)) {
      throw new AppError(
        422,
        "IMPORT_FILE_INVALID_JSON_ARRAY",
        "Import file must contain a JSON array of events",
      );
    }
    const normalized = parsed.map((item, index) =>
      normalizeParsedImportLine({
        input: item,
        lineNo: index + 1,
      }),
    );
    return {
      events: normalized.flatMap((item) => (item.event ? [item.event] : [])),
      totalItemCount: parsed.length,
      detectedFormat: "json_array",
      failedItems: normalized.flatMap((item) =>
        item.failedItem ? [item.failedItem] : [],
      ),
    };
  }

  if (isJsonLines) {
    const lines = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const normalized = lines.map((line, index) => {
      const lineNo = index + 1;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        return {
          failedItem: buildImportFailedItem({
            input: null,
            lineNo,
            reasonCode: "parse_error",
            errorMessage: `第 ${lineNo} 行不是合法 JSON`,
          }),
        };
      }

      return normalizeParsedImportLine({
        input: parsed,
        lineNo,
      });
    });
    return {
      events: normalized.flatMap((item) => (item.event ? [item.event] : [])),
      totalItemCount: lines.length,
      detectedFormat: "json_lines",
      failedItems: normalized.flatMap((item) =>
        item.failedItem ? [item.failedItem] : [],
      ),
    };
  }

  throw new AppError(
    422,
    "IMPORT_FILE_UNSUPPORTED",
    "Import file must be .json, .jsonl, .ndjson, or .txt",
  );
}

function normalizeParsedImportLine(input: {
  input: unknown;
  lineNo: number;
}): {
  event?: Record<string, unknown>;
  failedItem?: ImportFailedItem;
} {
  let event: Record<string, unknown>;
  try {
    event = normalizeImportEvent(input.input);
  } catch (error) {
    if (error instanceof AppError) {
      return {
        failedItem: buildImportFailedItem({
          input: null,
          lineNo: input.lineNo,
          reasonCode: "parse_error",
          errorMessage: error.message,
        }),
      };
    }

    throw error;
  }
  const projectId =
    typeof event.projectId === "string" && event.projectId.length > 0
      ? event.projectId
      : null;
  const action =
    typeof event.action === "string" && event.action.length > 0 ? event.action : null;

  if (!action) {
    return {
      failedItem: buildImportFailedItem({
        input: event,
        lineNo: input.lineNo,
        reasonCode: "missing_field",
        errorMessage: "缺少 action",
      }),
    };
  }

  if (!projectId) {
    return {
      failedItem: buildImportFailedItem({
        input: event,
        lineNo: input.lineNo,
        reasonCode: "missing_field",
        errorMessage: "缺少 projectId",
      }),
    };
  }

  if ("amount" in event && typeof event.amount !== "number") {
    return {
      failedItem: buildImportFailedItem({
        input: event,
        lineNo: input.lineNo,
        reasonCode: "invalid_value",
        errorMessage: "amount 必须是数字",
      }),
    };
  }

  return {
    event,
  };
}

function buildImportFailedItem(input: {
  input: Record<string, unknown> | null;
  lineNo: number;
  reasonCode: ImportFailureReasonCode;
  errorMessage: string;
}): ImportFailedItem {
  return {
    lineNo: input.lineNo,
    reasonCode: input.reasonCode,
    reasonLabel: formatImportFailureReason(input.reasonCode),
    errorMessage: input.errorMessage,
    projectId:
      typeof input.input?.projectId === "string" && input.input.projectId.length > 0
        ? input.input.projectId
        : null,
    resourceType:
      typeof input.input?.resourceType === "string" &&
      input.input.resourceType.length > 0
        ? input.input.resourceType
        : null,
    action:
      typeof input.input?.action === "string" && input.input.action.length > 0
        ? input.input.action
        : null,
    keys: input.input ? Object.keys(input.input).slice(0, 6) : [],
    retryEventSnapshot: input.input ? { ...input.input } : null,
  };
}

function formatImportFailureReason(reasonCode: ImportFailureReasonCode): string {
  if (reasonCode === "missing_field") {
    return "缺少必填字段";
  }
  if (reasonCode === "invalid_value") {
    return "字段值非法";
  }
  return "解析失败";
}

function buildFailureSummary(failedItems: ImportFailedItem[]) {
  const groups = new Map<
    ImportFailureReasonCode,
    { reasonCode: ImportFailureReasonCode; reasonLabel: string; count: number }
  >();

  for (const item of failedItems) {
    const current = groups.get(item.reasonCode);
    if (current) {
      current.count += 1;
      continue;
    }

    groups.set(item.reasonCode, {
      reasonCode: item.reasonCode,
      reasonLabel: item.reasonLabel,
      count: 1,
    });
  }

  return Array.from(groups.values());
}

export function buildFailureDetails(failedItems: ImportFailedItem[]): string[] {
  return Array.from(
    new Set(
      failedItems.flatMap((item) => [item.reasonLabel, item.errorMessage]).filter(Boolean),
    ),
  ).slice(0, 5);
}

export function buildImportFileMetadata(parsedFile: ParsedImportFile) {
  const { events, detectedFormat, failedItems, totalItemCount } = parsedFile;
  const previewItems = events.slice(0, 5).map((event, index) => ({
    lineNo: index + 1,
    projectId:
      typeof event.projectId === "string" && event.projectId.length > 0
        ? event.projectId
        : null,
    resourceType:
      typeof event.resourceType === "string" && event.resourceType.length > 0
        ? event.resourceType
        : null,
    action:
      typeof event.action === "string" && event.action.length > 0 ? event.action : null,
    keys: Object.keys(event).slice(0, 6),
  }));
  const failureSummary = buildFailureSummary(failedItems);

  return {
    detectedFormat,
    parseSummary: {
      totalEventCount: totalItemCount,
      fieldKeys: Array.from(
        new Set(
          events.flatMap((event) => Object.keys(event).filter((key) => key.length > 0)),
        ),
      ).slice(0, 8),
      resourceTypes: Array.from(
        new Set(
          events
            .map((event) => event.resourceType)
            .filter(
              (value): value is string => typeof value === "string" && value.length > 0,
            ),
        ),
      ).slice(0, 6),
      actions: Array.from(
        new Set(
          events
            .map((event) => event.action)
            .filter(
              (value): value is string => typeof value === "string" && value.length > 0,
            ),
        ),
      ).slice(0, 6),
      missingProjectIdCount: failedItems.filter(
        (item) => item.reasonCode === "missing_field" && item.errorMessage === "缺少 projectId",
      ).length,
      missingActionCount: failedItems.filter(
        (item) => item.reasonCode === "missing_field" && item.errorMessage === "缺少 action",
      ).length,
    },
    previewItems,
    failedItems,
    failureSummary,
    retryHistory: [],
  };
}

function normalizeImportEvent(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AppError(
      422,
      "IMPORT_EVENT_INVALID",
      "Each import event must be a JSON object",
    );
  }

  return input as Record<string, unknown>;
}
