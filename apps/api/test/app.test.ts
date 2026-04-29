import test from "node:test";
import assert from "node:assert/strict";

import { createApp } from "../src/app/create-app.js";
import { signAccessToken } from "../src/shared/auth/jwt.js";
import {
  InMemoryProjectRepository,
  type ProjectRecord,
} from "../src/modules/project/project-repository.js";
import {
  InMemoryProjectStageRepository,
  type ProjectStageRecord,
} from "../src/modules/project/project-stage-repository.js";
import {
  InMemoryProjectDisciplineRepository,
  type ProjectDisciplineRecord,
} from "../src/modules/project/project-discipline-repository.js";
import {
  InMemoryProjectMemberRepository,
  type ProjectMemberRecord,
} from "../src/modules/project/project-member-repository.js";
import {
  InMemoryBillVersionRepository,
  type BillVersionRecord,
} from "../src/modules/bill/bill-version-repository.js";
import {
  InMemoryPriceVersionRepository,
  type PriceVersionRecord,
} from "../src/modules/pricing/price-version-repository.js";
import {
  InMemoryFeeTemplateRepository,
  type FeeTemplateRecord,
} from "../src/modules/fee/fee-template-repository.js";
import {
  InMemoryAuditLogRepository,
  type AuditLogRecord,
} from "../src/modules/audit/audit-log-repository.js";
import {
  InMemoryBackgroundJobRepository,
  type BackgroundJobRecord,
} from "../src/modules/jobs/background-job-repository.js";
import {
  InMemoryReviewSubmissionRepository,
  type ReviewSubmissionRecord,
} from "../src/modules/review/review-submission-repository.js";
import {
  InMemoryProcessDocumentRepository,
  type ProcessDocumentRecord,
} from "../src/modules/process/process-document-repository.js";
import {
  InMemoryImportTaskRepository,
  type ImportTaskRecord,
} from "../src/modules/import/import-task-repository.js";

const jwtSecret = "test-secret-1234567890";
const seededProjects: ProjectRecord[] = [
  {
    id: "project-001",
    code: "PRJ-001",
    name: "新点 SaaS 计价一期",
    status: "draft",
  },
];
const seededStages: ProjectStageRecord[] = [
  {
    id: "stage-001",
    projectId: "project-001",
    stageCode: "estimate",
    stageName: "投资估算",
    status: "draft",
    sequenceNo: 1,
  },
  {
    id: "stage-002",
    projectId: "project-001",
    stageCode: "budget",
    stageName: "施工图预算",
    status: "draft",
    sequenceNo: 2,
  },
];
const seededDisciplines: ProjectDisciplineRecord[] = [
  {
    id: "discipline-001",
    projectId: "project-001",
    disciplineCode: "building",
    disciplineName: "建筑工程",
    defaultStandardSetCode: "js-2013-building",
    status: "enabled",
  },
];
const seededMembers: ProjectMemberRecord[] = [
  {
    id: "member-001",
    projectId: "project-001",
    userId: "user-001",
    displayName: "Owner User",
    roleCode: "project_owner",
    scopes: [
      {
        scopeType: "project",
        scopeValue: "project-001",
      },
    ],
  },
  {
    id: "member-002",
    projectId: "project-001",
    userId: "user-002",
    displayName: "Cost Engineer",
    roleCode: "cost_engineer",
    scopes: [
      {
        scopeType: "stage",
        scopeValue: "estimate",
      },
      {
        scopeType: "discipline",
        scopeValue: "building",
      },
    ],
  },
];
const seededBillVersions: BillVersionRecord[] = [
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
    sourceVersionId: null,
  },
];
const seededReviewSubmissions: ReviewSubmissionRecord[] = [
  {
    id: "review-submission-001",
    projectId: "project-001",
    billVersionId: "bill-version-001",
    stageCode: "estimate",
    disciplineCode: "building",
    status: "pending",
    submittedBy: "user-002",
    submittedAt: "2026-04-18T11:30:00.000Z",
    submissionComment: "待审核",
    reviewedBy: null,
    reviewedAt: null,
    reviewComment: null,
    rejectionReason: null,
  },
  {
    id: "review-submission-002",
    projectId: "project-001",
    billVersionId: "bill-version-001",
    stageCode: "estimate",
    disciplineCode: "building",
    status: "rejected",
    submittedBy: "user-002",
    submittedAt: "2026-04-17T11:30:00.000Z",
    submissionComment: "旧审核",
    reviewedBy: "user-001",
    reviewedAt: "2026-04-17T12:00:00.000Z",
    reviewComment: "退回",
    rejectionReason: "单价依据不足",
  },
];
const seededProcessDocuments: ProcessDocumentRecord[] = [
  {
    id: "process-document-001",
    projectId: "project-001",
    stageCode: "estimate",
    disciplineCode: "building",
    documentType: "change_order",
    status: "submitted",
    title: "设计变更单",
    referenceNo: "BG-001",
    amount: 1200,
    submittedBy: "user-002",
    submittedAt: "2026-04-18T10:30:00.000Z",
    lastComment: "待审核",
  },
  {
    id: "process-document-002",
    projectId: "project-001",
    stageCode: "estimate",
    disciplineCode: "building",
    documentType: "site_visa",
    status: "draft",
    title: "现场签证单",
    referenceNo: "QZ-001",
    amount: 800,
    submittedBy: "user-002",
    submittedAt: "2026-04-18T09:30:00.000Z",
    lastComment: null,
  },
  {
    id: "process-document-003",
    projectId: "project-001",
    stageCode: "estimate",
    disciplineCode: "building",
    documentType: "progress_payment",
    status: "rejected",
    title: "进度款申请",
    referenceNo: "JK-001",
    amount: 5000,
    submittedBy: "user-002",
    submittedAt: "2026-04-17T08:30:00.000Z",
    lastComment: "退回修改",
  },
];
const seededWorkspaceJobs: BackgroundJobRecord[] = [
  {
    id: "background-job-010",
    jobType: "knowledge_extraction",
    status: "processing",
    requestedBy: "user-001",
    projectId: "project-001",
    payload: {
      projectId: "project-001",
      source: "audit_log",
      events: [],
    },
    result: null,
    errorMessage: null,
    createdAt: "2026-04-18T13:00:00.000Z",
    completedAt: null,
  },
  {
    id: "background-job-011",
    jobType: "report_export",
    status: "queued",
    requestedBy: "user-001",
    projectId: "project-001",
    payload: {
      projectId: "project-001",
      reportType: "summary",
    },
    result: null,
    errorMessage: null,
    createdAt: "2026-04-18T12:30:00.000Z",
    completedAt: null,
  },
  {
    id: "background-job-012",
    jobType: "project_recalculate",
    status: "failed",
    requestedBy: "user-001",
    projectId: "project-001",
    payload: {
      projectId: "project-001",
    },
    result: null,
    errorMessage: "计算失败",
    createdAt: "2026-04-18T12:00:00.000Z",
    completedAt: "2026-04-18T12:05:00.000Z",
  },
];
const seededImportTasks: ImportTaskRecord[] = [
  {
    id: "import-task-001",
    projectId: "project-001",
    sourceType: "audit_log",
    sourceLabel: "审计日志筛选导入",
    sourceFileName: null,
    sourceBatchNo: "audit-20260418-001",
    status: "processing",
    requestedBy: "user-001",
    totalItemCount: 12,
    importedItemCount: 0,
    memoryItemCount: 0,
    failedItemCount: 0,
    latestJobId: "background-job-010",
    latestErrorMessage: null,
    failureDetails: [],
    retryCount: 0,
    retryLimit: 3,
    canRetry: true,
    metadata: {
      createdFrom: "audit_log",
      sourceFileName: null,
      sourceBatchNo: "audit-20260418-001",
      failureDetails: [],
      retryCount: 0,
      retryLimit: 3,
    },
    createdAt: "2026-04-18T13:00:00.000Z",
    completedAt: null,
  },
  {
    id: "import-task-002",
    projectId: "project-001",
    sourceType: "review_submission",
    sourceLabel: "审核事件导入",
    sourceFileName: null,
    sourceBatchNo: "review-20260418-001",
    status: "queued",
    requestedBy: "user-001",
    totalItemCount: 3,
    importedItemCount: 0,
    memoryItemCount: 0,
    failedItemCount: 0,
    latestJobId: "background-job-011",
    latestErrorMessage: null,
    failureDetails: [],
    retryCount: 0,
    retryLimit: 3,
    canRetry: true,
    metadata: {
      createdFrom: "extract_jobs",
      sourceFileName: null,
      sourceBatchNo: "review-20260418-001",
      failureDetails: [],
      retryCount: 0,
      retryLimit: 3,
    },
    createdAt: "2026-04-18T12:30:00.000Z",
    completedAt: null,
  },
  {
    id: "import-task-003",
    projectId: "project-001",
    sourceType: "excel_upload",
    sourceLabel: "清单文件导入",
    sourceFileName: "estimate-v1.xlsx",
    sourceBatchNo: "upload-20260418-001",
    status: "failed",
    requestedBy: "user-001",
    totalItemCount: 5,
    importedItemCount: 1,
    memoryItemCount: 0,
    failedItemCount: 4,
    latestJobId: "background-job-012",
    latestErrorMessage: "解析失败",
    failureDetails: ["解析失败", "第 4 行缺少工程量"],
    retryCount: 2,
    retryLimit: 3,
    canRetry: true,
    metadata: {
      createdFrom: "manual_upload",
      sourceFileName: "estimate-v1.xlsx",
      sourceBatchNo: "upload-20260418-001",
      failureDetails: ["解析失败", "第 4 行缺少工程量"],
      failedItems: [
        {
          lineNo: 4,
          reasonCode: "missing_field",
          reasonLabel: "缺少必填字段",
          errorMessage: "缺少工程量",
          projectId: "project-001",
          resourceType: "bill_item",
          action: "create",
          keys: ["projectId", "resourceType", "action", "name"],
          retryEventSnapshot: {
            projectId: "project-001",
            resourceType: "bill_item",
            action: "create",
            name: "某清单项",
          },
        },
        {
          lineNo: 5,
          reasonCode: "parse_error",
          reasonLabel: "解析失败",
          errorMessage: "金额字段不是合法数字",
          projectId: "project-001",
          resourceType: "bill_item",
          action: "update",
          keys: ["projectId", "resourceType", "action", "amount"],
          retryEventSnapshot: {
            projectId: "project-001",
            resourceType: "bill_item",
            action: "update",
            amount: "not-a-number",
          },
        },
      ],
      failureSnapshots: [
        {
          lineNo: 4,
          reasonCode: "missing_field",
          resourceType: "bill_item",
          action: "create",
          retryEventSnapshot: {
            projectId: "project-001",
            resourceType: "bill_item",
            action: "create",
            name: "某清单项",
          },
        },
        {
          lineNo: 5,
          reasonCode: "parse_error",
          resourceType: "bill_item",
          action: "update",
          retryEventSnapshot: {
            projectId: "project-001",
            resourceType: "bill_item",
            action: "update",
            amount: "not-a-number",
          },
        },
      ],
      retryCount: 2,
      retryLimit: 3,
    },
    createdAt: "2026-04-18T12:00:00.000Z",
    completedAt: "2026-04-18T12:05:00.000Z",
  },
];
const seededPriceVersions: PriceVersionRecord[] = [
  {
    id: "price-version-001",
    versionCode: "JS-2024-BUILDING",
    versionName: "江苏 2024 建筑价目",
    regionCode: "JS",
    disciplineCode: "building",
    status: "active",
  },
];
const seededFeeTemplates: FeeTemplateRecord[] = [
  {
    id: "fee-template-001",
    templateName: "江苏建筑默认取费",
    projectType: "building",
    regionCode: "JS",
    stageScope: ["estimate"],
    taxMode: "general",
    allocationMode: "proportional",
    status: "active",
  },
];
const seededAuditLogs: AuditLogRecord[] = [
  {
    id: "audit-log-001",
    projectId: "project-001",
    stageCode: "estimate",
    resourceType: "project",
    resourceId: "project-001",
    action: "update_pricing_defaults",
    operatorId: "user-001",
    beforePayload: {
      defaultPriceVersionId: null,
      defaultFeeTemplateId: null,
    },
    afterPayload: {
      defaultPriceVersionId: "price-version-001",
      defaultFeeTemplateId: "fee-template-001",
    },
    createdAt: "2026-04-18T10:00:00.000Z",
  },
  {
    id: "audit-log-002",
    projectId: "project-001",
    stageCode: "estimate",
    resourceType: "bill_version",
    resourceId: "bill-version-001",
    action: "submit",
    operatorId: "user-002",
    beforePayload: {
      status: "editable",
    },
    afterPayload: {
      status: "submitted",
    },
    createdAt: "2026-04-18T11:00:00.000Z",
  },
  {
    id: "audit-log-003",
    projectId: "project-001",
    stageCode: "budget",
    resourceType: "bill_version",
    resourceId: "bill-version-002",
    action: "submit",
    operatorId: "user-002",
    beforePayload: {
      status: "editable",
    },
    afterPayload: {
      status: "submitted",
    },
    createdAt: "2026-04-18T12:00:00.000Z",
  },
];

test("GET /health stays public", async () => {
  const app = createApp({ jwtSecret });

  const response = await app.inject({
    method: "GET",
    url: "/health",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().ok, true);
  assert.equal(response.json().service, "@saas-pricing/api");
  assert.equal(response.json().status, "up");
  assert.match(response.json().checkedAt, /^\d{4}-\d{2}-\d{2}T/);

  await app.close();
});

test("signAccessToken rejects insecure JWT secrets", async () => {
  await assert.rejects(
    () =>
      signAccessToken(
        {
          sub: "user-001",
          roleCodes: ["project_owner"],
          displayName: "Owner User",
        },
        "short-secret",
      ),
    /JWT secret must be at least 16 characters long/,
  );
});

test("GET /v1/projects/:id/stages returns the project's configured stages", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectStageRepository: new InMemoryProjectStageRepository(seededStages),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
  });
  const token = await signAccessToken(
    {
      sub: "user-001",
      roleCodes: ["project_owner"],
      displayName: "Stage User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/stages",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    items: seededStages,
  });

  await app.close();
});

test("GET /v1/projects/:id/disciplines returns the project's enabled disciplines", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      seededDisciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
  });
  const token = await signAccessToken(
    {
      sub: "user-001",
      roleCodes: ["project_owner"],
      displayName: "Discipline User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/disciplines",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    items: seededDisciplines,
  });

  await app.close();
});

test("GET /v1/projects/:id/stages returns 404 when the project is missing", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectStageRepository: new InMemoryProjectStageRepository(seededStages),
  });
  const token = await signAccessToken(
    {
      sub: "user-008",
      roleCodes: ["project_owner"],
      displayName: "Missing Stage Project User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url: "/v1/projects/project-404/stages",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), {
    error: {
      code: "PROJECT_NOT_FOUND",
      message: "Project not found",
    },
  });

  await app.close();
});

test("GET /v1/projects/:id/members returns the project's member list with scopes", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
  });
  const token = await signAccessToken(
    {
      sub: "user-001",
      roleCodes: ["project_owner"],
      displayName: "Member User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/members",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    items: seededMembers,
  });

  await app.close();
});

test("GET /v1/projects/:id/workspace returns aggregated project workspace data for project owners", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectStageRepository: new InMemoryProjectStageRepository(seededStages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      seededDisciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
    billVersionRepository: new InMemoryBillVersionRepository(seededBillVersions),
    reviewSubmissionRepository: new InMemoryReviewSubmissionRepository(
      seededReviewSubmissions,
    ),
    processDocumentRepository: new InMemoryProcessDocumentRepository(
      seededProcessDocuments,
    ),
    backgroundJobRepository: new InMemoryBackgroundJobRepository(seededWorkspaceJobs),
    importTaskRepository: new InMemoryImportTaskRepository(seededImportTasks),
  });
  const token = await signAccessToken(
    {
      sub: "user-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/workspace",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().project.id, "project-001");
  assert.equal(response.json().currentStage.stageCode, "estimate");
  assert.deepEqual(
    response.json().availableStages.map((stage: { stageCode: string }) => stage.stageCode),
    ["estimate", "budget"],
  );
  assert.deepEqual(
    response.json().disciplines.map(
      (discipline: { disciplineCode: string }) => discipline.disciplineCode,
    ),
    ["building"],
  );
  assert.deepEqual(
    response.json().billVersions.map((version: { id: string }) => version.id),
    ["bill-version-001", "bill-version-002"],
  );
  assert.deepEqual(response.json().todoSummary, {
    totalCount: 3,
    pendingReviewCount: 1,
    pendingProcessDocumentCount: 1,
    draftProcessDocumentCount: 1,
    items: ["1 条审核待处理", "1 条过程单据待审核", "1 条过程单据仍在草稿"],
  });
  assert.deepEqual(response.json().riskSummary, {
    totalCount: 3,
    rejectedReviewCount: 1,
    rejectedProcessDocumentCount: 1,
    failedJobCount: 1,
    items: ["1 条审核被驳回", "1 条过程单据被退回", "1 个异步任务失败"],
  });
  assert.deepEqual(response.json().importStatus, {
    mode: "import_task",
    totalCount: 3,
    queuedCount: 1,
    processingCount: 1,
    completedCount: 0,
    failedCount: 1,
    latestTask: {
      id: "import-task-001",
      sourceType: "audit_log",
      sourceLabel: "审计日志筛选导入",
      status: "processing",
      createdAt: "2026-04-18T13:00:00.000Z",
    },
    note: "导入状态已切换为正式导入任务模型，工作台摘要与导入任务记录保持一致。",
  });
  assert.deepEqual(response.json().currentUser, {
    userId: "user-001",
    displayName: "Owner User",
    memberId: "member-001",
    permissionSummary: {
      roleCode: "project_owner",
      roleLabel: "项目负责人",
      canManageProject: true,
      canEditProject: true,
      canExportReports: true,
      scopeSummary: ["项目全部范围"],
      visibleStageCodes: ["estimate", "budget"],
      visibleDisciplineCodes: ["building"],
    },
  });

  await app.close();
});

test("GET /v1/projects/:id/workspace filters bill versions and permission scope for scoped members", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectStageRepository: new InMemoryProjectStageRepository(seededStages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      seededDisciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
    billVersionRepository: new InMemoryBillVersionRepository(seededBillVersions),
    reviewSubmissionRepository: new InMemoryReviewSubmissionRepository(
      seededReviewSubmissions,
    ),
    processDocumentRepository: new InMemoryProcessDocumentRepository(
      seededProcessDocuments,
    ),
    backgroundJobRepository: new InMemoryBackgroundJobRepository(seededWorkspaceJobs),
    importTaskRepository: new InMemoryImportTaskRepository(seededImportTasks),
  });
  const token = await signAccessToken(
    {
      sub: "user-002",
      roleCodes: ["cost_engineer"],
      displayName: "Cost Engineer",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/workspace?stageCode=budget",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().currentStage.stageCode, "budget");
  assert.deepEqual(
    response.json().billVersions.map((version: { id: string }) => version.id),
    ["bill-version-001"],
  );
  assert.deepEqual(response.json().currentUser.permissionSummary, {
    roleCode: "cost_engineer",
    roleLabel: "造价工程师",
    canManageProject: false,
    canEditProject: true,
    canExportReports: true,
    scopeSummary: ["阶段：estimate", "专业：building"],
    visibleStageCodes: ["estimate"],
    visibleDisciplineCodes: ["building"],
  });
  assert.equal(response.json().todoSummary.totalCount, 3);
  assert.equal(response.json().riskSummary.failedJobCount, 1);
  assert.equal(response.json().importStatus.processingCount, 1);

  await app.close();
});

test("POST /v1/projects creates a draft project with configured stages", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository([]),
    projectStageRepository: new InMemoryProjectStageRepository([]),
    priceVersionRepository: new InMemoryPriceVersionRepository(
      seededPriceVersions,
    ),
    feeTemplateRepository: new InMemoryFeeTemplateRepository(
      seededFeeTemplates,
    ),
  });
  const token = await signAccessToken(
    {
      sub: "user-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const createResponse = await app.inject({
    method: "POST",
    url: "/v1/projects",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      code: "PRJ-NEW-001",
      name: "项目启动链测试项目",
      defaultPriceVersionId: "price-version-001",
      defaultFeeTemplateId: "fee-template-001",
      stages: [
        {
          stageCode: "estimate",
          stageName: "投资估算",
          status: "draft",
          sequenceNo: 1,
        },
        {
          stageCode: "budget",
          stageName: "施工图预算",
          status: "draft",
          sequenceNo: 2,
        },
      ],
    },
  });

  assert.equal(createResponse.statusCode, 201);
  assert.equal(createResponse.json().project.code, "PRJ-NEW-001");
  assert.equal(createResponse.json().project.status, "draft");
  assert.equal(createResponse.json().stages.length, 2);
  assert.equal(createResponse.json().members.length, 1);
  assert.equal(createResponse.json().members[0].userId, "user-001");
  assert.equal(createResponse.json().members[0].roleCode, "project_owner");
  assert.deepEqual(
    createResponse.json().stages.map((stage: { stageCode: string }) => stage.stageCode),
    ["estimate", "budget"],
  );

  const listResponse = await app.inject({
    method: "GET",
    url: "/v1/projects",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.json().items.length, 1);
  assert.equal(listResponse.json().items[0].code, "PRJ-NEW-001");

  const stagesResponse = await app.inject({
    method: "GET",
    url: `/v1/projects/${createResponse.json().project.id}/stages`,
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(stagesResponse.statusCode, 200);
  assert.deepEqual(
    stagesResponse.json().items.map((stage: { stageCode: string }) => stage.stageCode),
    ["estimate", "budget"],
  );

  const membersResponse = await app.inject({
    method: "GET",
    url: `/v1/projects/${createResponse.json().project.id}/members`,
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(membersResponse.statusCode, 200);
  assert.equal(membersResponse.json().items.length, 1);
  assert.equal(membersResponse.json().items[0].userId, "user-001");

  await app.close();
});

test("PUT /v1/projects/:id/stages updates stage ordering and writes audit logs", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(
      seededProjects.map((project) => ({ ...project })),
    ),
    projectStageRepository: new InMemoryProjectStageRepository(
      seededStages.map((stage) => ({ ...stage })),
    ),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      seededDisciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
    auditLogRepository: new InMemoryAuditLogRepository([]),
  });
  const token = await signAccessToken(
    {
      sub: "user-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const updateResponse = await app.inject({
    method: "PUT",
    url: "/v1/projects/project-001/stages",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      stages: [
        {
          stageCode: "budget",
          stageName: "施工图预算",
          status: "active",
          sequenceNo: 1,
        },
        {
          stageCode: "estimate",
          stageName: "投资估算",
          status: "draft",
          sequenceNo: 2,
        },
      ],
    },
  });

  assert.equal(updateResponse.statusCode, 200);
  assert.deepEqual(
    updateResponse.json().items.map((stage: { stageCode: string }) => stage.stageCode),
    ["budget", "estimate"],
  );
  assert.equal(updateResponse.json().items[0].status, "active");

  const auditResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/audit-logs?resourceType=project_stage&resourceId=project-001",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(auditResponse.statusCode, 200);
  assert.equal(auditResponse.json().items.length, 1);
  assert.equal(auditResponse.json().items[0].action, "update");
  assert.deepEqual(
    auditResponse.json().items[0].afterPayload.stages.map(
      (stage: { stageCode: string }) => stage.stageCode,
    ),
    ["budget", "estimate"],
  );

  await app.close();
});

test("PUT /v1/projects/:id/members replaces project members and scopes", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(
      seededProjects.map((project) => ({ ...project })),
    ),
    projectStageRepository: new InMemoryProjectStageRepository(
      seededStages.map((stage) => ({ ...stage })),
    ),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      seededDisciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(
      seededMembers.map((member) => ({
        ...member,
        scopes: member.scopes.map((scope) => ({ ...scope })),
      })),
    ),
    auditLogRepository: new InMemoryAuditLogRepository([]),
  });
  const token = await signAccessToken(
    {
      sub: "user-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "PUT",
    url: "/v1/projects/project-001/members",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      members: [
        {
          userId: "user-001",
          displayName: "Owner User",
          roleCode: "project_owner",
          scopes: [
            {
              scopeType: "project",
              scopeValue: "project-001",
            },
          ],
        },
        {
          userId: "user-003",
          displayName: "Reviewer User",
          roleCode: "reviewer",
          scopes: [
            {
              scopeType: "stage",
              scopeValue: "estimate",
            },
          ],
        },
      ],
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().items.length, 2);
  assert.equal(response.json().items[1].userId, "user-003");
  assert.equal(response.json().items[1].roleCode, "reviewer");

  const listResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/members",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.json().items.length, 2);
  assert.equal(listResponse.json().items[1].scopes[0].scopeValue, "estimate");

  await app.close();
});

test("PUT /v1/projects/:id/default-pricing-config updates project default price version and fee template", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectStageRepository: new InMemoryProjectStageRepository(seededStages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      seededDisciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
    priceVersionRepository: new InMemoryPriceVersionRepository(
      seededPriceVersions,
    ),
    feeTemplateRepository: new InMemoryFeeTemplateRepository(
      seededFeeTemplates,
    ),
  });
  const token = await signAccessToken(
    {
      sub: "user-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "PUT",
    url: "/v1/projects/project-001/default-pricing-config",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      defaultPriceVersionId: "price-version-001",
      defaultFeeTemplateId: "fee-template-001",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    ...seededProjects[0],
    defaultPriceVersionId: "price-version-001",
    defaultFeeTemplateId: "fee-template-001",
  });

  const auditResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/audit-logs?resourceType=project&resourceId=project-001",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(auditResponse.statusCode, 200);
  assert.equal(auditResponse.json().items.length, 1);
  assert.equal(auditResponse.json().items[0].action, "update_pricing_defaults");
  assert.deepEqual(auditResponse.json().items[0].beforePayload, {
    defaultPriceVersionId: null,
    defaultFeeTemplateId: null,
  });
  assert.deepEqual(auditResponse.json().items[0].afterPayload, {
    defaultPriceVersionId: "price-version-001",
    defaultFeeTemplateId: "fee-template-001",
  });

  await app.close();
});

test("PUT /v1/projects/:id/default-price-version and /default-fee-template update defaults independently", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(
      seededProjects.map((project) => ({
        ...project,
        defaultPriceVersionId: null,
        defaultFeeTemplateId: null,
      })),
    ),
    projectStageRepository: new InMemoryProjectStageRepository(seededStages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      seededDisciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
    priceVersionRepository: new InMemoryPriceVersionRepository(
      seededPriceVersions,
    ),
    feeTemplateRepository: new InMemoryFeeTemplateRepository(
      seededFeeTemplates,
    ),
  });
  const token = await signAccessToken(
    {
      sub: "user-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const priceResponse = await app.inject({
    method: "PUT",
    url: "/v1/projects/project-001/default-price-version",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      defaultPriceVersionId: "price-version-001",
    },
  });

  assert.equal(priceResponse.statusCode, 200);
  assert.equal(priceResponse.json().defaultPriceVersionId, "price-version-001");
  assert.equal(priceResponse.json().defaultFeeTemplateId, null);

  const feeResponse = await app.inject({
    method: "PUT",
    url: "/v1/projects/project-001/default-fee-template",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      defaultFeeTemplateId: "fee-template-001",
    },
  });

  assert.equal(feeResponse.statusCode, 200);
  assert.equal(feeResponse.json().defaultPriceVersionId, "price-version-001");
  assert.equal(feeResponse.json().defaultFeeTemplateId, "fee-template-001");

  const clearPriceResponse = await app.inject({
    method: "PUT",
    url: "/v1/projects/project-001/default-price-version",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      defaultPriceVersionId: null,
    },
  });

  assert.equal(clearPriceResponse.statusCode, 200);
  assert.equal(clearPriceResponse.json().defaultPriceVersionId, null);
  assert.equal(clearPriceResponse.json().defaultFeeTemplateId, "fee-template-001");

  await app.close();
});

test("PUT /v1/projects/:id/default-pricing-config rejects non-managers", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectStageRepository: new InMemoryProjectStageRepository(seededStages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      seededDisciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
    priceVersionRepository: new InMemoryPriceVersionRepository(
      seededPriceVersions,
    ),
    feeTemplateRepository: new InMemoryFeeTemplateRepository(
      seededFeeTemplates,
    ),
  });
  const token = await signAccessToken(
    {
      sub: "user-002",
      roleCodes: ["cost_engineer"],
      displayName: "Cost Engineer",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "PUT",
    url: "/v1/projects/project-001/default-pricing-config",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      defaultPriceVersionId: "price-version-001",
    },
  });

  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.json(), {
    error: {
      code: "FORBIDDEN",
      message: "You do not have permission to manage this project",
    },
  });

  await app.close();
});

test("GET /v1/projects/:id/audit-logs filters by operatorId, resourceIdPrefix, and createdAt range", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectStageRepository: new InMemoryProjectStageRepository(seededStages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      seededDisciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
    auditLogRepository: new InMemoryAuditLogRepository(seededAuditLogs),
  });
  const token = await signAccessToken(
    {
      sub: "user-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url:
      "/v1/projects/project-001/audit-logs?resourceType=bill_version&action=submit&operatorId=user-002&resourceIdPrefix=bill-version-00&createdFrom=2026-04-18T10:30:00.000Z&createdTo=2026-04-18T11:30:00.000Z",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().items.length, 1);
  assert.equal(response.json().items[0].resourceId, "bill-version-001");

  await app.close();
});

test("POST /v1/jobs/pull-next claims the oldest queued job for system administrators", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectStageRepository: new InMemoryProjectStageRepository(seededStages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      seededDisciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
    backgroundJobRepository: new InMemoryBackgroundJobRepository([
      {
        id: "background-job-001",
        jobType: "project_recalculate",
        status: "queued",
        requestedBy: "user-002",
        projectId: "project-001",
        payload: {
          projectId: "project-001",
        },
        result: null,
        errorMessage: null,
        createdAt: "2026-04-18T11:00:00.000Z",
        completedAt: null,
      },
      {
        id: "background-job-002",
        jobType: "report_export",
        status: "queued",
        requestedBy: "user-002",
        projectId: "project-001",
        payload: {
          projectId: "project-001",
          reportType: "summary",
        },
        result: null,
        errorMessage: null,
        createdAt: "2026-04-18T10:00:00.000Z",
        completedAt: null,
      },
      {
        id: "background-job-003",
        jobType: "report_export",
        status: "completed",
        requestedBy: "user-002",
        projectId: "project-001",
        payload: {
          projectId: "project-001",
          reportType: "summary",
        },
        result: {
          exported: true,
        },
        errorMessage: null,
        createdAt: "2026-04-18T09:00:00.000Z",
        completedAt: "2026-04-18T09:01:00.000Z",
      },
    ]),
  });
  const token = await signAccessToken(
    {
      sub: "system-admin-001",
      roleCodes: ["system_admin"],
      displayName: "System Admin",
    },
    jwtSecret,
  );

  const firstResponse = await app.inject({
    method: "POST",
    url: "/v1/jobs/pull-next",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(firstResponse.statusCode, 200);
  assert.equal(firstResponse.json().job.id, "background-job-002");
  assert.equal(firstResponse.json().job.status, "processing");

  const secondResponse = await app.inject({
    method: "POST",
    url: "/v1/jobs/pull-next",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(secondResponse.statusCode, 200);
  assert.equal(secondResponse.json().job.id, "background-job-001");
  assert.equal(secondResponse.json().job.status, "processing");

  const thirdResponse = await app.inject({
    method: "POST",
    url: "/v1/jobs/pull-next",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(thirdResponse.statusCode, 200);
  assert.equal(thirdResponse.json().job, null);

  await app.close();
});

test("POST /v1/jobs/:jobId/complete and /fail update processing jobs for system administrators", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectStageRepository: new InMemoryProjectStageRepository(seededStages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      seededDisciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
    backgroundJobRepository: new InMemoryBackgroundJobRepository([
      {
        id: "background-job-001",
        jobType: "report_export",
        status: "processing",
        requestedBy: "user-002",
        projectId: "project-001",
        payload: {
          projectId: "project-001",
          reportType: "summary",
        },
        result: null,
        errorMessage: null,
        createdAt: "2026-04-18T10:00:00.000Z",
        completedAt: null,
      },
      {
        id: "background-job-002",
        jobType: "project_recalculate",
        status: "processing",
        requestedBy: "user-002",
        projectId: "project-001",
        payload: {
          projectId: "project-001",
        },
        result: null,
        errorMessage: null,
        createdAt: "2026-04-18T10:05:00.000Z",
        completedAt: null,
      },
    ]),
  });
  const token = await signAccessToken(
    {
      sub: "system-admin-001",
      roleCodes: ["system_admin"],
      displayName: "System Admin",
    },
    jwtSecret,
  );

  const completeResponse = await app.inject({
    method: "POST",
    url: "/v1/jobs/background-job-001/complete",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      result: {
        exported: true,
      },
    },
  });

  assert.equal(completeResponse.statusCode, 200);
  assert.equal(completeResponse.json().status, "completed");
  assert.deepEqual(completeResponse.json().result, {
    exported: true,
  });

  const failResponse = await app.inject({
    method: "POST",
    url: "/v1/jobs/background-job-002/fail",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      errorMessage: "worker execution failed",
    },
  });

  assert.equal(failResponse.statusCode, 200);
  assert.equal(failResponse.json().status, "failed");
  assert.equal(failResponse.json().errorMessage, "worker execution failed");

  await app.close();
});

test("POST /v1/jobs/:jobId/complete and /fail reject non-processing jobs", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectStageRepository: new InMemoryProjectStageRepository(seededStages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      seededDisciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
    backgroundJobRepository: new InMemoryBackgroundJobRepository([
      {
        id: "background-job-001",
        jobType: "report_export",
        status: "queued",
        requestedBy: "user-002",
        projectId: "project-001",
        payload: {
          projectId: "project-001",
          reportType: "summary",
        },
        result: null,
        errorMessage: null,
        createdAt: "2026-04-18T10:00:00.000Z",
        completedAt: null,
      },
      {
        id: "background-job-002",
        jobType: "project_recalculate",
        status: "completed",
        requestedBy: "user-002",
        projectId: "project-001",
        payload: {
          projectId: "project-001",
        },
        result: {
          recalculatedCount: 1,
        },
        errorMessage: null,
        createdAt: "2026-04-18T10:05:00.000Z",
        completedAt: "2026-04-18T10:06:00.000Z",
      },
    ]),
  });
  const token = await signAccessToken(
    {
      sub: "system-admin-001",
      roleCodes: ["system_admin"],
      displayName: "System Admin",
    },
    jwtSecret,
  );

  const completeResponse = await app.inject({
    method: "POST",
    url: "/v1/jobs/background-job-001/complete",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      result: {
        exported: true,
      },
    },
  });

  assert.equal(completeResponse.statusCode, 409);
  assert.equal(completeResponse.json().error.code, "BACKGROUND_JOB_NOT_PROCESSING");

  const failResponse = await app.inject({
    method: "POST",
    url: "/v1/jobs/background-job-002/fail",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      errorMessage: "late worker failure",
    },
  });

  assert.equal(failResponse.statusCode, 409);
  assert.equal(failResponse.json().error.code, "BACKGROUND_JOB_NOT_PROCESSING");

  await app.close();
});

test("POST /v1/jobs/:jobId/retry requeues failed project jobs for project owners", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectStageRepository: new InMemoryProjectStageRepository(seededStages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      seededDisciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
    backgroundJobRepository: new InMemoryBackgroundJobRepository([
      {
        id: "background-job-009",
        jobType: "knowledge_extraction",
        status: "failed",
        requestedBy: "user-001",
        projectId: "project-001",
        payload: {
          projectId: "project-001",
          source: "audit_log",
          importTaskId: "import-task-009",
          events: [],
        },
        result: null,
        errorMessage: "runtime unavailable",
        createdAt: "2026-04-18T10:00:00.000Z",
        completedAt: "2026-04-18T10:05:00.000Z",
      },
    ]),
    importTaskRepository: new InMemoryImportTaskRepository([
      {
        id: "import-task-009",
        projectId: "project-001",
        sourceType: "audit_log",
        sourceLabel: "审计日志筛选导入",
        sourceFileName: "review-events.xlsx",
        sourceBatchNo: "audit-20260418-009",
        status: "failed",
        requestedBy: "user-001",
        totalItemCount: 8,
        importedItemCount: 0,
        memoryItemCount: 0,
        failedItemCount: 3,
        latestJobId: "background-job-009",
        latestErrorMessage: "runtime unavailable",
        failureDetails: ["runtime unavailable"],
        retryCount: 1,
        retryLimit: 3,
        canRetry: true,
        metadata: {
          retryHistory: [],
          failedItems: [
            {
              lineNo: 4,
              reasonCode: "missing_field",
              reasonLabel: "缺少必填字段",
              errorMessage: "缺少工程量",
              projectId: "project-001",
              resourceType: "bill_item",
              action: "create",
              keys: ["projectId", "resourceType", "action", "name"],
              retryEventSnapshot: {
                projectId: "project-001",
                resourceType: "bill_item",
                action: "create",
                name: "某清单项",
              },
            },
            {
              lineNo: 5,
              reasonCode: "invalid_value",
              reasonLabel: "字段值非法",
              errorMessage: "amount 必须是数字",
              projectId: "project-001",
              resourceType: "bill_item",
              action: "update",
              keys: ["projectId", "resourceType", "action", "amount"],
              retryEventSnapshot: {
                projectId: "project-001",
                resourceType: "bill_item",
                action: "update",
                amount: "oops",
              },
            },
          ],
        },
        createdAt: "2026-04-18T10:00:00.000Z",
        completedAt: "2026-04-18T10:05:00.000Z",
      },
    ]),
  });
  const ownerToken = await signAccessToken(
    {
      sub: "user-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const retryResponse = await app.inject({
    method: "POST",
    url: "/v1/jobs/background-job-009/retry",
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
    payload: {
      failureReason: "missing_field",
      failureResourceType: "bill_item",
      failureAction: "create",
    },
  });

  assert.equal(retryResponse.statusCode, 200);
  assert.equal(retryResponse.json().status, "queued");
  assert.equal(retryResponse.json().errorMessage, null);
  assert.equal(retryResponse.json().completedAt, null);

  const importTasksResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/import-tasks",
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
  });

  assert.equal(importTasksResponse.statusCode, 200);
  assert.equal(importTasksResponse.json().items[0].status, "queued");
  assert.deepEqual(importTasksResponse.json().items[0].metadata.retryContext, {
    failureReason: "missing_field",
    failureResourceType: "bill_item",
    failureAction: "create",
  });
  assert.deepEqual(importTasksResponse.json().items[0].metadata.retryHistory[0].retryContext, {
    failureReason: "missing_field",
    failureResourceType: "bill_item",
    failureAction: "create",
  });

  const jobsResponse = await app.inject({
    method: "GET",
    url: "/v1/jobs?projectId=project-001&status=queued",
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
  });

  assert.equal(jobsResponse.statusCode, 200);
  assert.equal(jobsResponse.json().items[0].id, "background-job-009");

  await app.close();
});

test("POST /v1/jobs/:jobId/retry preserves knowledge-extraction payload while recording the selected subset context", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectStageRepository: new InMemoryProjectStageRepository(seededStages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      seededDisciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
    backgroundJobRepository: new InMemoryBackgroundJobRepository([
      {
        id: "background-job-010",
        jobType: "knowledge_extraction",
        status: "failed",
        requestedBy: "user-001",
        projectId: "project-001",
        payload: {
          projectId: "project-001",
          source: "audit_log",
          importTaskId: "import-task-010",
          events: [
            {
              projectId: "project-001",
              resourceType: "bill_item",
              action: "create",
            },
            {
              projectId: "project-001",
              resourceType: "bill_item",
              action: "update",
            },
            {
              projectId: "project-001",
              resourceType: "review_submission",
              action: "create",
            },
          ],
        },
        result: null,
        errorMessage: "runtime unavailable",
        createdAt: "2026-04-18T10:00:00.000Z",
        completedAt: "2026-04-18T10:05:00.000Z",
      },
    ]),
    importTaskRepository: new InMemoryImportTaskRepository([
      {
        id: "import-task-010",
        projectId: "project-001",
        sourceType: "audit_log",
        sourceLabel: "审计日志筛选导入",
        sourceFileName: "review-events.xlsx",
        sourceBatchNo: "audit-20260418-010",
        status: "failed",
        requestedBy: "user-001",
        totalItemCount: 3,
        importedItemCount: 0,
        memoryItemCount: 0,
        failedItemCount: 3,
        latestJobId: "background-job-010",
        latestErrorMessage: "runtime unavailable",
        failureDetails: ["runtime unavailable"],
        retryCount: 0,
        retryLimit: 3,
        canRetry: true,
        metadata: {
          retryHistory: [],
          failedItems: [
            {
              lineNo: 4,
              reasonCode: "missing_field",
              reasonLabel: "缺少必填字段",
              errorMessage: "缺少工程量",
              projectId: "project-001",
              resourceType: "bill_item",
              action: "create",
              keys: ["projectId", "resourceType", "action", "name"],
              retryEventSnapshot: {
                projectId: "project-001",
                resourceType: "bill_item",
                action: "create",
                name: "某清单项",
              },
            },
            {
              lineNo: 5,
              reasonCode: "invalid_value",
              reasonLabel: "字段值非法",
              errorMessage: "amount 必须是数字",
              projectId: "project-001",
              resourceType: "bill_item",
              action: "update",
              keys: ["projectId", "resourceType", "action", "amount"],
              retryEventSnapshot: {
                projectId: "project-001",
                resourceType: "bill_item",
                action: "update",
                amount: "oops",
              },
            },
          ],
        },
        createdAt: "2026-04-18T10:00:00.000Z",
        completedAt: "2026-04-18T10:05:00.000Z",
      },
    ]),
  });
  const ownerToken = await signAccessToken(
    {
      sub: "user-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const retryResponse = await app.inject({
    method: "POST",
    url: "/v1/jobs/background-job-010/retry",
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
    payload: {
      failureReason: "missing_field",
      failureResourceType: "bill_item",
      failureAction: "create",
    },
  });

  assert.equal(retryResponse.statusCode, 200);
  assert.deepEqual(retryResponse.json().payload.events, [
    {
      projectId: "project-001",
      resourceType: "bill_item",
      action: "create",
    },
    {
      projectId: "project-001",
      resourceType: "bill_item",
      action: "update",
    },
    {
      projectId: "project-001",
      resourceType: "review_submission",
      action: "create",
    },
  ]);
  assert.deepEqual(retryResponse.json().payload.retryEvents, [
    {
      projectId: "project-001",
      resourceType: "bill_item",
      action: "create",
      name: "某清单项",
    },
  ]);

  const importTasksResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/import-tasks",
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
  });

  assert.equal(importTasksResponse.statusCode, 200);
  assert.deepEqual(importTasksResponse.json().items[0].metadata.retryContext, {
    failureReason: "missing_field",
    failureResourceType: "bill_item",
    failureAction: "create",
  });

  await app.close();
});

test("POST /v1/jobs/:jobId/retry clears stale retryEvents when retrying the full knowledge-extraction job", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectStageRepository: new InMemoryProjectStageRepository(seededStages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      seededDisciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
    backgroundJobRepository: new InMemoryBackgroundJobRepository([
      {
        id: "background-job-011",
        jobType: "knowledge_extraction",
        status: "failed",
        requestedBy: "user-001",
        projectId: "project-001",
        payload: {
          projectId: "project-001",
          source: "audit_log",
          importTaskId: "import-task-011",
          events: [
            {
              projectId: "project-001",
              resourceType: "bill_item",
              action: "create",
            },
            {
              projectId: "project-001",
              resourceType: "review_submission",
              action: "create",
            },
          ],
          retryContext: {
            failureReason: "missing_field",
            failureResourceType: "bill_item",
            failureAction: "create",
          },
          retryEvents: [
            {
              projectId: "project-001",
              resourceType: "bill_item",
              action: "create",
              name: "旧子集",
            },
          ],
        },
        result: null,
        errorMessage: "runtime unavailable",
        createdAt: "2026-04-18T10:00:00.000Z",
        completedAt: "2026-04-18T10:05:00.000Z",
      },
    ]),
    importTaskRepository: new InMemoryImportTaskRepository([
      {
        id: "import-task-011",
        projectId: "project-001",
        sourceType: "audit_log",
        sourceLabel: "审计日志筛选导入",
        sourceFileName: "review-events.xlsx",
        sourceBatchNo: "audit-20260418-011",
        status: "failed",
        requestedBy: "user-001",
        totalItemCount: 2,
        importedItemCount: 0,
        memoryItemCount: 0,
        failedItemCount: 1,
        latestJobId: "background-job-011",
        latestErrorMessage: "runtime unavailable",
        failureDetails: ["runtime unavailable"],
        retryCount: 1,
        retryLimit: 3,
        canRetry: true,
        metadata: {
          retryContext: {
            failureReason: "missing_field",
            failureResourceType: "bill_item",
            failureAction: "create",
          },
          retryHistory: [],
          failedItems: [],
        },
        createdAt: "2026-04-18T10:00:00.000Z",
        completedAt: "2026-04-18T10:05:00.000Z",
      },
    ]),
  });
  const ownerToken = await signAccessToken(
    {
      sub: "user-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const retryResponse = await app.inject({
    method: "POST",
    url: "/v1/jobs/background-job-011/retry",
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
    payload: {},
  });

  assert.equal(retryResponse.statusCode, 200);
  assert.deepEqual(retryResponse.json().payload.events, [
    {
      projectId: "project-001",
      resourceType: "bill_item",
      action: "create",
    },
    {
      projectId: "project-001",
      resourceType: "review_submission",
      action: "create",
    },
  ]);
  assert.equal("retryEvents" in retryResponse.json().payload, false);
  assert.deepEqual(retryResponse.json().payload.retryContext, {
    failureReason: null,
    failureResourceType: null,
    failureAction: null,
  });

  const importTasksResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/import-tasks",
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
  });

  assert.equal(importTasksResponse.statusCode, 200);
  assert.equal(importTasksResponse.json().items[0].metadata.retryContext, null);

  await app.close();
});

test("POST /v1/jobs/:jobId/retry rejects scoped retry when only part of the selected failed items have snapshots", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectStageRepository: new InMemoryProjectStageRepository(seededStages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      seededDisciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
    backgroundJobRepository: new InMemoryBackgroundJobRepository([
      {
        id: "background-job-012",
        jobType: "knowledge_extraction",
        status: "failed",
        requestedBy: "user-001",
        projectId: "project-001",
        payload: {
          projectId: "project-001",
          source: "audit_log",
          importTaskId: "import-task-012",
          events: [
            {
              projectId: "project-001",
              resourceType: "bill_item",
              action: "create",
            },
          ],
        },
        result: null,
        errorMessage: "runtime unavailable",
        createdAt: "2026-04-18T10:00:00.000Z",
        completedAt: "2026-04-18T10:05:00.000Z",
      },
    ]),
    importTaskRepository: new InMemoryImportTaskRepository([
      {
        id: "import-task-012",
        projectId: "project-001",
        sourceType: "audit_log",
        sourceLabel: "审计日志筛选导入",
        sourceFileName: "review-events.xlsx",
        sourceBatchNo: "audit-20260418-012",
        status: "failed",
        requestedBy: "user-001",
        totalItemCount: 2,
        importedItemCount: 0,
        memoryItemCount: 0,
        failedItemCount: 2,
        latestJobId: "background-job-012",
        latestErrorMessage: "runtime unavailable",
        failureDetails: ["runtime unavailable"],
        retryCount: 0,
        retryLimit: 3,
        canRetry: true,
        metadata: {
          retryHistory: [],
          failedItems: [
            {
              lineNo: 4,
              reasonCode: "missing_field",
              reasonLabel: "缺少必填字段",
              errorMessage: "缺少工程量",
              projectId: "project-001",
              resourceType: "bill_item",
              action: "create",
              keys: ["projectId", "resourceType", "action", "name"],
              retryEventSnapshot: {
                projectId: "project-001",
                resourceType: "bill_item",
                action: "create",
                name: "某清单项",
              },
            },
            {
              lineNo: 5,
              reasonCode: "missing_field",
              reasonLabel: "缺少必填字段",
              errorMessage: "原始输入缺失",
              projectId: "project-001",
              resourceType: "bill_item",
              action: "create",
              keys: [],
              retryEventSnapshot: null,
            },
          ],
        },
        createdAt: "2026-04-18T10:00:00.000Z",
        completedAt: "2026-04-18T10:05:00.000Z",
      },
    ]),
  });
  const ownerToken = await signAccessToken(
    {
      sub: "user-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const retryResponse = await app.inject({
    method: "POST",
    url: "/v1/jobs/background-job-012/retry",
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
    payload: {
      failureReason: "missing_field",
      failureResourceType: "bill_item",
      failureAction: "create",
    },
  });

  assert.equal(retryResponse.statusCode, 409);
  assert.deepEqual(retryResponse.json(), {
    error: {
      code: "IMPORT_TASK_RETRY_INPUT_INCOMPLETE",
      message:
        "Some failed items in the selected subset do not have retryable event snapshots",
    },
  });

  const jobsResponse = await app.inject({
    method: "GET",
    url: "/v1/jobs?projectId=project-001&status=failed",
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
  });

  assert.equal(jobsResponse.statusCode, 200);
  assert.equal(jobsResponse.json().items[0].id, "background-job-012");
  assert.equal(jobsResponse.json().items[0].status, "failed");

  await app.close();
});

test("POST /v1/jobs/:jobId/retry checks import retry limit before rebuilding scoped retry payload", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectStageRepository: new InMemoryProjectStageRepository(seededStages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      seededDisciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
    backgroundJobRepository: new InMemoryBackgroundJobRepository([
      {
        id: "background-job-014",
        jobType: "knowledge_extraction",
        status: "failed",
        requestedBy: "user-001",
        projectId: "project-001",
        payload: {
          projectId: "project-001",
          source: "audit_log",
          importTaskId: "import-task-014",
          events: [
            {
              projectId: "project-001",
              resourceType: "bill_item",
              action: "create",
            },
          ],
        },
        result: null,
        errorMessage: "runtime unavailable",
        createdAt: "2026-04-18T10:00:00.000Z",
        completedAt: "2026-04-18T10:05:00.000Z",
      },
    ]),
    importTaskRepository: new InMemoryImportTaskRepository([
      {
        id: "import-task-014",
        projectId: "project-001",
        sourceType: "audit_log",
        sourceLabel: "审计日志筛选导入",
        sourceFileName: "review-events.xlsx",
        sourceBatchNo: "audit-20260418-014",
        status: "failed",
        requestedBy: "user-001",
        totalItemCount: 1,
        importedItemCount: 0,
        memoryItemCount: 0,
        failedItemCount: 1,
        latestJobId: "background-job-014",
        latestErrorMessage: "runtime unavailable",
        failureDetails: ["runtime unavailable"],
        retryCount: 3,
        retryLimit: 3,
        canRetry: false,
        metadata: {
          retryHistory: [],
          failedItems: [
            {
              lineNo: 4,
              reasonCode: "missing_field",
              reasonLabel: "缺少必填字段",
              errorMessage: "缺少工程量",
              projectId: "project-001",
              resourceType: "bill_item",
              action: "create",
              keys: ["projectId", "resourceType", "action", "name"],
              retryEventSnapshot: {
                projectId: "project-001",
                resourceType: "bill_item",
                action: "create",
                name: "某清单项",
              },
            },
          ],
        },
        createdAt: "2026-04-18T10:00:00.000Z",
        completedAt: "2026-04-18T10:05:00.000Z",
      },
    ]),
  });
  const ownerToken = await signAccessToken(
    {
      sub: "user-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const retryResponse = await app.inject({
    method: "POST",
    url: "/v1/jobs/background-job-014/retry",
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
    payload: {
      failureReason: "missing_field",
      failureResourceType: "bill_item",
      failureAction: "create",
    },
  });

  assert.equal(retryResponse.statusCode, 409);
  assert.deepEqual(retryResponse.json(), {
    error: {
      code: "IMPORT_TASK_RETRY_LIMIT_REACHED",
      message: "Import task retry limit reached",
    },
  });

  const jobsResponse = await app.inject({
    method: "GET",
    url: "/v1/jobs?projectId=project-001&status=failed",
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
  });

  assert.equal(jobsResponse.statusCode, 200);
  assert.equal(jobsResponse.json().items[0].id, "background-job-014");
  assert.equal(jobsResponse.json().items[0].status, "failed");
  assert.equal("retryEvents" in jobsResponse.json().items[0].payload, false);

  await app.close();
});

test("POST /v1/jobs/:jobId/retry rebuilds scoped retry events from formal failureSnapshots metadata", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectStageRepository: new InMemoryProjectStageRepository(seededStages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      seededDisciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
    backgroundJobRepository: new InMemoryBackgroundJobRepository([
      {
        id: "background-job-013",
        jobType: "knowledge_extraction",
        status: "failed",
        requestedBy: "user-001",
        projectId: "project-001",
        payload: {
          projectId: "project-001",
          source: "audit_log",
          importTaskId: "import-task-013",
          events: [],
        },
        result: null,
        errorMessage: "runtime unavailable",
        createdAt: "2026-04-18T10:00:00.000Z",
        completedAt: "2026-04-18T10:05:00.000Z",
      },
    ]),
    importTaskRepository: new InMemoryImportTaskRepository([
      {
        id: "import-task-013",
        projectId: "project-001",
        sourceType: "audit_log",
        sourceLabel: "审计日志筛选导入",
        sourceFileName: "review-events.xlsx",
        sourceBatchNo: "audit-20260418-013",
        status: "failed",
        requestedBy: "user-001",
        totalItemCount: 2,
        importedItemCount: 0,
        memoryItemCount: 0,
        failedItemCount: 2,
        latestJobId: "background-job-013",
        latestErrorMessage: "runtime unavailable",
        failureDetails: ["runtime unavailable"],
        retryCount: 0,
        retryLimit: 3,
        canRetry: true,
        metadata: {
          retryHistory: [],
          failedItems: [
            {
              lineNo: 4,
              reasonCode: "missing_field",
              reasonLabel: "缺少必填字段",
              errorMessage: "缺少工程量",
              projectId: "project-001",
              resourceType: "bill_item",
              action: "create",
              keys: ["projectId", "resourceType", "action", "name"],
              retryEventSnapshot: null,
            },
          ],
          failureSnapshots: [
            {
              lineNo: 4,
              reasonCode: "missing_field",
              resourceType: "bill_item",
              action: "create",
              retryEventSnapshot: {
                projectId: "project-001",
                resourceType: "bill_item",
                action: "create",
                name: "某清单项",
              },
            },
          ],
        },
        createdAt: "2026-04-18T10:00:00.000Z",
        completedAt: "2026-04-18T10:05:00.000Z",
      },
    ]),
  });
  const ownerToken = await signAccessToken(
    {
      sub: "user-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const retryResponse = await app.inject({
    method: "POST",
    url: "/v1/jobs/background-job-013/retry",
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
    payload: {
      failureReason: "missing_field",
      failureResourceType: "bill_item",
      failureAction: "create",
    },
  });

  assert.equal(retryResponse.statusCode, 200);
  assert.deepEqual(retryResponse.json().payload.retryEvents, [
    {
      projectId: "project-001",
      resourceType: "bill_item",
      action: "create",
      name: "某清单项",
    },
  ]);

  await app.close();
});

test("GET /v1/me rejects requests without a bearer token", async () => {
  const app = createApp({ jwtSecret });

  const response = await app.inject({
    method: "GET",
    url: "/v1/me",
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), {
    error: {
      code: "UNAUTHENTICATED",
      message: "Missing bearer token",
    },
  });

  await app.close();
});

test("GET /v1/me returns the authenticated user from a verified JWT", async () => {
  const app = createApp({ jwtSecret });
  const token = await signAccessToken(
    {
      sub: "user-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url: "/v1/me",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    id: "user-001",
    displayName: "Owner User",
    roleCodes: ["project_owner"],
  });

  await app.close();
});

test("POST /v1/ai-runtime/extract-preview proxies structured extraction for allowed roles", async () => {
  const app = createApp({
    jwtSecret,
    aiRuntimePreviewService: {
      processEventBatch: async () => ({
        runtime: "saas-pricing-ai-runtime:knowledge-memory-agent-runtime",
        result: {
          summary: {
            knowledgeCount: 1,
          },
        },
      }),
    } as never,
  });
  const token = await signAccessToken(
    {
      sub: "user-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "POST",
    url: "/v1/ai-runtime/extract-preview",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      source: "audit_log",
      events: [
        {
          projectId: "project-001",
          resourceType: "review_submission",
          action: "reject",
        },
      ],
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    runtime: "saas-pricing-ai-runtime:knowledge-memory-agent-runtime",
    result: {
      summary: {
        knowledgeCount: 1,
      },
    },
  });

  await app.close();
});

test("POST /v1/ai-runtime/extract-preview rejects disallowed roles", async () => {
  const app = createApp({ jwtSecret });
  const token = await signAccessToken(
    {
      sub: "user-003",
      roleCodes: ["reviewer"],
      displayName: "Reviewer User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "POST",
    url: "/v1/ai-runtime/extract-preview",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      source: "audit_log",
      events: [],
    },
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error.code, "FORBIDDEN");

  await app.close();
});

test("POST /v1/ai-runtime/extract-jobs enqueues knowledge extraction jobs for allowed roles", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectStageRepository: new InMemoryProjectStageRepository(seededStages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      seededDisciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
  });
  const token = await signAccessToken(
    {
      sub: "user-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "POST",
    url: "/v1/ai-runtime/extract-jobs",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      projectId: "project-001",
      source: "audit_log",
      events: [
        {
          projectId: "project-001",
          resourceType: "review_submission",
          action: "reject",
        },
      ],
    },
  });

  assert.equal(response.statusCode, 202);
  assert.equal(response.json().task.projectId, "project-001");
  assert.equal(response.json().task.sourceType, "audit_log");
  assert.equal(response.json().task.totalItemCount, 1);
  assert.equal(response.json().job.jobType, "knowledge_extraction");
  assert.equal(response.json().job.projectId, "project-001");
  assert.equal(response.json().job.payload.source, "audit_log");
  assert.equal(
    response.json().job.payload.importTaskId,
    response.json().task.id,
  );

  await app.close();
});

test("POST /v1/projects/:projectId/ai-runtime/extract-from-audit enqueues knowledge extraction job from filtered audit logs", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectStageRepository: new InMemoryProjectStageRepository(seededStages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      seededDisciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
    auditLogRepository: new InMemoryAuditLogRepository(seededAuditLogs),
    backgroundJobRepository: new InMemoryBackgroundJobRepository([]),
  });
  const token = await signAccessToken(
    {
      sub: "user-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/ai-runtime/extract-from-audit",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      source: "audit_log",
      resourceType: "bill_version",
      action: "submit",
      limit: 2,
    },
  });

  assert.equal(response.statusCode, 202);
  assert.equal(response.json().task.projectId, "project-001");
  assert.equal(response.json().task.sourceLabel, "审计日志筛选导入");
  assert.equal(response.json().job.jobType, "knowledge_extraction");
  assert.equal(response.json().job.projectId, "project-001");
  assert.equal(response.json().source, "audit_log");
  assert.equal(response.json().eventCount, 2);
  assert.deepEqual(response.json().job.payload, {
    projectId: "project-001",
    source: "audit_log",
    sourceLabel: "审计日志筛选导入",
    importTaskId: response.json().task.id,
    events: [
      {
        id: "audit-log-003",
        projectId: "project-001",
        stageCode: "budget",
        resourceType: "bill_version",
        resourceId: "bill-version-002",
        action: "submit",
        operatorId: "user-002",
        beforePayload: {
          status: "editable",
        },
        afterPayload: {
          status: "submitted",
        },
        createdAt: "2026-04-18T12:00:00.000Z",
      },
      {
        id: "audit-log-002",
        projectId: "project-001",
        stageCode: "estimate",
        resourceType: "bill_version",
        resourceId: "bill-version-001",
        action: "submit",
        operatorId: "user-002",
        beforePayload: {
          status: "editable",
        },
        afterPayload: {
          status: "submitted",
        },
        createdAt: "2026-04-18T11:00:00.000Z",
      },
    ],
  });

  await app.close();
});

test("GET /v1/projects/:projectId/import-tasks returns structured import task semantics", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectStageRepository: new InMemoryProjectStageRepository(seededStages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      seededDisciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
    importTaskRepository: new InMemoryImportTaskRepository(seededImportTasks),
  });
  const token = await signAccessToken(
    {
      sub: "user-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/import-tasks",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().summary.totalCount, 3);
  assert.equal(response.json().items[2].sourceFileName, "estimate-v1.xlsx");
  assert.equal(response.json().items[2].sourceBatchNo, "upload-20260418-001");
  assert.deepEqual(response.json().items[2].failureDetails, [
    "解析失败",
    "第 4 行缺少工程量",
  ]);
  assert.deepEqual(response.json().items[2].metadata.failedItems, [
    {
      lineNo: 4,
      reasonCode: "missing_field",
      reasonLabel: "缺少必填字段",
      errorMessage: "缺少工程量",
      projectId: "project-001",
      resourceType: "bill_item",
      action: "create",
      keys: ["projectId", "resourceType", "action", "name"],
      retryEventSnapshot: {
        projectId: "project-001",
        resourceType: "bill_item",
        action: "create",
        name: "某清单项",
      },
    },
    {
      lineNo: 5,
      reasonCode: "parse_error",
      reasonLabel: "解析失败",
      errorMessage: "金额字段不是合法数字",
      projectId: "project-001",
      resourceType: "bill_item",
      action: "update",
      keys: ["projectId", "resourceType", "action", "amount"],
      retryEventSnapshot: {
        projectId: "project-001",
        resourceType: "bill_item",
        action: "update",
        amount: "not-a-number",
      },
    },
  ]);
  assert.deepEqual(response.json().items[2].metadata.failureSnapshots, [
    {
      lineNo: 4,
      reasonCode: "missing_field",
      resourceType: "bill_item",
      action: "create",
      retryEventSnapshot: {
        projectId: "project-001",
        resourceType: "bill_item",
        action: "create",
        name: "某清单项",
      },
    },
    {
      lineNo: 5,
      reasonCode: "parse_error",
      resourceType: "bill_item",
      action: "update",
      retryEventSnapshot: {
        projectId: "project-001",
        resourceType: "bill_item",
        action: "update",
        amount: "not-a-number",
      },
    },
  ]);
  assert.equal(response.json().items[2].retryCount, 2);
  assert.equal(response.json().items[2].retryLimit, 3);
  assert.equal(response.json().items[2].canRetry, true);

  await app.close();
});

test("GET /v1/projects/:projectId/import-tasks/:taskId/error-report downloads failed item report", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectStageRepository: new InMemoryProjectStageRepository(seededStages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      seededDisciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
    importTaskRepository: new InMemoryImportTaskRepository(seededImportTasks),
  });
  const token = await signAccessToken(
    {
      sub: "user-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/import-tasks/import-task-003/error-report",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["content-type"], "application/json; charset=utf-8");
  assert.match(
    response.headers["content-disposition"] ?? "",
    /attachment; filename="import-task-003-error-report-all-failed-items\.json"/,
  );
  assert.match(response.body, /"reasonCode": "missing_field"/);
  assert.match(response.body, /"errorMessage": "缺少工程量"/);
  assert.match(response.body, /"reasonCode": "parse_error"/);

  await app.close();
});

test("GET /v1/projects/:projectId/import-tasks/:taskId/error-report supports failureReason filtering", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectStageRepository: new InMemoryProjectStageRepository(seededStages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      seededDisciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
    importTaskRepository: new InMemoryImportTaskRepository(seededImportTasks),
  });
  const token = await signAccessToken(
    {
      sub: "user-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/import-tasks/import-task-003/error-report?failureReason=parse_error",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.match(
    response.headers["content-disposition"] ?? "",
    /attachment; filename="import-task-003-error-report-current-filter-parse_error\.json"/,
  );
  assert.doesNotMatch(response.body, /"reasonCode": "missing_field"/);
  assert.match(response.body, /"reasonCode": "parse_error"/);
  assert.match(response.body, /"failedItemCount": 1/);

  await app.close();
});

test("GET /v1/projects/:projectId/import-tasks/:taskId/error-report supports csv export", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectStageRepository: new InMemoryProjectStageRepository(seededStages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      seededDisciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
    importTaskRepository: new InMemoryImportTaskRepository(seededImportTasks),
  });
  const token = await signAccessToken(
    {
      sub: "user-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/import-tasks/import-task-003/error-report?failureReason=parse_error&format=csv",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["content-type"], "text/csv; charset=utf-8");
  assert.match(
    response.headers["content-disposition"] ?? "",
    /attachment; filename="import-task-003-error-report-current-filter-parse_error\.csv"/,
  );
  assert.match(response.body, /lineNo,reasonCode,reasonLabel,errorMessage,projectId,resourceType,action,keys/);
  assert.match(response.body, /5,parse_error,解析失败,金额字段不是合法数字,project-001,bill_item,update,projectId\|resourceType\|action\|amount/);

  await app.close();
});

test("POST /v1/projects/:projectId/import-tasks/upload creates import batch from uploaded json file", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectStageRepository: new InMemoryProjectStageRepository(seededStages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      seededDisciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
  });
  const token = await signAccessToken(
    {
      sub: "user-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/import-tasks/upload",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      fileName: "audit-events.json",
      fileContent: JSON.stringify([
        {
          projectId: "project-001",
          resourceType: "review_submission",
          action: "reject",
        },
      ]),
      sourceType: "file_upload",
    },
  });

  assert.equal(response.statusCode, 202);
  assert.equal(response.json().uploadedFileName, "audit-events.json");
  assert.equal(response.json().eventCount, 1);
  assert.equal(response.json().detectedFormat, "json_array");
  assert.equal(response.json().task.sourceFileName, "audit-events.json");
  assert.match(response.json().task.sourceBatchNo, /^upload-\d{14}$/);
  assert.equal(response.json().job.payload.importTaskId, response.json().task.id);
  assert.deepEqual(response.json().task.metadata.parseSummary, {
    totalEventCount: 1,
    fieldKeys: ["projectId", "resourceType", "action"],
    resourceTypes: ["review_submission"],
    actions: ["reject"],
    missingProjectIdCount: 0,
    missingActionCount: 0,
  });
  assert.deepEqual(response.json().task.metadata.previewItems, [
    {
      lineNo: 1,
      projectId: "project-001",
      resourceType: "review_submission",
      action: "reject",
      keys: ["projectId", "resourceType", "action"],
    },
  ]);
  assert.deepEqual(response.json().task.metadata.retryHistory, []);

  await app.close();
});

test("POST /v1/projects/:projectId/import-tasks/upload records failed items and only enqueues valid events", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectStageRepository: new InMemoryProjectStageRepository(seededStages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      seededDisciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
  });
  const token = await signAccessToken(
    {
      sub: "user-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/import-tasks/upload",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      fileName: "audit-events.ndjson",
      fileContent: [
        JSON.stringify({
          projectId: "project-001",
          resourceType: "review_submission",
          action: "reject",
        }),
        JSON.stringify({
          projectId: "project-001",
          resourceType: "review_submission",
        }),
        "{\"projectId\":\"project-001\",bad json}",
        JSON.stringify({
          projectId: "project-001",
          resourceType: "bill_item",
          action: "update",
          amount: "oops",
        }),
      ].join("\n"),
      sourceType: "file_upload",
    },
  });

  assert.equal(response.statusCode, 202);
  assert.equal(response.json().eventCount, 4);
  assert.equal(response.json().acceptedEventCount, 1);
  assert.equal(response.json().task.totalItemCount, 4);
  assert.equal(response.json().task.failedItemCount, 3);
  assert.deepEqual(response.json().job.payload.events, [
    {
      projectId: "project-001",
      resourceType: "review_submission",
      action: "reject",
    },
  ]);
  assert.deepEqual(response.json().task.metadata.failureSummary, [
    {
      reasonCode: "missing_field",
      reasonLabel: "缺少必填字段",
      count: 1,
    },
    {
      reasonCode: "parse_error",
      reasonLabel: "解析失败",
      count: 1,
    },
    {
      reasonCode: "invalid_value",
      reasonLabel: "字段值非法",
      count: 1,
    },
  ]);
  assert.deepEqual(response.json().task.metadata.failedItems, [
    {
      lineNo: 2,
      reasonCode: "missing_field",
      reasonLabel: "缺少必填字段",
      errorMessage: "缺少 action",
      projectId: "project-001",
      resourceType: "review_submission",
      action: null,
      keys: ["projectId", "resourceType"],
      retryEventSnapshot: {
        projectId: "project-001",
        resourceType: "review_submission",
      },
    },
    {
      lineNo: 3,
      reasonCode: "parse_error",
      reasonLabel: "解析失败",
      errorMessage: "第 3 行不是合法 JSON",
      projectId: null,
      resourceType: null,
      action: null,
      keys: [],
      retryEventSnapshot: null,
    },
    {
      lineNo: 4,
      reasonCode: "invalid_value",
      reasonLabel: "字段值非法",
      errorMessage: "amount 必须是数字",
      projectId: "project-001",
      resourceType: "bill_item",
      action: "update",
      keys: ["projectId", "resourceType", "action", "amount"],
      retryEventSnapshot: {
        projectId: "project-001",
        resourceType: "bill_item",
        action: "update",
        amount: "oops",
      },
    },
  ]);

  await app.close();
});

test("GET /v1/projects/:projectId/knowledge-entries and /memory-entries expose persisted extraction results", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectStageRepository: new InMemoryProjectStageRepository(seededStages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      seededDisciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
    aiRuntimePreviewService: {
      processEventBatch: async () => ({
        runtime: "saas-pricing-ai-runtime:knowledge-memory-agent-runtime",
        source: "review_submission",
        result: {
          knowledgeCandidates: [
            {
              title: "review_reject",
              summary: "Unit price basis is incomplete",
              source_type: "review_submission",
              source_action: "reject",
              project_id: "project-001",
              stage_code: "estimate",
              tags: ["review", "reject"],
              metadata: {
                billVersionId: "bill-version-001",
              },
            },
          ],
          memoryCandidates: [
            {
              memory_key: "project-001:reviewer-001:review_submission:reject",
              subject_type: "user",
              subject_id: "reviewer-001",
              content:
                "review_submission:reject (reason=Unit price basis is incomplete)",
              project_id: "project-001",
              stage_code: "estimate",
              metadata: {
                resourceType: "review_submission",
                action: "reject",
                resourceId: "review-001",
              },
            },
          ],
          summary: {
            knowledgeCount: 1,
            memoryCount: 1,
          },
        },
      }),
    } as never,
  });
  const ownerToken = await signAccessToken(
    {
      sub: "user-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const enqueueResponse = await app.inject({
    method: "POST",
    url: "/v1/ai-runtime/extract-jobs",
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
    payload: {
      projectId: "project-001",
      source: "review_submission",
      events: [
        {
          projectId: "project-001",
          stageCode: "estimate",
          resourceType: "review_submission",
          resourceId: "review-001",
          action: "reject",
          operatorId: "reviewer-001",
          afterPayload: {
            billVersionId: "bill-version-001",
            reason: "Unit price basis is incomplete",
          },
        },
      ],
    },
  });

  const jobId = enqueueResponse.json().job.id as string;

  const processResponse = await app.inject({
    method: "POST",
    url: `/v1/jobs/${jobId}/process`,
    headers: {
      authorization: `Bearer ${await signAccessToken(
        {
          sub: "admin-001",
          roleCodes: ["system_admin"],
          displayName: "System Admin",
        },
        jwtSecret,
      )}`,
    },
  });

  assert.equal(processResponse.statusCode, 200);

  const knowledgeResponse = await app.inject({
    method: "GET",
    url: `/v1/projects/project-001/knowledge-entries?sourceJobId=${jobId}`,
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
  });
  const memoryResponse = await app.inject({
    method: "GET",
    url: `/v1/projects/project-001/memory-entries?sourceJobId=${jobId}`,
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
  });

  assert.equal(knowledgeResponse.statusCode, 200);
  assert.equal(memoryResponse.statusCode, 200);
  assert.equal(knowledgeResponse.json().items.length, 1);
  assert.equal(memoryResponse.json().items.length, 1);
  assert.equal(knowledgeResponse.json().items[0].sourceJobId, jobId);
  assert.equal(knowledgeResponse.json().items[0].sourceType, "review_submission");
  assert.equal(memoryResponse.json().items[0].sourceJobId, jobId);
  assert.equal(memoryResponse.json().items[0].subjectId, "reviewer-001");

  await app.close();
});

test("GET /v1/projects normalizes pagination when auth is valid", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
  });
  const token = await signAccessToken(
    {
      sub: "user-002",
      roleCodes: ["cost_engineer"],
      displayName: "Cost Engineer",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url: "/v1/projects?page=2&pageSize=20",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    items: [],
    pagination: {
      page: 2,
      pageSize: 20,
      total: 1,
    },
  });

  await app.close();
});

test("GET /v1/projects rejects invalid pagination with a structured validation error", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
  });
  const token = await signAccessToken(
    {
      sub: "user-003",
      roleCodes: ["cost_engineer"],
      displayName: "Bad Pagination User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url: "/v1/projects?page=0&pageSize=1000",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
      details: [
        {
          field: "page",
          message: "Too small: expected number to be >=1",
        },
        {
          field: "pageSize",
          message: "Too big: expected number to be <=200",
        },
      ],
    },
  });

  await app.close();
});

test("GET /v1/projects/:id returns the requested project", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
  });
  const token = await signAccessToken(
    {
      sub: "user-001",
      roleCodes: ["project_owner"],
      displayName: "Project Owner",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), seededProjects[0]);

  await app.close();
});

test("GET /v1/projects/:id rejects non-members", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
    projectMemberRepository: new InMemoryProjectMemberRepository(seededMembers),
  });
  const token = await signAccessToken(
    {
      sub: "user-999",
      roleCodes: ["cost_engineer"],
      displayName: "Outside User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error.code, "FORBIDDEN");

  await app.close();
});

test("GET /v1/projects/:id returns a structured 404 when the project does not exist", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(seededProjects),
  });
  const token = await signAccessToken(
    {
      sub: "user-005",
      roleCodes: ["project_owner"],
      displayName: "Missing Project User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url: "/v1/projects/project-404",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), {
    error: {
      code: "PROJECT_NOT_FOUND",
      message: "Project not found",
    },
  });

  await app.close();
});
