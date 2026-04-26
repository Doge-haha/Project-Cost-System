import { z } from "zod";

export const projectSummaryQuerySchema = z.object({
  projectId: z.string().min(1),
  billVersionId: z.string().min(1).optional(),
  stageCode: z.string().min(1).optional(),
  disciplineCode: z.string().min(1).optional(),
});

export const summaryDetailsQuerySchema = projectSummaryQuerySchema.extend({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const jobsSummaryQuerySchema = z.object({
  projectId: z.string().min(1).optional(),
  requestedBy: z.string().min(1).optional(),
  jobType: z
    .enum(["report_export", "project_recalculate", "knowledge_extraction"])
    .optional(),
  status: z.enum(["queued", "processing", "completed", "failed"]).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const projectContextQuerySchema = projectSummaryQuerySchema.extend({
  jobsRequestedBy: z.string().min(1).optional(),
  jobsStatus: z.enum(["queued", "processing", "completed", "failed"]).optional(),
  jobsLimit: z.coerce.number().int().positive().max(100).optional(),
  jobId: z.string().min(1).optional(),
});

export const recalculateProjectToolSchema = z.object({
  projectId: z.string().min(1),
  stageCode: z.string().min(1).optional(),
  disciplineCode: z.string().min(1).optional(),
  priceVersionId: z.string().min(1).optional(),
  feeTemplateId: z.string().min(1).optional(),
});

export const jobStatusQuerySchema = z.object({
  jobId: z.string().min(1),
});

export const knowledgeExtractionHistoryQuerySchema = z.object({
  projectId: z.string().min(1),
  requestedBy: z.string().min(1).optional(),
  status: z.enum(["queued", "processing", "completed", "failed"]).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const reviewSummaryQuerySchema = z.object({
  projectId: z.string().min(1),
  billVersionId: z.string().min(1).optional(),
  stageCode: z.string().min(1).optional(),
  disciplineCode: z.string().min(1).optional(),
  status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
});

export const processDocumentSummaryQuerySchema = z.object({
  projectId: z.string().min(1),
  stageCode: z.string().min(1).optional(),
  disciplineCode: z.string().min(1).optional(),
  documentType: z
    .enum(["change_order", "site_visa", "progress_payment"])
    .optional(),
  status: z.enum(["draft", "submitted", "approved", "rejected"]).optional(),
});

export const reportExportStatusQuerySchema = z.object({
  taskId: z.string().min(1),
});

export const importFailureContextQuerySchema = z.object({
  projectId: z.string().min(1),
  importTaskId: z.string().min(1).optional(),
  failureReason: z.string().min(1).optional(),
  failureResourceType: z.string().min(1).optional(),
  failureAction: z.string().min(1).optional(),
});

export const exportSummaryReportToolSchema = z.object({
  projectId: z.string().min(1),
  reportType: z.enum(["summary", "variance"]),
  stageCode: z.string().min(1).optional(),
  disciplineCode: z.string().min(1).optional(),
});

export const extractKnowledgeToolSchema = z.object({
  projectId: z.string().min(1),
  source: z.string().min(1),
  events: z.array(z.record(z.string(), z.unknown())).min(1),
});

export const extractKnowledgePreviewToolSchema = z.object({
  source: z.string().min(1),
  events: z.array(z.record(z.string(), z.unknown())).min(1),
});

export const extractKnowledgeFromAuditToolSchema = z.object({
  projectId: z.string().min(1),
  source: z.string().min(1).optional(),
  resourceType: z.string().min(1).optional(),
  resourceId: z.string().min(1).optional(),
  resourceIdPrefix: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
  operatorId: z.string().min(1).optional(),
  createdFrom: z.string().datetime().optional(),
  createdTo: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const retryImportFailureScopeToolSchema = z.object({
  jobId: z.string().min(1),
  failureReason: z.string().min(1).optional(),
  failureResourceType: z.string().min(1).optional(),
  failureAction: z.string().min(1).optional(),
});

export const decideReviewToolSchema = z
  .object({
    projectId: z.string().min(1),
    reviewSubmissionId: z.string().min(1),
    action: z.enum(["approve", "reject", "cancel"]),
    comment: z.string().min(1).optional(),
    reason: z.string().min(1).optional(),
  })
  .refine((payload) => payload.action !== "reject" || payload.reason, {
    message: "reason is required when rejecting a review",
    path: ["reason"],
  });

export const updateProcessDocumentStatusToolSchema = z.object({
  projectId: z.string().min(1),
  documentId: z.string().min(1),
  status: z.enum(["submitted", "approved", "rejected"]),
  comment: z.string().min(1).optional(),
});
