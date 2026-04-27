import test from "node:test";
import assert from "node:assert/strict";

import { createPgMemDatabase } from "./helpers/pg-mem.js";

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
      "insert into project_member (id, project_id, user_id, display_name, role_code) values ('member-001', 'project-001', 'user-001', 'Owner', 'project_owner')",
    );
    await runtime.pool.query(
      "insert into project_member_scope (id, member_id, scope_type, scope_value) values ('scope-001', 'member-001', 'project', 'project-001')",
    );
    await runtime.pool.query(
      "insert into bill_version (id, project_id, stage_code, discipline_code, version_no, version_name, version_status, source_version_id) values ('bill-version-001', 'project-001', 'estimate', 'building', 1, 'v1', 'editable', null)",
    );
    await runtime.pool.query(
      "insert into bill_item (id, bill_version_id, parent_id, item_code, item_name, quantity, unit, sort_no) values ('bill-item-001', 'bill-version-001', null, 'A-001', '土方工程', 10, 'm3', 1)",
    );
    await runtime.pool.query(
      "insert into bill_work_item (id, bill_item_id, work_content, sort_no) values ('work-item-001', 'bill-item-001', '机械开挖', 1)",
    );
    await runtime.pool.query(
      "insert into quota_line (id, bill_item_id, source_standard_set_code, source_quota_id, source_sequence, chapter_code, quota_code, quota_name, unit, quantity, labor_fee, material_fee, machine_fee, content_factor, source_mode) values ('quota-line-001', 'bill-item-001', 'JS-2014', 'quota-001', 1, '01', '010101', '挖土方', 'm3', 10, 1, 2, 3, 1, 'manual')",
    );

    const versions = await runtime.pool.query(
      "select id, project_id, version_name from bill_version order by version_no",
    );
    const items = await runtime.pool.query(
      "select id, bill_version_id, item_code from bill_item order by sort_no",
    );
    const quotaLines = await runtime.pool.query(
      "select id, bill_item_id, quota_code from quota_line",
    );

    assert.deepEqual(versions.rows, [
      {
        id: "bill-version-001",
        projectId: "project-001",
        versionName: "v1",
      },
    ]);
    assert.deepEqual(items.rows, [
      {
        id: "bill-item-001",
        billVersionId: "bill-version-001",
        itemCode: "A-001",
      },
    ]);
    assert.deepEqual(quotaLines.rows, [
      {
        id: "quota-line-001",
        billItemId: "bill-item-001",
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
      "insert into report_export_task (id, project_id, report_type, status, requested_by, stage_code, discipline_code, created_at, completed_at, error_message, result_preview, download_file_name, download_content_type, download_content_length) values ('report-export-task-001', 'project-001', 'summary', 'queued', 'user-001', 'estimate', 'building', '2026-04-19T10:00:00.000Z', null, null, null, null, null, null)",
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
      "select id, report_type, status from report_export_task",
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
  } finally {
    await runtime.close();
  }
});
