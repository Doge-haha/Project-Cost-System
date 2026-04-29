import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

export const projects = pgTable(
  "project",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull(),
    defaultPriceVersionId: text("default_price_version_id"),
    defaultFeeTemplateId: text("default_fee_template_id"),
    ...auditColumns,
  },
  (table) => ({
    projectCodeIndex: uniqueIndex("project_code_uidx").on(table.code),
  }),
);

export const projectStages = pgTable(
  "project_stage",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    stageCode: text("stage_code").notNull(),
    stageName: text("stage_name").notNull(),
    status: text("status").notNull(),
    sequenceNo: integer("sequence_no").notNull(),
    ...auditColumns,
  },
  (table) => ({
    projectStageProjectIndex: index("project_stage_project_idx").on(table.projectId),
    projectStageSequenceIndex: uniqueIndex("project_stage_sequence_uidx").on(
      table.projectId,
      table.sequenceNo,
    ),
    projectStageCodeIndex: uniqueIndex("project_stage_code_uidx").on(
      table.projectId,
      table.stageCode,
    ),
  }),
);

export const projectDisciplines = pgTable(
  "project_discipline",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    disciplineCode: text("discipline_code").notNull(),
    disciplineName: text("discipline_name").notNull(),
    defaultStandardSetCode: text("default_standard_set_code"),
    status: text("status").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    ...auditColumns,
  },
  (table) => ({
    projectDisciplineProjectIndex: index("project_discipline_project_idx").on(
      table.projectId,
    ),
    projectDisciplineCodeIndex: uniqueIndex("project_discipline_code_uidx").on(
      table.projectId,
      table.disciplineCode,
    ),
  }),
);

export const disciplineTypes = pgTable(
  "discipline_type",
  {
    id: text("id").primaryKey(),
    disciplineCode: text("discipline_code").notNull(),
    disciplineName: text("discipline_name").notNull(),
    disciplineGroup: text("discipline_group"),
    businessViewType: text("business_view_type"),
    regionCode: text("region_code"),
    sourceMarkup: text("source_markup"),
    gb08Code: text("gb08_code"),
    gb13Code: text("gb13_code"),
    sourceSystem: text("source_system"),
    status: text("status").notNull(),
    ...auditColumns,
  },
  (table) => ({
    disciplineTypeCodeIndex: uniqueIndex("discipline_type_code_uidx").on(
      table.disciplineCode,
    ),
    disciplineTypeFilterIndex: index("discipline_type_filter_idx").on(
      table.regionCode,
      table.status,
    ),
  }),
);

export const standardSets = pgTable(
  "standard_set",
  {
    id: text("id").primaryKey(),
    standardSetCode: text("standard_set_code").notNull(),
    standardSetName: text("standard_set_name").notNull(),
    disciplineCode: text("discipline_code").notNull(),
    regionCode: text("region_code"),
    versionYear: integer("version_year"),
    standardType: text("standard_type"),
    sourceFieldCode: text("source_field_code"),
    sourceMarkup: text("source_markup"),
    sourceSystem: text("source_system"),
    status: text("status").notNull(),
    ...auditColumns,
  },
  (table) => ({
    standardSetCodeIndex: uniqueIndex("standard_set_code_uidx").on(
      table.standardSetCode,
    ),
    standardSetDisciplineIndex: index("standard_set_discipline_idx").on(
      table.disciplineCode,
      table.regionCode,
      table.status,
    ),
  }),
);

export const projectMembers = pgTable(
  "project_member",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    userId: text("user_id").notNull(),
    displayName: text("display_name").notNull(),
    roleCode: text("role_code").notNull(),
    ...auditColumns,
  },
  (table) => ({
    projectMemberProjectIndex: index("project_member_project_idx").on(table.projectId),
    projectMemberUserIndex: uniqueIndex("project_member_user_uidx").on(
      table.projectId,
      table.userId,
    ),
  }),
);

export const projectMemberScopes = pgTable(
  "project_member_scope",
  {
    id: text("id").primaryKey(),
    memberId: text("member_id")
      .notNull()
      .references(() => projectMembers.id),
    scopeType: text("scope_type").notNull(),
    scopeValue: text("scope_value").notNull(),
    ...auditColumns,
  },
  (table) => ({
    projectMemberScopeMemberIndex: index("project_member_scope_member_idx").on(
      table.memberId,
    ),
  }),
);

export const billVersions = pgTable(
  "bill_version",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    stageCode: text("stage_code").notNull(),
    disciplineCode: text("discipline_code").notNull(),
    versionNo: integer("version_no").notNull(),
    versionName: text("version_name").notNull(),
    versionStatus: text("version_status").notNull(),
    sourceVersionId: text("source_version_id"),
    sourceStageId: text("source_stage_id"),
    sourceSpecCode: text("source_spec_code"),
    sourceSpecName: text("source_spec_name"),
    sourceVisibleFlag: boolean("source_visible_flag"),
    sourceDefaultFlag: boolean("source_default_flag"),
    ...auditColumns,
  },
  (table) => ({
    billVersionProjectIndex: index("bill_version_project_idx").on(table.projectId),
    billVersionContextIndex: uniqueIndex("bill_version_context_uidx").on(
      table.projectId,
      table.stageCode,
      table.disciplineCode,
      table.versionNo,
    ),
  }),
);

export const billItems = pgTable(
  "bill_item",
  {
    id: text("id").primaryKey(),
    billVersionId: text("bill_version_id")
      .notNull()
      .references(() => billVersions.id),
    parentId: text("parent_id").references((): AnyPgColumn => billItems.id),
    itemCode: text("item_code").notNull(),
    itemName: text("item_name").notNull(),
    quantity: doublePrecision("quantity").notNull(),
    unit: text("unit").notNull(),
    sortNo: integer("sort_no").notNull(),
    sourceBillId: text("source_bill_id"),
    sourceSequence: integer("source_sequence"),
    sourceLevelCode: text("source_level_code"),
    isMeasureItem: boolean("is_measure_item"),
    sourceReferencePrice: doublePrecision("source_reference_price"),
    sourceFeeId: text("source_fee_id"),
    measureCategory: text("measure_category"),
    measureFeeFlag: boolean("measure_fee_flag"),
    measureCategorySubtype: text("measure_category_subtype"),
    featureRuleText: text("feature_rule_text"),
    systemUnitPrice: doublePrecision("system_unit_price"),
    manualUnitPrice: doublePrecision("manual_unit_price"),
    finalUnitPrice: doublePrecision("final_unit_price"),
    systemAmount: doublePrecision("system_amount"),
    finalAmount: doublePrecision("final_amount"),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }),
    ...auditColumns,
  },
  (table) => ({
    billItemVersionIndex: index("bill_item_version_idx").on(table.billVersionId),
    billItemSortIndex: index("bill_item_sort_idx").on(table.billVersionId, table.sortNo),
    billItemParentIndex: index("bill_item_parent_idx").on(table.parentId),
    billItemBusinessIndex: uniqueIndex("bill_item_business_uidx").on(
      table.billVersionId,
      table.itemCode,
      table.parentId,
    ),
  }),
);

export const billWorkItems = pgTable(
  "bill_work_item",
  {
    id: text("id").primaryKey(),
    billItemId: text("bill_item_id")
      .notNull()
      .references(() => billItems.id),
    workContent: text("work_content").notNull(),
    sortNo: integer("sort_no").notNull(),
    sourceSpecCode: text("source_spec_code"),
    sourceBillId: text("source_bill_id"),
    ...auditColumns,
  },
  (table) => ({
    billWorkItemBillItemIndex: index("bill_work_item_bill_item_idx").on(
      table.billItemId,
    ),
    billWorkItemSortIndex: uniqueIndex("bill_work_item_sort_uidx").on(
      table.billItemId,
      table.sortNo,
    ),
  }),
);

export const quotaLines = pgTable(
  "quota_line",
  {
    id: text("id").primaryKey(),
    billItemId: text("bill_item_id")
      .notNull()
      .references(() => billItems.id),
    sourceStandardSetCode: text("source_standard_set_code").notNull(),
    sourceQuotaId: text("source_quota_id").notNull(),
    sourceSequence: integer("source_sequence"),
    chapterCode: text("chapter_code").notNull(),
    quotaCode: text("quota_code").notNull(),
    quotaName: text("quota_name").notNull(),
    unit: text("unit").notNull(),
    quantity: doublePrecision("quantity").notNull(),
    laborFee: doublePrecision("labor_fee"),
    materialFee: doublePrecision("material_fee"),
    machineFee: doublePrecision("machine_fee"),
    contentFactor: doublePrecision("content_factor").notNull(),
    sourceMode: text("source_mode").notNull(),
    ...auditColumns,
  },
  (table) => ({
    quotaLineBillItemIndex: index("quota_line_bill_item_idx").on(table.billItemId),
    quotaLineQuotaCodeIndex: index("quota_line_quota_code_idx").on(
      table.billItemId,
      table.quotaCode,
    ),
  }),
);

export const referenceQuotas = pgTable(
  "reference_quota",
  {
    id: text("id").primaryKey(),
    sourceDataset: text("source_dataset").notNull(),
    sourceRegion: text("source_region"),
    standardSetCode: text("standard_set_code").notNull(),
    disciplineCode: text("discipline_code"),
    sourceQuotaId: text("source_quota_id").notNull(),
    sourceSequence: integer("source_sequence"),
    chapterCode: text("chapter_code").notNull(),
    quotaCode: text("quota_code").notNull(),
    quotaName: text("quota_name").notNull(),
    unit: text("unit").notNull(),
    laborFee: doublePrecision("labor_fee"),
    materialFee: doublePrecision("material_fee"),
    machineFee: doublePrecision("machine_fee"),
    workContentSummary: text("work_content_summary"),
    resourceCompositionSummary: text("resource_composition_summary"),
    searchText: text("search_text").notNull(),
    metadata: jsonb("metadata").notNull(),
    ...auditColumns,
  },
  (table) => ({
    referenceQuotaStandardSetIndex: index("reference_quota_standard_set_idx").on(
      table.standardSetCode,
      table.disciplineCode,
    ),
    referenceQuotaKeywordIndex: index("reference_quota_keyword_idx").on(
      table.quotaCode,
      table.quotaName,
    ),
    referenceQuotaDatasetIndex: index("reference_quota_dataset_idx").on(
      table.sourceDataset,
      table.sourceRegion,
    ),
  }),
);

export const priceVersions = pgTable(
  "price_version",
  {
    id: text("id").primaryKey(),
    versionCode: text("version_code").notNull(),
    versionName: text("version_name").notNull(),
    regionCode: text("region_code").notNull(),
    disciplineCode: text("discipline_code").notNull(),
    status: text("status").notNull(),
    ...auditColumns,
  },
  (table) => ({
    priceVersionCodeIndex: uniqueIndex("price_version_code_uidx").on(
      table.versionCode,
    ),
    priceVersionFilterIndex: index("price_version_filter_idx").on(
      table.regionCode,
      table.disciplineCode,
      table.status,
    ),
  }),
);

export const priceItems = pgTable(
  "price_item",
  {
    id: text("id").primaryKey(),
    priceVersionId: text("price_version_id")
      .notNull()
      .references(() => priceVersions.id),
    quotaCode: text("quota_code").notNull(),
    laborUnitPrice: doublePrecision("labor_unit_price").notNull(),
    materialUnitPrice: doublePrecision("material_unit_price").notNull(),
    machineUnitPrice: doublePrecision("machine_unit_price").notNull(),
    totalUnitPrice: doublePrecision("total_unit_price").notNull(),
    ...auditColumns,
  },
  (table) => ({
    priceItemVersionIndex: index("price_item_version_idx").on(table.priceVersionId),
    priceItemQuotaIndex: uniqueIndex("price_item_quota_uidx").on(
      table.priceVersionId,
      table.quotaCode,
    ),
  }),
);

export const feeTemplates = pgTable(
  "fee_template",
  {
    id: text("id").primaryKey(),
    templateName: text("template_name").notNull(),
    projectType: text("project_type"),
    regionCode: text("region_code"),
    stageScope: text("stage_scope").array().notNull(),
    taxMode: text("tax_mode").notNull(),
    allocationMode: text("allocation_mode").notNull(),
    status: text("status").notNull(),
    ...auditColumns,
  },
  (table) => ({
    feeTemplateRegionIndex: index("fee_template_region_idx").on(table.regionCode),
    feeTemplateProjectTypeIndex: index("fee_template_project_type_idx").on(
      table.projectType,
    ),
  }),
);

export const feeRules = pgTable(
  "fee_rule",
  {
    id: text("id").primaryKey(),
    feeTemplateId: text("fee_template_id")
      .notNull()
      .references(() => feeTemplates.id),
    disciplineCode: text("discipline_code"),
    feeType: text("fee_type").notNull(),
    feeRate: doublePrecision("fee_rate").notNull(),
    ...auditColumns,
  },
  (table) => ({
    feeRuleTemplateIndex: index("fee_rule_template_idx").on(table.feeTemplateId),
  }),
);

export const reviewSubmissions = pgTable(
  "review_submission",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    billVersionId: text("bill_version_id")
      .notNull()
      .references(() => billVersions.id),
    stageCode: text("stage_code").notNull(),
    disciplineCode: text("discipline_code").notNull(),
    status: text("status").notNull(),
    submittedBy: text("submitted_by").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull(),
    submissionComment: text("submission_comment"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewComment: text("review_comment"),
    rejectionReason: text("rejection_reason"),
    ...auditColumns,
  },
  (table) => ({
    reviewSubmissionProjectIndex: index("review_submission_project_idx").on(
      table.projectId,
    ),
    reviewSubmissionBillVersionIndex: index("review_submission_bill_version_idx").on(
      table.billVersionId,
      table.status,
    ),
    reviewSubmissionPendingUniqueIndex: uniqueIndex(
      "review_submission_pending_bill_version_uidx",
    )
      .on(table.billVersionId)
      .where(sql`${table.status} = 'pending'`),
  }),
);

export const processDocuments = pgTable(
  "process_document",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    stageCode: text("stage_code").notNull(),
    disciplineCode: text("discipline_code").notNull(),
    documentType: text("document_type").notNull(),
    status: text("status").notNull(),
    title: text("title").notNull(),
    referenceNo: text("reference_no").notNull(),
    amount: doublePrecision("amount").notNull(),
    submittedBy: text("submitted_by").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull(),
    lastComment: text("last_comment"),
    ...auditColumns,
  },
  (table) => ({
    processDocumentProjectIndex: index("process_document_project_idx").on(
      table.projectId,
    ),
    processDocumentStatusIndex: index("process_document_status_idx").on(
      table.projectId,
      table.status,
    ),
    processDocumentContextIndex: index("process_document_context_idx").on(
      table.projectId,
      table.stageCode,
      table.disciplineCode,
      table.documentType,
    ),
  }),
);

export const backgroundJobs = pgTable(
  "background_job",
  {
    id: text("id").primaryKey(),
    jobType: text("job_type").notNull(),
    status: text("status").notNull(),
    requestedBy: text("requested_by").notNull(),
    projectId: text("project_id").references(() => projects.id),
    payload: jsonb("payload").notNull(),
    result: jsonb("result"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    backgroundJobProjectIndex: index("background_job_project_idx").on(
      table.projectId,
    ),
    backgroundJobStatusIndex: index("background_job_status_idx").on(table.status),
    backgroundJobTypeIndex: index("background_job_type_idx").on(table.jobType),
    backgroundJobCreatedIndex: index("background_job_created_idx").on(table.createdAt),
  }),
);

export const importTasks = pgTable(
  "import_task",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    sourceType: text("source_type").notNull(),
    sourceLabel: text("source_label").notNull(),
    status: text("status").notNull(),
    requestedBy: text("requested_by").notNull(),
    totalItemCount: integer("total_item_count").notNull(),
    importedItemCount: integer("imported_item_count").notNull(),
    memoryItemCount: integer("memory_item_count").notNull(),
    failedItemCount: integer("failed_item_count").notNull(),
    latestJobId: text("latest_job_id"),
    latestErrorMessage: text("latest_error_message"),
    metadata: jsonb("metadata").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    importTaskProjectIndex: index("import_task_project_idx").on(table.projectId),
    importTaskStatusIndex: index("import_task_status_idx").on(table.status),
    importTaskCreatedIndex: index("import_task_created_idx").on(table.createdAt),
  }),
);

export const reportExportTasks = pgTable(
  "report_export_task",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    reportType: text("report_type").notNull(),
    status: text("status").notNull(),
    requestedBy: text("requested_by").notNull(),
    stageCode: text("stage_code"),
    disciplineCode: text("discipline_code"),
    reportTemplateId: text("report_template_id"),
    outputFormat: text("output_format"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    resultPreview: jsonb("result_preview"),
    downloadFileName: text("download_file_name"),
    downloadContentType: text("download_content_type"),
    downloadContentLength: integer("download_content_length"),
  },
  (table) => ({
    reportExportProjectIndex: index("report_export_project_idx").on(table.projectId),
    reportExportStatusIndex: index("report_export_status_idx").on(table.status),
    reportExportCreatedIndex: index("report_export_created_idx").on(table.createdAt),
  }),
);

export const knowledgeEntries = pgTable(
  "knowledge_entry",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    stageCode: text("stage_code"),
    sourceJobId: text("source_job_id"),
    sourceType: text("source_type").notNull(),
    sourceAction: text("source_action").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    tags: text("tags").array().notNull(),
    metadata: jsonb("metadata").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    knowledgeEntryProjectIndex: index("knowledge_entry_project_idx").on(
      table.projectId,
    ),
    knowledgeEntrySourceIndex: index("knowledge_entry_source_idx").on(
      table.sourceJobId,
      table.sourceType,
      table.sourceAction,
    ),
    knowledgeEntryTypeStatusCreatedIndex: index(
      "knowledge_entry_type_status_created_idx",
    ).on(table.sourceType, table.sourceAction, table.createdAt),
    knowledgeEntryCreatedIndex: index("knowledge_entry_created_idx").on(table.createdAt),
  }),
);

export const memoryEntries = pgTable(
  "memory_entry",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    stageCode: text("stage_code"),
    sourceJobId: text("source_job_id"),
    memoryKey: text("memory_key").notNull(),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    memoryEntryProjectIndex: index("memory_entry_project_idx").on(table.projectId),
    memoryEntrySourceIndex: index("memory_entry_source_idx").on(table.sourceJobId),
    memoryEntrySubjectIndex: index("memory_entry_subject_idx").on(
      table.subjectType,
      table.subjectId,
    ),
    memoryEntryScopeKeyIndex: index("memory_entry_scope_key_idx").on(
      table.subjectType,
      table.subjectId,
      table.memoryKey,
    ),
  }),
);

export const skillDefinitions = pgTable(
  "skill_definition",
  {
    id: text("id").primaryKey(),
    skillCode: text("skill_code").notNull(),
    skillName: text("skill_name").notNull(),
    description: text("description").notNull(),
    status: text("status").notNull(),
    runtimeConfig: jsonb("runtime_config").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    skillDefinitionCodeIndex: index("skill_definition_code_idx").on(
      table.skillCode,
    ),
    skillDefinitionStatusIndex: index("skill_definition_status_idx").on(
      table.status,
    ),
  }),
);

export const knowledgeRelations = pgTable(
  "knowledge_relation",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    fromType: text("from_type").notNull(),
    fromId: text("from_id").notNull(),
    toType: text("to_type").notNull(),
    toId: text("to_id").notNull(),
    relationType: text("relation_type").notNull(),
    metadata: jsonb("metadata").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    knowledgeRelationProjectIndex: index("knowledge_relation_project_idx").on(
      table.projectId,
    ),
    knowledgeRelationFromIndex: index("knowledge_relation_from_idx").on(
      table.fromType,
      table.fromId,
    ),
    knowledgeRelationToIndex: index("knowledge_relation_to_idx").on(
      table.toType,
      table.toId,
    ),
  }),
);

export const aiRecommendations = pgTable(
  "ai_recommendation",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    stageCode: text("stage_code"),
    disciplineCode: text("discipline_code"),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    recommendationType: text("recommendation_type").notNull(),
    inputPayload: jsonb("input_payload").notNull(),
    outputPayload: jsonb("output_payload").notNull(),
    status: text("status").notNull(),
    createdBy: text("created_by").notNull(),
    handledBy: text("handled_by"),
    handledAt: timestamp("handled_at", { withTimezone: true }),
    statusReason: text("status_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    aiRecommendationProjectResourceIndex: index(
      "ai_recommendation_project_resource_idx",
    ).on(table.projectId, table.resourceType, table.resourceId),
    aiRecommendationStatusCreatedIndex: index(
      "ai_recommendation_status_created_idx",
    ).on(table.status, table.createdAt),
    aiRecommendationTypeCreatedIndex: index(
      "ai_recommendation_type_created_idx",
    ).on(table.recommendationType, table.createdAt),
  }),
);

export const auditLogs = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    stageCode: text("stage_code"),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    action: text("action").notNull(),
    operatorId: text("operator_id").notNull(),
    beforePayload: jsonb("before_payload"),
    afterPayload: jsonb("after_payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    auditLogProjectIndex: index("audit_log_project_idx").on(table.projectId),
    auditLogResourceIndex: index("audit_log_resource_idx").on(
      table.resourceType,
      table.resourceId,
    ),
    auditLogResourceCreatedIndex: index("audit_log_resource_created_idx").on(
      table.resourceType,
      table.resourceId,
      table.createdAt,
    ),
    auditLogCreatedAtIndex: index("audit_log_created_at_idx").on(
      table.projectId,
      table.createdAt,
    ),
  }),
);

export const schema = {
  projects,
  projectStages,
  projectDisciplines,
  projectMembers,
  projectMemberScopes,
  billVersions,
  billItems,
  billWorkItems,
  quotaLines,
  referenceQuotas,
  priceVersions,
  priceItems,
  feeTemplates,
  feeRules,
  reviewSubmissions,
  processDocuments,
  backgroundJobs,
  importTasks,
  reportExportTasks,
  knowledgeEntries,
  memoryEntries,
  skillDefinitions,
  knowledgeRelations,
  aiRecommendations,
  auditLogs,
};
