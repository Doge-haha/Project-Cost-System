import {
  InMemoryAiRecommendationRepository,
} from "../modules/ai/ai-recommendation-repository.js";
import { InMemoryAuditLogRepository } from "../modules/audit/audit-log-repository.js";
import { InMemoryBillItemRepository } from "../modules/bill/bill-item-repository.js";
import { InMemoryBillVersionRepository } from "../modules/bill/bill-version-repository.js";
import { InMemoryBillWorkItemRepository } from "../modules/bill/bill-work-item-repository.js";
import { InMemoryFeeRuleRepository } from "../modules/fee/fee-rule-repository.js";
import { InMemoryFeeTemplateRepository } from "../modules/fee/fee-template-repository.js";
import { InMemoryBackgroundJobRepository } from "../modules/jobs/background-job-repository.js";
import { InMemoryImportTaskRepository } from "../modules/import/import-task-repository.js";
import { InMemoryKnowledgeEntryRepository } from "../modules/knowledge/knowledge-entry-repository.js";
import { InMemoryMemoryEntryRepository } from "../modules/knowledge/memory-entry-repository.js";
import { defaultSourceSystemCode } from "../modules/master-data/master-data-constants.js";
import { InMemoryMasterDataRepository } from "../modules/master-data/master-data-repository.js";
import { InMemoryPriceItemRepository } from "../modules/pricing/price-item-repository.js";
import { InMemoryPriceVersionRepository } from "../modules/pricing/price-version-repository.js";
import { InMemoryProcessDocumentRepository } from "../modules/process/process-document-repository.js";
import { InMemoryProjectDisciplineRepository } from "../modules/project/project-discipline-repository.js";
import { InMemoryProjectMemberRepository } from "../modules/project/project-member-repository.js";
import { InMemoryProjectRepository } from "../modules/project/project-repository.js";
import { InMemoryProjectStageRepository } from "../modules/project/project-stage-repository.js";
import { InMemoryQuotaLineRepository } from "../modules/quota/quota-line-repository.js";
import { InMemoryReferenceQuotaRepository } from "../modules/quota/reference-quota-repository.js";
import { InMemoryReportExportTaskRepository } from "../modules/reports/report-export-task-repository.js";
import { InMemoryReviewSubmissionRepository } from "../modules/review/review-submission-repository.js";
import type { CreateAppRepositoryOptions } from "./create-app-repositories.js";

const now = "2026-04-29T10:00:00.000Z";

export function createDemoAppRepositories(): CreateAppRepositoryOptions {
  return {
    projectRepository: new InMemoryProjectRepository([
      {
        id: "project-001",
        code: "PRJ-001",
        name: "江苏示范计价项目",
        status: "active",
        defaultPriceVersionId: "price-version-001",
        defaultFeeTemplateId: "fee-template-001",
      },
    ]),
    projectStageRepository: new InMemoryProjectStageRepository([
      {
        id: "stage-001",
        projectId: "project-001",
        stageCode: "estimate",
        stageName: "投资估算",
        status: "active",
        sequenceNo: 1,
      },
      {
        id: "stage-002",
        projectId: "project-001",
        stageCode: "budget",
        stageName: "施工图预算",
        status: "submitted",
        sequenceNo: 2,
      },
    ]),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository([
      {
        id: "discipline-001",
        projectId: "project-001",
        disciplineCode: "building",
        disciplineName: "建筑工程",
        defaultStandardSetCode: "JS-2014",
        status: "enabled",
      },
    ]),
    masterDataRepository: new InMemoryMasterDataRepository({
      disciplineTypes: [
        {
          id: "discipline-type-001",
          disciplineCode: "building",
          disciplineName: "建筑工程",
          disciplineGroup: "construction",
          businessViewType: "cost",
          regionCode: "JS",
          sourceMarkup: "ZY-BUILDING",
          gb08Code: "GB08-BUILDING",
          gb13Code: "GB13-BUILDING",
          sourceSystem: defaultSourceSystemCode,
          status: "active",
        },
      ],
      standardSets: [
        {
          id: "standard-set-001",
          standardSetCode: "JS-2014",
          standardSetName: "江苏省建筑与装饰工程计价定额 2014",
          disciplineCode: "building",
          regionCode: "JS",
          versionYear: 2014,
          standardType: "quota",
          sourceFieldCode: "DekID",
          sourceMarkup: "012014jz",
          sourceSystem: defaultSourceSystemCode,
          status: "active",
        },
      ],
    }),
    projectMemberRepository: new InMemoryProjectMemberRepository([
      {
        id: "member-001",
        projectId: "project-001",
        userId: "user-001",
        displayName: "本地演示 Owner",
        roleCode: "project_owner",
        scopes: [{ scopeType: "project", scopeValue: "project-001" }],
      },
      {
        id: "member-002",
        projectId: "project-001",
        userId: "engineer-001",
        displayName: "造价工程师",
        roleCode: "cost_engineer",
        scopes: [
          { scopeType: "stage", scopeValue: "estimate" },
          { scopeType: "discipline", scopeValue: "building" },
        ],
      },
    ]),
    billVersionRepository: new InMemoryBillVersionRepository([
      {
        id: "bill-version-001",
        projectId: "project-001",
        stageCode: "estimate",
        disciplineCode: "building",
        versionNo: 1,
        versionName: "估算版 V1",
        versionStatus: "editable",
        sourceVersionId: null,
      },
      {
        id: "bill-version-002",
        projectId: "project-001",
        stageCode: "budget",
        disciplineCode: "building",
        versionNo: 1,
        versionName: "预算版 V1",
        versionStatus: "submitted",
        sourceVersionId: "bill-version-001",
      },
    ]),
    billItemRepository: new InMemoryBillItemRepository([
      {
        id: "bill-item-001",
        billVersionId: "bill-version-001",
        parentId: null,
        itemCode: "010101",
        itemName: "土方工程",
        quantity: 120,
        unit: "m3",
        sortNo: 1,
        systemUnitPrice: 18,
        finalUnitPrice: 18,
        systemAmount: 2160,
        finalAmount: 2160,
        calculatedAt: now,
      },
      {
        id: "bill-item-002",
        billVersionId: "bill-version-001",
        parentId: null,
        itemCode: "010102",
        itemName: "混凝土垫层",
        quantity: 45,
        unit: "m3",
        sortNo: 2,
        systemUnitPrice: 68,
        manualUnitPrice: 72,
        finalUnitPrice: 72,
        systemAmount: 3060,
        finalAmount: 3240,
        calculatedAt: now,
      },
    ]),
    billWorkItemRepository: new InMemoryBillWorkItemRepository([
      {
        id: "work-item-001",
        billItemId: "bill-item-001",
        workContent: "机械开挖、装车外运",
        sortNo: 1,
      },
      {
        id: "work-item-002",
        billItemId: "bill-item-002",
        workContent: "模板、浇筑、养护",
        sortNo: 1,
      },
    ]),
    quotaLineRepository: new InMemoryQuotaLineRepository([
      {
        id: "quota-line-001",
        billItemId: "bill-item-001",
        sourceStandardSetCode: "JS-2014",
        sourceQuotaId: "quota-ref-001",
        sourceSequence: 1,
        chapterCode: "01",
        quotaCode: "010101",
        quotaName: "挖一般土方",
        unit: "m3",
        quantity: 120,
        laborFee: 4,
        materialFee: 2,
        machineFee: 12,
        contentFactor: 1,
        sourceMode: "manual",
      },
    ]),
    referenceQuotaRepository: new InMemoryReferenceQuotaRepository([
      {
        id: "reference-quota-001",
        sourceDataset: "demo",
        sourceRegion: "江苏",
        standardSetCode: "JS-2014",
        disciplineCode: "building",
        sourceQuotaId: "quota-ref-001",
        sourceSequence: 1,
        chapterCode: "01",
        quotaCode: "010101",
        quotaName: "挖一般土方",
        unit: "m3",
        laborFee: 4,
        materialFee: 2,
        machineFee: 12,
        workContentSummary: "开挖、装车、外运",
        resourceCompositionSummary: "人工、材料、机械",
        searchText: "挖一般土方 开挖 外运",
        metadata: { demo: true },
      },
    ]),
    priceVersionRepository: new InMemoryPriceVersionRepository([
      {
        id: "price-version-001",
        versionCode: "JS-2024-BUILDING",
        versionName: "江苏 2024 建筑价目",
        regionCode: "JS",
        disciplineCode: "building",
        status: "active",
      },
    ]),
    priceItemRepository: new InMemoryPriceItemRepository([
      {
        id: "price-item-001",
        priceVersionId: "price-version-001",
        quotaCode: "010101",
        laborUnitPrice: 4,
        materialUnitPrice: 2,
        machineUnitPrice: 12,
        totalUnitPrice: 18,
      },
    ]),
    feeTemplateRepository: new InMemoryFeeTemplateRepository([
      {
        id: "fee-template-001",
        templateName: "江苏建筑默认取费",
        projectType: "building",
        regionCode: "JS",
        stageScope: ["estimate", "budget"],
        taxMode: "general",
        allocationMode: "proportional",
        status: "active",
      },
    ]),
    feeRuleRepository: new InMemoryFeeRuleRepository([
      {
        id: "fee-rule-001",
        feeTemplateId: "fee-template-001",
        disciplineCode: "building",
        feeType: "management_fee",
        feeRate: 0.12,
      },
    ]),
    reviewSubmissionRepository: new InMemoryReviewSubmissionRepository([
      {
        id: "review-submission-001",
        projectId: "project-001",
        billVersionId: "bill-version-002",
        stageCode: "budget",
        disciplineCode: "building",
        status: "pending",
        submittedBy: "engineer-001",
        submittedAt: now,
        submissionComment: "预算版提交审核",
      },
    ]),
    processDocumentRepository: new InMemoryProcessDocumentRepository([
      {
        id: "process-document-001",
        projectId: "project-001",
        stageCode: "estimate",
        disciplineCode: "building",
        documentType: "change_order",
        status: "submitted",
        title: "现场签证单",
        referenceNo: "CO-001",
        amount: 8800,
        submittedBy: "engineer-001",
        submittedAt: now,
        lastComment: "待审核",
      },
    ]),
    backgroundJobRepository: new InMemoryBackgroundJobRepository([
      {
        id: "background-job-001",
        jobType: "report_export",
        status: "completed",
        requestedBy: "user-001",
        projectId: "project-001",
        payload: { projectId: "project-001", reportType: "summary" },
        result: { reportType: "summary", totalAmount: 5400 },
        createdAt: now,
        completedAt: now,
      },
    ]),
    importTaskRepository: new InMemoryImportTaskRepository([
      {
        id: "import-task-001",
        projectId: "project-001",
        sourceType: "json",
        sourceLabel: "演示清单导入",
        sourceFileName: "demo-bill.json",
        status: "completed",
        requestedBy: "user-001",
        totalItemCount: 2,
        importedItemCount: 2,
        memoryItemCount: 1,
        failedItemCount: 0,
        latestJobId: "background-job-001",
        failureDetails: [],
        retryCount: 0,
        retryLimit: 3,
        canRetry: false,
        metadata: { demo: true },
        createdAt: now,
        completedAt: now,
      },
    ]),
    reportExportTaskRepository: new InMemoryReportExportTaskRepository([
      {
        id: "report-export-task-001",
        projectId: "project-001",
        reportType: "summary",
        status: "completed",
        requestedBy: "user-001",
        stageCode: "estimate",
        disciplineCode: "building",
        reportTemplateId: "tpl-standard-summary-v1",
        outputFormat: "json",
        createdAt: now,
        completedAt: now,
        resultPreview: { totalAmount: 5400 },
        downloadFileName: "demo-summary.json",
        downloadContentType: "application/json",
        downloadContentLength: 128,
      },
    ]),
    knowledgeEntryRepository: new InMemoryKnowledgeEntryRepository([
      {
        id: "knowledge-entry-001",
        projectId: "project-001",
        stageCode: "estimate",
        sourceJobId: "background-job-001",
        sourceType: "review_submission",
        sourceAction: "submitted",
        title: "预算审核关注点",
        summary: "混凝土垫层人工调价需要在审核时重点确认。",
        tags: ["review", "pricing"],
        metadata: { billVersionId: "bill-version-002" },
        createdAt: now,
      },
    ]),
    memoryEntryRepository: new InMemoryMemoryEntryRepository([
      {
        id: "memory-entry-001",
        projectId: "project-001",
        stageCode: "estimate",
        sourceJobId: "background-job-001",
        memoryKey: "project-001:pricing-preference",
        subjectType: "project",
        subjectId: "project-001",
        content: "演示项目优先保留系统价与人工调整差异。",
        metadata: { demo: true },
        createdAt: now,
      },
    ]),
    aiRecommendationRepository: new InMemoryAiRecommendationRepository([
      {
        id: "ai-recommendation-001",
        projectId: "project-001",
        stageCode: "estimate",
        disciplineCode: "building",
        resourceType: "bill_item",
        resourceId: "bill-item-002",
        recommendationType: "quota_recommendation",
        inputPayload: { itemName: "混凝土垫层" },
        outputPayload: { quotaCode: "010102", reason: "名称与工程内容匹配" },
        status: "generated",
        createdBy: "user-001",
        createdAt: now,
        updatedAt: now,
      },
    ]),
    auditLogRepository: new InMemoryAuditLogRepository([
      {
        id: "audit-log-001",
        projectId: "project-001",
        stageCode: "estimate",
        resourceType: "project",
        resourceId: "project-001",
        action: "create",
        operatorId: "user-001",
        createdAt: now,
      },
      {
        id: "audit-log-002",
        projectId: "project-001",
        stageCode: "budget",
        resourceType: "review_submission",
        resourceId: "review-submission-001",
        action: "submitted",
        operatorId: "engineer-001",
        createdAt: now,
      },
    ]),
  };
}
