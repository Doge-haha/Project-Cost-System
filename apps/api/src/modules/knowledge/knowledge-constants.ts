export const knowledgeSourceTypes = [
  "audit_log",
  "ai_recommendation",
  "file_upload",
  "project_retrospective",
  "review_submission",
] as const;

export type KnowledgeSourceType = (typeof knowledgeSourceTypes)[number];

export const memorySubjectTypes = [
  "ai_runtime",
  "organization",
  "project",
  "user",
] as const;

export type MemorySubjectType = (typeof memorySubjectTypes)[number];

export const knowledgeRelationTypes = [
  "derived_memory",
  "supports_recommendation",
  "explains_variance",
  "supersedes",
] as const;

export type KnowledgeRelationType = (typeof knowledgeRelationTypes)[number];
