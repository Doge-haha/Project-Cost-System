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
import { InMemoryReviewSubmissionRepository } from "../src/modules/review/review-submission-repository.js";

const jwtSecret = "review-submission-test-secret";

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

const billVersions: BillVersionRecord[] = [
  {
    id: "bill-version-001",
    projectId: "project-001",
    stageCode: "estimate",
    disciplineCode: "building",
    versionNo: 1,
    versionName: "估算版 V1",
    versionStatus: "submitted",
    sourceVersionId: null,
  },
];

function createReviewApp() {
  return createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(projects),
    projectStageRepository: new InMemoryProjectStageRepository(stages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(
      disciplines,
    ),
    projectMemberRepository: new InMemoryProjectMemberRepository(members),
    billVersionRepository: new InMemoryBillVersionRepository(billVersions),
    reviewSubmissionRepository: new InMemoryReviewSubmissionRepository([]),
  });
}

test("POST /v1/projects/:id/bill-versions/:versionId/reviews submits a pending review for a submitted version", async () => {
  const app = createReviewApp();
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
    url: "/v1/projects/project-001/bill-versions/bill-version-001/reviews",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      comment: "请审核当前估算版本",
    },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().status, "pending");
  assert.equal(response.json().billVersionId, "bill-version-001");

  await app.close();
});

test("POST /v1/projects/:id/reviews/:reviewSubmissionId/approve approves the review and locks the bill version", async () => {
  const app = createReviewApp();
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

  const submitResponse = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/bill-versions/bill-version-001/reviews",
    headers: {
      authorization: `Bearer ${engineerToken}`,
    },
  });
  const reviewSubmissionId = submitResponse.json().id as string;

  const approveResponse = await app.inject({
    method: "POST",
    url: `/v1/projects/project-001/reviews/${reviewSubmissionId}/approve`,
    headers: {
      authorization: `Bearer ${reviewerToken}`,
    },
    payload: {
      comment: "审核通过",
    },
  });

  assert.equal(approveResponse.statusCode, 200);
  assert.equal(approveResponse.json().status, "approved");
  assert.equal(approveResponse.json().reviewedBy, "reviewer-001");

  const versionsResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/bill-versions?stageCode=estimate&disciplineCode=building",
    headers: {
      authorization: `Bearer ${engineerToken}`,
    },
  });

  assert.equal(versionsResponse.statusCode, 200);
  assert.equal(versionsResponse.json().items[0].versionStatus, "locked");

  await app.close();
});

test("POST /v1/projects/:id/reviews/:reviewSubmissionId/reject rejects the review and reopens the bill version", async () => {
  const app = createReviewApp();
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

  const submitResponse = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/bill-versions/bill-version-001/reviews",
    headers: {
      authorization: `Bearer ${engineerToken}`,
    },
  });
  const reviewSubmissionId = submitResponse.json().id as string;

  const rejectResponse = await app.inject({
    method: "POST",
    url: `/v1/projects/project-001/reviews/${reviewSubmissionId}/reject`,
    headers: {
      authorization: `Bearer ${reviewerToken}`,
    },
    payload: {
      reason: "请补充清单说明",
      comment: "工作内容描述还不够完整",
    },
  });

  assert.equal(rejectResponse.statusCode, 200);
  assert.equal(rejectResponse.json().status, "rejected");
  assert.equal(rejectResponse.json().rejectionReason, "请补充清单说明");

  const versionsResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/bill-versions?stageCode=estimate&disciplineCode=building",
    headers: {
      authorization: `Bearer ${engineerToken}`,
    },
  });

  assert.equal(versionsResponse.statusCode, 200);
  assert.equal(versionsResponse.json().items[0].versionStatus, "editable");

  await app.close();
});
