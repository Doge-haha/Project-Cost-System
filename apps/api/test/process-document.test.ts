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
import { InMemoryProcessDocumentRepository } from "../src/modules/process/process-document-repository.js";

const jwtSecret = "process-document-test-secret";

const projects: ProjectRecord[] = [
  {
    id: "project-001",
    code: "PRJ-001",
    name: "新点 SaaS 计价一期",
    status: "draft",
  },
];

const stages: ProjectStageRecord[] = [
  {
    id: "stage-001",
    projectId: "project-001",
    stageCode: "estimate",
    stageName: "投资估算",
    status: "draft",
    sequenceNo: 1,
  },
];

const disciplines: ProjectDisciplineRecord[] = [
  {
    id: "discipline-001",
    projectId: "project-001",
    disciplineCode: "building",
    disciplineName: "建筑工程",
    defaultStandardSetCode: "js-2013-building",
    status: "enabled",
  },
];

const members: ProjectMemberRecord[] = [
  {
    id: "member-001",
    projectId: "project-001",
    userId: "engineer-001",
    displayName: "Cost Engineer",
    roleCode: "cost_engineer",
    scopes: [
      { scopeType: "stage", scopeValue: "estimate" },
      { scopeType: "discipline", scopeValue: "building" },
    ],
  },
  {
    id: "member-002",
    projectId: "project-001",
    userId: "reviewer-001",
    displayName: "Reviewer",
    roleCode: "reviewer",
    scopes: [
      { scopeType: "stage", scopeValue: "estimate" },
      { scopeType: "discipline", scopeValue: "building" },
    ],
  },
];

function createProcessDocumentApp() {
  return createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(projects),
    projectStageRepository: new InMemoryProjectStageRepository(stages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      disciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(members),
    processDocumentRepository: new InMemoryProcessDocumentRepository([]),
  });
}

test("POST /v1/projects/:id/process-documents creates a draft process document", async () => {
  const app = createProcessDocumentApp();
  const token = await signAccessToken(
    {
      sub: "engineer-001",
      roleCodes: ["cost_engineer"],
      displayName: "Cost Engineer",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/process-documents",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      stageCode: "estimate",
      disciplineCode: "building",
      documentType: "change_order",
      title: "设计变更单 001",
      referenceNo: "CO-001",
      amount: 120000,
    },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().status, "draft");
  assert.equal(response.json().documentType, "change_order");

  await app.close();
});

test("GET /v1/projects/:id/process-documents filters by context", async () => {
  const app = createProcessDocumentApp();
  const token = await signAccessToken(
    {
      sub: "engineer-001",
      roleCodes: ["cost_engineer"],
      displayName: "Cost Engineer",
    },
    jwtSecret,
  );

  await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/process-documents",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      stageCode: "estimate",
      disciplineCode: "building",
      documentType: "site_visa",
      title: "现场签证单 001",
      referenceNo: "SV-001",
      amount: 30000,
    },
  });

  const response = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/process-documents?stageCode=estimate&disciplineCode=building&documentType=site_visa",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().items.length, 1);
  assert.equal(response.json().items[0].documentType, "site_visa");

  await app.close();
});

test("GET /v1/projects/:id/process-documents supports status filtering and returns summary flags", async () => {
  const app = createProcessDocumentApp();
  const engineerToken = await signAccessToken(
    {
      sub: "engineer-001",
      roleCodes: ["cost_engineer"],
      displayName: "Cost Engineer",
    },
    jwtSecret,
  );
  const reviewerToken = await signAccessToken(
    {
      sub: "reviewer-001",
      roleCodes: ["reviewer"],
      displayName: "Reviewer",
    },
    jwtSecret,
  );

  const draftResponse = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/process-documents",
    headers: {
      authorization: `Bearer ${engineerToken}`,
    },
    payload: {
      stageCode: "estimate",
      disciplineCode: "building",
      documentType: "site_visa",
      title: "现场签证单 001",
      referenceNo: "SV-001",
      amount: 30000,
    },
  });

  const submittedResponse = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/process-documents",
    headers: {
      authorization: `Bearer ${engineerToken}`,
    },
    payload: {
      stageCode: "estimate",
      disciplineCode: "building",
      documentType: "change_order",
      title: "设计变更单 002",
      referenceNo: "CO-002",
      amount: 58000,
    },
  });

  await app.inject({
    method: "PUT",
    url: `/v1/projects/project-001/process-documents/${submittedResponse.json().id}/status`,
    headers: {
      authorization: `Bearer ${engineerToken}`,
    },
    payload: {
      status: "submitted",
    },
  });

  const engineerListResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/process-documents?status=submitted",
    headers: {
      authorization: `Bearer ${engineerToken}`,
    },
  });

  assert.equal(engineerListResponse.statusCode, 200);
  assert.equal(engineerListResponse.json().items.length, 1);
  assert.equal(engineerListResponse.json().summary.totalCount, 1);
  assert.equal(engineerListResponse.json().summary.statusCounts.submitted, 1);
  assert.equal(engineerListResponse.json().summary.documentTypeCounts.change_order, 1);
  assert.equal(engineerListResponse.json().items[0].id, submittedResponse.json().id);
  assert.equal(engineerListResponse.json().items[0].stageName, "投资估算");
  assert.equal(engineerListResponse.json().items[0].disciplineName, "建筑工程");
  assert.equal(engineerListResponse.json().items[0].isEditable, false);
  assert.equal(engineerListResponse.json().items[0].isReviewable, false);

  const reviewerListResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/process-documents?status=submitted",
    headers: {
      authorization: `Bearer ${reviewerToken}`,
    },
  });

  assert.equal(reviewerListResponse.statusCode, 200);
  assert.equal(reviewerListResponse.json().items.length, 1);
  assert.equal(reviewerListResponse.json().items[0].id, submittedResponse.json().id);
  assert.equal(reviewerListResponse.json().items[0].isEditable, false);
  assert.equal(reviewerListResponse.json().items[0].isReviewable, true);

  const draftListResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/process-documents?status=draft",
    headers: {
      authorization: `Bearer ${engineerToken}`,
    },
  });

  assert.equal(draftListResponse.statusCode, 200);
  assert.equal(draftListResponse.json().items.length, 1);
  assert.equal(draftListResponse.json().summary.totalCount, 1);
  assert.equal(draftListResponse.json().summary.statusCounts.draft, 1);
  assert.equal(draftListResponse.json().items[0].id, draftResponse.json().id);
  assert.equal(draftListResponse.json().items[0].isEditable, true);
  assert.equal(draftListResponse.json().items[0].isReviewable, false);

  await app.close();
});

test("GET /v1/projects/:id/process-documents sorts submitted documents before draft and newest first within status", async () => {
  const app = createProcessDocumentApp();
  const engineerToken = await signAccessToken(
    {
      sub: "engineer-001",
      roleCodes: ["cost_engineer"],
      displayName: "Cost Engineer",
    },
    jwtSecret,
  );

  const firstDraft = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/process-documents",
    headers: {
      authorization: `Bearer ${engineerToken}`,
    },
    payload: {
      stageCode: "estimate",
      disciplineCode: "building",
      documentType: "site_visa",
      title: "现场签证单 001",
      referenceNo: "SV-001",
      amount: 30000,
    },
  });
  const secondDraft = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/process-documents",
    headers: {
      authorization: `Bearer ${engineerToken}`,
    },
    payload: {
      stageCode: "estimate",
      disciplineCode: "building",
      documentType: "change_order",
      title: "设计变更单 002",
      referenceNo: "CO-002",
      amount: 58000,
    },
  });

  await app.inject({
    method: "PUT",
    url: `/v1/projects/project-001/process-documents/${secondDraft.json().id}/status`,
    headers: {
      authorization: `Bearer ${engineerToken}`,
    },
    payload: {
      status: "submitted",
    },
  });

  const response = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/process-documents",
    headers: {
      authorization: `Bearer ${engineerToken}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().items.length, 2);
  assert.equal(response.json().items[0].id, secondDraft.json().id);
  assert.equal(response.json().items[0].status, "submitted");
  assert.equal(response.json().items[1].id, firstDraft.json().id);
  assert.equal(response.json().items[1].status, "draft");

  await app.close();
});

test("PUT /v1/projects/:id/process-documents/:documentId/status rejects duplicate submitted process documents for the same reference", async () => {
  const app = createProcessDocumentApp();
  const token = await signAccessToken(
    {
      sub: "engineer-001",
      roleCodes: ["cost_engineer"],
      displayName: "Cost Engineer",
    },
    jwtSecret,
  );

  const firstDraft = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/process-documents",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      stageCode: "estimate",
      disciplineCode: "building",
      documentType: "change_order",
      title: "设计变更单 001",
      referenceNo: "CO-DUP",
      amount: 120000,
    },
  });
  const secondDraft = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/process-documents",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      stageCode: "estimate",
      disciplineCode: "building",
      documentType: "change_order",
      title: "设计变更单 001 修订",
      referenceNo: "CO-DUP",
      amount: 130000,
    },
  });

  const firstSubmit = await app.inject({
    method: "PUT",
    url: `/v1/projects/project-001/process-documents/${firstDraft.json().id}/status`,
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      status: "submitted",
    },
  });
  const duplicateSubmit = await app.inject({
    method: "PUT",
    url: `/v1/projects/project-001/process-documents/${secondDraft.json().id}/status`,
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      status: "submitted",
    },
  });

  assert.equal(firstSubmit.statusCode, 200);
  assert.equal(duplicateSubmit.statusCode, 422);
  assert.equal(duplicateSubmit.json().error.code, "VALIDATION_ERROR");

  await app.close();
});

test("PUT /v1/projects/:id/process-documents/:documentId updates a draft process document", async () => {
  const app = createProcessDocumentApp();
  const token = await signAccessToken(
    {
      sub: "engineer-001",
      roleCodes: ["cost_engineer"],
      displayName: "Cost Engineer",
    },
    jwtSecret,
  );

  const createResponse = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/process-documents",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      stageCode: "estimate",
      disciplineCode: "building",
      documentType: "change_order",
      title: "设计变更单 001",
      referenceNo: "CO-001",
      amount: 120000,
    },
  });

  const updateResponse = await app.inject({
    method: "PUT",
    url: `/v1/projects/project-001/process-documents/${createResponse.json().id}`,
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      title: "设计变更单 001-修订",
      referenceNo: "CO-001A",
      amount: 126000,
      comment: "补充土方量",
    },
  });

  assert.equal(updateResponse.statusCode, 200);
  assert.equal(updateResponse.json().title, "设计变更单 001-修订");
  assert.equal(updateResponse.json().referenceNo, "CO-001A");
  assert.equal(updateResponse.json().amount, 126000);
  assert.equal(updateResponse.json().lastComment, "补充土方量");

  const auditResponse = await app.inject({
    method: "GET",
    url: `/v1/projects/project-001/audit-logs?resourceType=process_document&resourceId=${createResponse.json().id}&action=update`,
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(auditResponse.statusCode, 200);
  assert.equal(auditResponse.json().items.length, 1);
  assert.equal(auditResponse.json().items[0].beforePayload.title, "设计变更单 001");
  assert.equal(auditResponse.json().items[0].afterPayload.title, "设计变更单 001-修订");

  await app.close();
});

test("DELETE /v1/projects/:id/process-documents/:documentId deletes a draft process document", async () => {
  const app = createProcessDocumentApp();
  const token = await signAccessToken(
    {
      sub: "engineer-001",
      roleCodes: ["cost_engineer"],
      displayName: "Cost Engineer",
    },
    jwtSecret,
  );

  const createResponse = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/process-documents",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      stageCode: "estimate",
      disciplineCode: "building",
      documentType: "site_visa",
      title: "现场签证单 001",
      referenceNo: "SV-001",
      amount: 30000,
    },
  });

  const deleteResponse = await app.inject({
    method: "DELETE",
    url: `/v1/projects/project-001/process-documents/${createResponse.json().id}`,
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(deleteResponse.statusCode, 204);

  const listResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/process-documents",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.json().items.length, 0);

  const auditResponse = await app.inject({
    method: "GET",
    url: `/v1/projects/project-001/audit-logs?resourceType=process_document&resourceId=${createResponse.json().id}&action=delete`,
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(auditResponse.statusCode, 200);
  assert.equal(auditResponse.json().items.length, 1);
  assert.equal(auditResponse.json().items[0].beforePayload.status, "draft");

  await app.close();
});

test("PUT /v1/projects/:id/process-documents/:documentId/status allows reviewer approval", async () => {
  const app = createProcessDocumentApp();
  const engineerToken = await signAccessToken(
    {
      sub: "engineer-001",
      roleCodes: ["cost_engineer"],
      displayName: "Cost Engineer",
    },
    jwtSecret,
  );
  const reviewerToken = await signAccessToken(
    {
      sub: "reviewer-001",
      roleCodes: ["reviewer"],
      displayName: "Reviewer",
    },
    jwtSecret,
  );

  const createResponse = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/process-documents",
    headers: {
      authorization: `Bearer ${engineerToken}`,
    },
    payload: {
      stageCode: "estimate",
      disciplineCode: "building",
      documentType: "progress_payment",
      title: "进度款申报 001",
      referenceNo: "PP-001",
      amount: 80000,
    },
  });

  const documentId = createResponse.json().id as string;

  await app.inject({
    method: "PUT",
    url: `/v1/projects/project-001/process-documents/${documentId}/status`,
    headers: {
      authorization: `Bearer ${engineerToken}`,
    },
    payload: {
      status: "submitted",
    },
  });

  const approveResponse = await app.inject({
    method: "PUT",
    url: `/v1/projects/project-001/process-documents/${documentId}/status`,
    headers: {
      authorization: `Bearer ${reviewerToken}`,
    },
    payload: {
      status: "approved",
      comment: "审核通过",
    },
  });

  assert.equal(approveResponse.statusCode, 200);
  assert.equal(approveResponse.json().status, "approved");
  assert.equal(approveResponse.json().lastComment, "审核通过");

  const auditResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/audit-logs?resourceType=process_document",
    headers: {
      authorization: `Bearer ${reviewerToken}`,
    },
  });

  assert.equal(auditResponse.statusCode, 200);
  assert.equal(auditResponse.json().items.length, 3);
  assert.equal(auditResponse.json().items[0].action, "approved");
  assert.equal(auditResponse.json().items[1].action, "submitted");
  assert.equal(auditResponse.json().items[2].action, "create");

  await app.close();
});

test("PUT /v1/projects/:id/process-documents/:documentId rejects updating a submitted process document", async () => {
  const app = createProcessDocumentApp();
  const token = await signAccessToken(
    {
      sub: "engineer-001",
      roleCodes: ["cost_engineer"],
      displayName: "Cost Engineer",
    },
    jwtSecret,
  );

  const createResponse = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/process-documents",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      stageCode: "estimate",
      disciplineCode: "building",
      documentType: "change_order",
      title: "设计变更单 002",
      referenceNo: "CO-002",
      amount: 50000,
    },
  });

  await app.inject({
    method: "PUT",
    url: `/v1/projects/project-001/process-documents/${createResponse.json().id}/status`,
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      status: "submitted",
    },
  });

  const updateResponse = await app.inject({
    method: "PUT",
    url: `/v1/projects/project-001/process-documents/${createResponse.json().id}`,
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      title: "不允许修改",
      referenceNo: "CO-002A",
      amount: 52000,
    },
  });

  assert.equal(updateResponse.statusCode, 422);
  assert.equal(updateResponse.json().error.code, "VALIDATION_ERROR");

  await app.close();
});

test("PUT /v1/projects/:id/process-documents/:documentId/status rejects approval before submission", async () => {
  const app = createProcessDocumentApp();
  const engineerToken = await signAccessToken(
    {
      sub: "engineer-001",
      roleCodes: ["cost_engineer"],
      displayName: "Cost Engineer",
    },
    jwtSecret,
  );
  const reviewerToken = await signAccessToken(
    {
      sub: "reviewer-001",
      roleCodes: ["reviewer"],
      displayName: "Reviewer",
    },
    jwtSecret,
  );

  const createResponse = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/process-documents",
    headers: {
      authorization: `Bearer ${engineerToken}`,
    },
    payload: {
      stageCode: "estimate",
      disciplineCode: "building",
      documentType: "change_order",
      title: "设计变更单 002",
      referenceNo: "CO-002",
      amount: 50000,
    },
  });

  const approveResponse = await app.inject({
    method: "PUT",
    url: `/v1/projects/project-001/process-documents/${createResponse.json().id}/status`,
    headers: {
      authorization: `Bearer ${reviewerToken}`,
    },
    payload: {
      status: "approved",
    },
  });

  assert.equal(approveResponse.statusCode, 422);
  assert.equal(approveResponse.json().error.code, "VALIDATION_ERROR");

  await app.close();
});

test("PUT /v1/projects/:id/process-documents/:documentId/status rejects self-review", async () => {
  const app = createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(projects),
    projectStageRepository: new InMemoryProjectStageRepository(stages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      disciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository([
      {
        id: "member-owner-001",
        projectId: "project-001",
        userId: "owner-001",
        displayName: "Project Owner",
        roleCode: "project_owner",
        scopes: [{ scopeType: "project", scopeValue: "project-001" }],
      },
    ]),
    processDocumentRepository: new InMemoryProcessDocumentRepository([]),
  });
  const token = await signAccessToken(
    {
      sub: "owner-001",
      roleCodes: ["project_owner"],
      displayName: "Project Owner",
    },
    jwtSecret,
  );

  const createResponse = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/process-documents",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      stageCode: "estimate",
      disciplineCode: "building",
      documentType: "progress_payment",
      title: "进度款申报 002",
      referenceNo: "PP-002",
      amount: 90000,
    },
  });

  await app.inject({
    method: "PUT",
    url: `/v1/projects/project-001/process-documents/${createResponse.json().id}/status`,
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      status: "submitted",
    },
  });

  const approveResponse = await app.inject({
    method: "PUT",
    url: `/v1/projects/project-001/process-documents/${createResponse.json().id}/status`,
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      status: "approved",
    },
  });

  assert.equal(approveResponse.statusCode, 422);
  assert.equal(approveResponse.json().error.code, "VALIDATION_ERROR");

  await app.close();
});

test("PUT /v1/projects/:id/process-documents/:documentId/status allows submitter to reopen rejected process documents as draft", async () => {
  const app = createProcessDocumentApp();
  const engineerToken = await signAccessToken(
    {
      sub: "engineer-001",
      roleCodes: ["cost_engineer"],
      displayName: "Cost Engineer",
    },
    jwtSecret,
  );
  const reviewerToken = await signAccessToken(
    {
      sub: "reviewer-001",
      roleCodes: ["reviewer"],
      displayName: "Reviewer",
    },
    jwtSecret,
  );

  const createResponse = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/process-documents",
    headers: {
      authorization: `Bearer ${engineerToken}`,
    },
    payload: {
      stageCode: "estimate",
      disciplineCode: "building",
      documentType: "change_order",
      title: "设计变更单 003",
      referenceNo: "CO-003",
      amount: 76000,
    },
  });
  const documentId = createResponse.json().id;

  await app.inject({
    method: "PUT",
    url: `/v1/projects/project-001/process-documents/${documentId}/status`,
    headers: {
      authorization: `Bearer ${engineerToken}`,
    },
    payload: {
      status: "submitted",
    },
  });
  await app.inject({
    method: "PUT",
    url: `/v1/projects/project-001/process-documents/${documentId}/status`,
    headers: {
      authorization: `Bearer ${reviewerToken}`,
    },
    payload: {
      status: "rejected",
      comment: "金额依据不足",
    },
  });
  const rejectedListResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/process-documents?status=rejected",
    headers: {
      authorization: `Bearer ${engineerToken}`,
    },
  });

  const reopenResponse = await app.inject({
    method: "PUT",
    url: `/v1/projects/project-001/process-documents/${documentId}/status`,
    headers: {
      authorization: `Bearer ${engineerToken}`,
    },
    payload: {
      status: "draft",
      comment: "补充依据后重提",
    },
  });
  const updateResponse = await app.inject({
    method: "PUT",
    url: `/v1/projects/project-001/process-documents/${documentId}`,
    headers: {
      authorization: `Bearer ${engineerToken}`,
    },
    payload: {
      title: "设计变更单 003 修订",
      referenceNo: "CO-003",
      amount: 78000,
    },
  });

  assert.equal(rejectedListResponse.statusCode, 200);
  assert.equal(rejectedListResponse.json().items[0].isEditable, true);
  assert.equal(reopenResponse.statusCode, 200);
  assert.equal(reopenResponse.json().status, "draft");
  assert.equal(updateResponse.statusCode, 200);
  assert.equal(updateResponse.json().title, "设计变更单 003 修订");

  await app.close();
});
