import test from "node:test";
import assert from "node:assert/strict";

import { createPgMemDatabase } from "./helpers/pg-mem.js";
import { defaultSourceSystemCode } from "../src/modules/master-data/master-data-constants.js";

test("database migrations create project and bill core tables", async () => {
  const runtime = await createPgMemDatabase();
  try {
    await runtime.pool.query(
      "insert into project (id, code, name, status) values ('project-001', 'PRJ-001', '项目 A', 'draft')",
    );
    await runtime.pool.query(
      "insert into project_stage (id, project_id, stage_code, stage_name, status, sequence_no) values ('stage-001', 'project-001', 'estimate', '投资估算', 'draft', 1)",
    );
    await runtime.pool.query(
      "insert into project_discipline (id, project_id, discipline_code, discipline_name, default_standard_set_code, status) values ('discipline-001', 'project-001', 'building', '建筑工程', 'JS-2014', 'enabled')",
    );
    await runtime.pool.query(
      `insert into discipline_type (id, discipline_code, discipline_name, discipline_group, business_view_type, region_code, source_markup, gb08_code, gb13_code, source_system, status) values ('discipline-type-001', 'building', '建筑工程', 'construction', 'cost', 'JS', 'ZY-BUILDING', 'GB08-BUILDING', 'GB13-BUILDING', '${defaultSourceSystemCode}', 'active')`,
    );
    await runtime.pool.query(
      `insert into standard_set (id, standard_set_code, standard_set_name, discipline_code, region_code, version_year, standard_type, source_field_code, source_markup, source_system, status) values ('standard-set-001', 'JS-2014', '江苏省建筑与装饰工程计价定额 2014', 'building', 'JS', 2014, 'quota', 'DekID', '012014jz', '${defaultSourceSystemCode}', 'active')`,
    );
    await runtime.pool.query(
      "insert into project_member (id, project_id, user_id, display_name, role_code) values ('member-001', 'project-001', 'user-001', 'Owner', 'project_owner')",
    );
    await runtime.pool.query(
      "insert into project_member_scope (id, member_id, scope_type, scope_value) values ('scope-001', 'member-001', 'project', 'project-001')",
    );
    await runtime.pool.query(
      "insert into bill_version (id, project_id, stage_code, discipline_code, version_no, version_name, version_status, source_version_id, source_spec_code, source_spec_name, source_visible_flag, source_default_flag) values ('bill-version-001', 'project-001', 'estimate', 'building', 1, 'v1', 'editable', null, 'QdGf-001', '江苏清单规范', true, false)",
    );
    await runtime.pool.query(
      "insert into bill_version (id, project_id, stage_code, discipline_code, version_no, version_name, version_status, source_version_id, source_stage_id, source_spec_code, source_spec_name, source_visible_flag, source_default_flag) values ('bill-version-source-002', 'project-001', 'estimate', 'building', 2, '源清单导入多版本', 'editable', 'QdID-002', 'stage-001', 'QdGf-002', '江苏清单规范 2', false, true)",
    );
    await runtime.pool.query(
      "insert into review_submission (id, project_id, bill_version_id, stage_code, discipline_code, status, submitted_by, submitted_at, submission_comment) values ('review-submission-001', 'project-001', 'bill-version-001', 'estimate', 'building', 'pending', 'user-001', '2026-04-19T10:00:00.000Z', '提交审核')",
    );
    await runtime.pool.query(
      "insert into bill_item (id, bill_version_id, parent_id, item_code, item_name, quantity, unit, sort_no, source_bill_id, source_sequence, source_level_code, is_measure_item, source_reference_price, source_fee_id, measure_category, measure_fee_flag, measure_category_subtype, feature_rule_text) values ('bill-item-001', 'bill-version-001', null, 'A-001', '土方工程', 10, 'm3', 1, 'QdID-001', 1, 'Fbcch-001', false, 12.5, 'QfID-001', 'Cslb-001', true, 'CslbXf-001', '按设计图示尺寸计算')",
    );
    await runtime.pool.query(
      "insert into bill_item (id, bill_version_id, parent_id, item_code, item_name, quantity, unit, sort_no) values ('bill-item-002', 'bill-version-001', 'bill-item-001', 'A-001-1', '子目', 5, 'm3', 2)",
    );
    await runtime.pool.query(
      "insert into bill_work_item (id, bill_item_id, work_content, sort_no, source_spec_code, source_bill_id) values ('work-item-001', 'bill-item-001', '机械开挖', 1, 'QdGf-001', 'QdID-001')",
    );
    await runtime.pool.query(
      "insert into import_task (id, project_id, source_type, source_label, status, requested_by, total_item_count, imported_item_count, memory_item_count, failed_item_count, latest_job_id, latest_error_message, metadata, created_at, completed_at) values ('import-task-source-001', 'project-001', 'source_bill', '源清单导入', 'failed', 'user-001', 4, 3, 0, 1, 'sync-bill-import-bill-version-001', 'ZaoJia_Qd_Qdxm[2] 缺少必填字段 QdID/Qdbh/Xmmc/Dw', '{\"sourceFileName\":\"source-bill.json\",\"sourceBatchNo\":\"QdID-001\",\"failureDetails\":[\"ZaoJia_Qd_Qdxm[2] 缺少必填字段 QdID/Qdbh/Xmmc/Dw\"],\"summary\":{\"versionCount\":2,\"billItemCount\":2,\"workItemCount\":1,\"failedItemCount\":1},\"sourceTables\":{\"ZaoJia_Qd_QdList\":2,\"ZaoJia_Qd_Qdxm\":2,\"ZaoJia_Qd_Gznr\":1}}', '2026-04-19T10:00:00.000Z', '2026-04-19T10:01:00.000Z')",
    );
    await runtime.pool.query(
      "insert into audit_log (id, project_id, stage_code, resource_type, resource_id, action, operator_id, after_payload, created_at) values ('audit-log-source-001', 'project-001', 'estimate', 'import_task', 'import-task-source-001', 'bill_import', 'user-001', '{\"billVersionId\":\"bill-version-001\",\"sourceSpecCode\":\"QdGf-001\",\"sourceSpecName\":\"江苏清单规范\",\"versionCount\":2,\"billItemCount\":2,\"workItemCount\":1,\"failedItemCount\":1}', '2026-04-19T10:01:00.000Z')",
    );
    await runtime.pool.query(
      "insert into quota_line (id, bill_item_id, source_standard_set_code, source_quota_id, source_sequence, chapter_code, quota_code, quota_name, unit, quantity, labor_fee, material_fee, machine_fee, content_factor, source_mode) values ('quota-line-001', 'bill-item-001', 'JS-2014', 'quota-001', 1, '01', '010101', '挖土方', 'm3', 10, 1, 2, 3, 1, 'manual')",
    );
    await runtime.pool.query(
      "insert into reference_quota (id, source_dataset, source_region, standard_set_code, discipline_code, source_quota_id, source_sequence, chapter_code, quota_code, quota_name, unit, labor_fee, material_fee, machine_fee, work_content_summary, resource_composition_summary, search_text, metadata) values ('reference-quota-001', 'ZH_SHANGHAI.csv', '上海', 'JS-2014', 'building', 'quota-ref-001', 1, '01', '010101', '参考挖土方', 'm3', 1, 2, 3, '挖土、装土', '人工费 1 / 材料费 2 / 机械费 3', '参考挖土方 挖土 装土', '{\"rowType\":\"quota\"}')",
    );

    const versions = await runtime.pool.query(
      "select id, project_id, version_name, source_version_id, source_stage_id, source_spec_code, source_spec_name, source_visible_flag, source_default_flag from bill_version order by version_no",
    );
    const items = await runtime.pool.query(
      "select id, bill_version_id, item_code, parent_id, source_bill_id, source_sequence, source_level_code, is_measure_item, source_reference_price, source_fee_id, measure_category, measure_fee_flag, measure_category_subtype, feature_rule_text from bill_item order by sort_no",
    );
    const workItems = await runtime.pool.query(
      "select id, bill_item_id, work_content, source_spec_code, source_bill_id from bill_work_item",
    );
    const quotaLines = await runtime.pool.query(
      "select id, bill_item_id, quota_code from quota_line",
    );
    const reviewSubmissions = await runtime.pool.query(
      "select id, bill_version_id, status from review_submission",
    );
    const referenceQuotas = await runtime.pool.query(
      "select id, source_dataset, quota_code from reference_quota",
    );
    const disciplineTypes = await runtime.pool.query(
      "select id, discipline_code, discipline_name, source_markup, source_system from discipline_type",
    );
    const standardSets = await runtime.pool.query(
      "select id, standard_set_code, standard_set_name, discipline_code, source_field_code, source_system from standard_set",
    );
    const sourceImportTasks = await runtime.pool.query(
      "select id, source_type, source_label, total_item_count, imported_item_count, failed_item_count, latest_job_id, latest_error_message, metadata from import_task where id = 'import-task-source-001'",
    );
    const sourceAuditLogs = await runtime.pool.query(
      "select id, resource_type, resource_id, action, after_payload from audit_log where id = 'audit-log-source-001'",
    );

    assert.deepEqual(versions.rows, [
      {
        id: "bill-version-001",
        projectId: "project-001",
        versionName: "v1",
        sourceVersionId: null,
        sourceStageId: null,
        sourceSpecCode: "QdGf-001",
        sourceSpecName: "江苏清单规范",
        sourceVisibleFlag: true,
        sourceDefaultFlag: false,
      },
      {
        id: "bill-version-source-002",
        projectId: "project-001",
        versionName: "源清单导入多版本",
        sourceVersionId: "QdID-002",
        sourceStageId: "stage-001",
        sourceSpecCode: "QdGf-002",
        sourceSpecName: "江苏清单规范 2",
        sourceVisibleFlag: false,
        sourceDefaultFlag: true,
      },
    ]);
    assert.deepEqual(items.rows, [
      {
        id: "bill-item-001",
        billVersionId: "bill-version-001",
        parentId: null,
        itemCode: "A-001",
        sourceBillId: "QdID-001",
        sourceSequence: 1,
        sourceLevelCode: "Fbcch-001",
        isMeasureItem: false,
        sourceReferencePrice: 12.5,
        sourceFeeId: "QfID-001",
        measureCategory: "Cslb-001",
        measureFeeFlag: true,
        measureCategorySubtype: "CslbXf-001",
        featureRuleText: "按设计图示尺寸计算",
      },
      {
        id: "bill-item-002",
        billVersionId: "bill-version-001",
        parentId: "bill-item-001",
        itemCode: "A-001-1",
        sourceBillId: null,
        sourceSequence: null,
        sourceLevelCode: null,
        isMeasureItem: null,
        sourceReferencePrice: null,
        sourceFeeId: null,
        measureCategory: null,
        measureFeeFlag: null,
        measureCategorySubtype: null,
        featureRuleText: null,
      },
    ]);
    assert.deepEqual(workItems.rows, [
      {
        id: "work-item-001",
        billItemId: "bill-item-001",
        workContent: "机械开挖",
        sourceSpecCode: "QdGf-001",
        sourceBillId: "QdID-001",
      },
    ]);
    assert.deepEqual(quotaLines.rows, [
      {
        id: "quota-line-001",
        billItemId: "bill-item-001",
        quotaCode: "010101",
      },
    ]);
    assert.deepEqual(reviewSubmissions.rows, [
      {
        id: "review-submission-001",
        billVersionId: "bill-version-001",
        status: "pending",
      },
    ]);
    assert.deepEqual(disciplineTypes.rows, [
      {
        id: "discipline-type-001",
        disciplineCode: "building",
        disciplineName: "建筑工程",
        sourceMarkup: "ZY-BUILDING",
        sourceSystem: defaultSourceSystemCode,
      },
    ]);
    assert.deepEqual(standardSets.rows, [
      {
        id: "standard-set-001",
        standardSetCode: "JS-2014",
        standardSetName: "江苏省建筑与装饰工程计价定额 2014",
        disciplineCode: "building",
        sourceFieldCode: "DekID",
        sourceSystem: defaultSourceSystemCode,
      },
    ]);
    assert.equal(sourceImportTasks.rows[0].sourceType, "source_bill");
    assert.equal(sourceImportTasks.rows[0].metadata.sourceFileName, "source-bill.json");
    assert.equal(sourceImportTasks.rows[0].metadata.summary.versionCount, 2);
    assert.deepEqual(sourceImportTasks.rows[0].metadata.failureDetails, [
      "ZaoJia_Qd_Qdxm[2] 缺少必填字段 QdID/Qdbh/Xmmc/Dw",
    ]);
    assert.deepEqual(sourceAuditLogs.rows, [
      {
        id: "audit-log-source-001",
        resourceType: "import_task",
        resourceId: "import-task-source-001",
        action: "bill_import",
        afterPayload: {
          billVersionId: "bill-version-001",
          sourceSpecCode: "QdGf-001",
          sourceSpecName: "江苏清单规范",
          versionCount: 2,
          billItemCount: 2,
          workItemCount: 1,
          failedItemCount: 1,
        },
      },
    ]);
    await assert.rejects(
      runtime.pool.query(
        "insert into review_submission (id, project_id, bill_version_id, stage_code, discipline_code, status, submitted_by, submitted_at, submission_comment) values ('review-submission-002', 'project-001', 'bill-version-001', 'estimate', 'building', 'pending', 'user-002', '2026-04-19T10:01:00.000Z', '重复提交')",
      ),
    );
    await assert.rejects(
      runtime.pool.query(
        "insert into project (id, code, name, status) values ('project-002', 'PRJ-001', '项目 B', 'draft')",
      ),
    );
    await assert.rejects(
      runtime.pool.query(
        "insert into project_stage (id, project_id, stage_code, stage_name, status, sequence_no) values ('stage-002', 'project-001', 'estimate', '投资估算 2', 'draft', 2)",
      ),
    );
    await assert.rejects(
      runtime.pool.query(
        "insert into project_stage (id, project_id, stage_code, stage_name, status, sequence_no) values ('stage-003', 'project-001', 'budget', '施工图预算', 'draft', 1)",
      ),
    );
    await assert.rejects(
      runtime.pool.query(
        "insert into project_discipline (id, project_id, discipline_code, discipline_name, default_standard_set_code, status) values ('discipline-002', 'project-001', 'building', '建筑工程 2', 'JS-2014', 'enabled')",
      ),
    );
    await assert.rejects(
      runtime.pool.query(
        "insert into discipline_type (id, discipline_code, discipline_name, status) values ('discipline-type-002', 'building', '建筑工程 2', 'active')",
      ),
    );
    await assert.rejects(
      runtime.pool.query(
        "insert into standard_set (id, standard_set_code, standard_set_name, discipline_code, status) values ('standard-set-002', 'JS-2014', '重复定额集', 'building', 'active')",
      ),
    );
    await assert.rejects(
      runtime.pool.query(
        "insert into project_member (id, project_id, user_id, display_name, role_code) values ('member-002', 'project-001', 'user-001', 'Owner 2', 'project_owner')",
      ),
    );
    await assert.rejects(
      runtime.pool.query(
        "insert into bill_version (id, project_id, stage_code, discipline_code, version_no, version_name, version_status, source_version_id) values ('bill-version-002', 'project-001', 'estimate', 'building', 1, 'v1 repeat', 'editable', null)",
      ),
    );
    await assert.rejects(
      runtime.pool.query(
        "insert into bill_work_item (id, bill_item_id, work_content, sort_no) values ('work-item-002', 'bill-item-001', '机械开挖 2', 1)",
      ),
    );
    await assert.rejects(
      runtime.pool.query(
        "insert into bill_item (id, bill_version_id, parent_id, item_code, item_name, quantity, unit, sort_no) values ('bill-item-003', 'bill-version-001', 'missing-parent', 'A-003', '孤儿节点', 1, 'm3', 3)",
      ),
    );
    await assert.rejects(
      runtime.pool.query(
        "insert into bill_item (id, bill_version_id, parent_id, item_code, item_name, quantity, unit, sort_no) values ('bill-item-004', 'bill-version-001', 'bill-item-001', 'A-001-1', '重复子目', 1, 'm3', 4)",
      ),
    );
    assert.deepEqual(referenceQuotas.rows, [
      {
        id: "reference-quota-001",
        sourceDataset: "ZH_SHANGHAI.csv",
        quotaCode: "010101",
      },
    ]);
  } finally {
    await runtime.close();
  }
});

test("database migrations create pricing, fee, and audit tables", async () => {
  const runtime = await createPgMemDatabase();
  try {
    await runtime.pool.query(
      "insert into project (id, code, name, status) values ('project-001', 'PRJ-001', '项目 A', 'draft')",
    );
    await runtime.pool.query(
      "insert into price_version (id, version_code, version_name, region_code, discipline_code, status) values ('price-version-001', 'JS-2024-BUILDING', '江苏 2024 建筑价目', 'JS', 'building', 'active')",
    );
    await runtime.pool.query(
      "insert into price_item (id, price_version_id, quota_code, labor_unit_price, material_unit_price, machine_unit_price, total_unit_price) values ('price-item-001', 'price-version-001', '010101', 1, 2, 3, 6)",
    );
    await runtime.pool.query(
      "insert into fee_template (id, template_name, project_type, region_code, stage_scope, tax_mode, allocation_mode, status) values ('fee-template-001', '默认取费', 'building', 'JS', ARRAY['estimate'], 'general', 'proportional', 'active')",
    );
    await runtime.pool.query(
      "insert into fee_rule (id, fee_template_id, discipline_code, fee_type, fee_rate) values ('fee-rule-001', 'fee-template-001', 'building', 'management_fee', 0.12)",
    );
    await runtime.pool.query(
      "insert into audit_log (id, project_id, stage_code, resource_type, resource_id, action, operator_id, created_at) values ('audit-log-001', 'project-001', 'estimate', 'bill_version', 'bill-version-001', 'submit', 'user-001', '2026-04-19T10:00:00.000Z')",
    );
    await runtime.pool.query(
      "insert into process_document (id, project_id, stage_code, discipline_code, document_type, status, title, reference_no, amount, submitted_by, submitted_at, last_comment) values ('process-document-001', 'project-001', 'estimate', 'building', 'change_order', 'draft', '设计变更', 'CO-001', 88.5, 'user-001', '2026-04-19T10:00:00.000Z', '初稿')",
    );
    await runtime.pool.query(
      "insert into background_job (id, job_type, status, requested_by, project_id, payload, result, error_message, created_at, completed_at) values ('background-job-001', 'report_export', 'queued', 'user-001', 'project-001', '{\"projectId\":\"project-001\"}', null, null, '2026-04-19T10:00:00.000Z', null)",
    );
    await runtime.pool.query(
      "insert into report_export_task (id, project_id, report_type, status, requested_by, stage_code, discipline_code, report_template_id, output_format, created_at, completed_at, error_message, result_preview, download_file_name, download_content_type, download_content_length) values ('report-export-task-001', 'project-001', 'summary', 'queued', 'user-001', 'estimate', 'building', 'tpl-standard-summary-v1', 'pdf', '2026-04-19T10:00:00.000Z', null, null, null, null, null, null)",
    );
    await runtime.pool.query(
      "insert into knowledge_entry (id, project_id, stage_code, source_job_id, source_type, source_action, title, summary, tags, metadata, created_at) values ('knowledge-entry-001', 'project-001', 'estimate', 'background-job-001', 'review_submission', 'reject', 'review_reject', 'Need material evidence', ARRAY['review','reject'], '{\"billVersionId\":\"bill-version-001\"}', '2026-04-19T10:00:00.000Z')",
    );
    await runtime.pool.query(
      "insert into memory_entry (id, project_id, stage_code, source_job_id, memory_key, subject_type, subject_id, content, metadata, created_at) values ('memory-entry-001', 'project-001', 'estimate', 'background-job-001', 'project-001:user-001:review_submission:reject', 'user', 'user-001', 'review_submission:reject', '{\"resourceType\":\"review_submission\"}', '2026-04-19T10:00:00.000Z')",
    );
    await runtime.pool.query(
      "insert into skill_definition (id, skill_code, skill_name, description, status, runtime_config, created_at, updated_at) values ('skill-definition-001', 'quota-recommendation', '定额推荐', 'AI 定额推荐技能预留', 'active', '{\"entry\":\"quota\"}', '2026-04-19T10:00:00.000Z', '2026-04-19T10:00:00.000Z')",
    );
    await runtime.pool.query(
      "insert into knowledge_relation (id, project_id, from_type, from_id, to_type, to_id, relation_type, metadata, created_at) values ('knowledge-relation-001', 'project-001', 'knowledge_entry', 'knowledge-entry-001', 'memory_entry', 'memory-entry-001', 'derived_memory', '{\"confidence\":0.9}', '2026-04-19T10:00:00.000Z')",
    );
    await runtime.pool.query(
      "insert into ai_recommendation (id, project_id, stage_code, discipline_code, resource_type, resource_id, recommendation_type, input_payload, output_payload, status, created_by, handled_by, handled_at, status_reason, created_at, updated_at) values ('ai-recommendation-001', 'project-001', 'estimate', 'building', 'bill_item', 'bill-item-001', 'quota_recommendation', '{\"itemName\":\"土方工程\"}', '{\"quotaCode\":\"010101\"}', 'generated', 'user-001', null, null, null, '2026-04-19T10:00:00.000Z', '2026-04-19T10:00:00.000Z')",
    );

    const priceItems = await runtime.pool.query(
      "select id, price_version_id, total_unit_price from price_item",
    );
    const feeTemplates = await runtime.pool.query(
      "select id, template_name, stage_scope from fee_template",
    );
    const auditLogs = await runtime.pool.query(
      "select id, project_id, action from audit_log",
    );
    const processDocuments = await runtime.pool.query(
      "select id, document_type, status, amount from process_document",
    );
    const backgroundJobs = await runtime.pool.query(
      "select id, job_type, status from background_job",
    );
    const reportExportTasks = await runtime.pool.query(
      "select id, report_type, status, report_template_id, output_format from report_export_task",
    );
    const knowledgeEntries = await runtime.pool.query(
      "select id, source_type, source_action from knowledge_entry",
    );
    const memoryEntries = await runtime.pool.query(
      "select id, subject_type, subject_id from memory_entry",
    );
    const skillDefinitions = await runtime.pool.query(
      "select id, skill_code, status from skill_definition",
    );
    const knowledgeRelations = await runtime.pool.query(
      "select id, from_type, to_type, relation_type from knowledge_relation",
    );
    const aiRecommendations = await runtime.pool.query(
      "select id, recommendation_type, status from ai_recommendation",
    );

    assert.deepEqual(priceItems.rows, [
      {
        id: "price-item-001",
        priceVersionId: "price-version-001",
        totalUnitPrice: 6,
      },
    ]);
    assert.deepEqual(feeTemplates.rows, [
      {
        id: "fee-template-001",
        templateName: "默认取费",
        stageScope: ["estimate"],
      },
    ]);
    assert.deepEqual(auditLogs.rows, [
      {
        id: "audit-log-001",
        projectId: "project-001",
        action: "submit",
      },
    ]);
    assert.deepEqual(processDocuments.rows, [
      {
        id: "process-document-001",
        documentType: "change_order",
        status: "draft",
        amount: 88.5,
      },
    ]);
    assert.deepEqual(backgroundJobs.rows, [
      {
        id: "background-job-001",
        jobType: "report_export",
        status: "queued",
      },
    ]);
    assert.deepEqual(reportExportTasks.rows, [
      {
        id: "report-export-task-001",
        reportType: "summary",
        status: "queued",
        reportTemplateId: "tpl-standard-summary-v1",
        outputFormat: "pdf",
      },
    ]);
    assert.deepEqual(knowledgeEntries.rows, [
      {
        id: "knowledge-entry-001",
        sourceType: "review_submission",
        sourceAction: "reject",
      },
    ]);
    assert.deepEqual(memoryEntries.rows, [
      {
        id: "memory-entry-001",
        subjectType: "user",
        subjectId: "user-001",
      },
    ]);
    assert.deepEqual(skillDefinitions.rows, [
      {
        id: "skill-definition-001",
        skillCode: "quota-recommendation",
        status: "active",
      },
    ]);
    assert.deepEqual(knowledgeRelations.rows, [
      {
        id: "knowledge-relation-001",
        fromType: "knowledge_entry",
        toType: "memory_entry",
        relationType: "derived_memory",
      },
    ]);
    assert.deepEqual(aiRecommendations.rows, [
      {
        id: "ai-recommendation-001",
        recommendationType: "quota_recommendation",
        status: "generated",
      },
    ]);
    await assert.rejects(
      runtime.pool.query(
        "insert into price_version (id, version_code, version_name, region_code, discipline_code, status) values ('price-version-002', 'JS-2024-BUILDING', '江苏 2024 建筑价目 2', 'JS', 'building', 'active')",
      ),
    );
    await assert.rejects(
      runtime.pool.query(
        "insert into price_item (id, price_version_id, quota_code, labor_unit_price, material_unit_price, machine_unit_price, total_unit_price) values ('price-item-002', 'price-version-001', '010101', 1, 2, 3, 6)",
      ),
    );
  } finally {
    await runtime.close();
  }
});
