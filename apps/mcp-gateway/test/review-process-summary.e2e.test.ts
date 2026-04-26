import test from "node:test";
import assert from "node:assert/strict";

import {
  InMemoryBillVersionRepository,
  type BillVersionRecord,
} from "../../api/src/modules/bill/bill-version-repository.js";
import {
  InMemoryReviewSubmissionRepository,
  type ReviewSubmissionRecord,
} from "../../api/src/modules/review/review-submission-repository.js";
import {
  InMemoryProcessDocumentRepository,
  type ProcessDocumentRecord,
} from "../../api/src/modules/process/process-document-repository.js";
import { createGatewayTestApp } from "./helpers/http-gateway-harness.js";
import {
  createGatewayTestApiApp,
  createGatewayTestTokenForUser,
  createGatewayTestToken,
} from "./helpers/project-seeds.js";

const seededBillVersions: BillVersionRecord[] = [
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

const seededReviewSubmissions: ReviewSubmissionRecord[] = [
  {
    id: "review-submission-001",
    projectId: "project-001",
    billVersionId: "bill-version-001",
    stageCode: "estimate",
    disciplineCode: "building",
    status: "pending",
    submittedBy: "user-002",
    submittedAt: "2026-04-24T10:00:00.000Z",
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
    submittedAt: "2026-04-23T10:00:00.000Z",
    submissionComment: "旧审核",
    reviewedBy: "user-001",
    reviewedAt: "2026-04-23T12:00:00.000Z",
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
    submittedAt: "2026-04-24T09:30:00.000Z",
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
    submittedAt: "2026-04-23T08:30:00.000Z",
    lastComment: null,
  },
];

test("review and process-document summaries stay aligned over HTTP", async () => {
  const apiApp = createGatewayTestApiApp({
    appOptions: {
      billVersionRepository: new InMemoryBillVersionRepository(seededBillVersions),
      reviewSubmissionRepository: new InMemoryReviewSubmissionRepository(
        seededReviewSubmissions,
      ),
      processDocumentRepository: new InMemoryProcessDocumentRepository(
        seededProcessDocuments,
      ),
    },
  });

  const gatewayApp = createGatewayTestApp(apiApp);

  const token = await createGatewayTestToken();

  try {
    const reviewResponse = await gatewayApp.inject({
      method: "GET",
      url: "/v1/resources/review-summary?projectId=project-001&billVersionId=bill-version-001&status=pending",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(reviewResponse.statusCode, 200);
    assert.deepEqual(reviewResponse.json(), {
      type: "resource",
      resourceType: "review_summary",
      scope: {
        projectId: "project-001",
        billVersionId: "bill-version-001",
        stageCode: null,
        disciplineCode: null,
        status: "pending",
      },
      data: {
        items: [
          {
            id: "review-submission-001",
            projectId: "project-001",
            billVersionId: "bill-version-001",
            stageCode: "estimate",
            disciplineCode: "building",
            status: "pending",
            submittedBy: "user-002",
            submittedAt: "2026-04-24T10:00:00.000Z",
            submissionComment: "待审核",
            reviewedBy: null,
            reviewedAt: null,
            reviewComment: null,
            rejectionReason: null,
            billVersionSummary: {
              versionName: "估算版 V1",
              versionNo: 1,
              versionStatus: "submitted",
            },
            canApprove: true,
            canReject: true,
            canCancel: false,
          },
        ],
        summary: {
          totalCount: 1,
          statusCounts: {
            pending: 1,
            approved: 0,
            rejected: 0,
            cancelled: 0,
          },
          actionableCount: 1,
        },
      },
    });

    const processResponse = await gatewayApp.inject({
      method: "GET",
      url: "/v1/resources/process-document-summary?projectId=project-001&stageCode=estimate&documentType=change_order&status=submitted",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(processResponse.statusCode, 200);
    assert.deepEqual(processResponse.json(), {
      type: "resource",
      resourceType: "process_document_summary",
      scope: {
        projectId: "project-001",
        stageCode: "estimate",
        disciplineCode: null,
        documentType: "change_order",
        status: "submitted",
      },
      data: {
        items: [
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
            submittedAt: "2026-04-24T09:30:00.000Z",
            lastComment: "待审核",
            stageName: "投资估算",
            disciplineName: "建筑工程",
            isEditable: false,
            isReviewable: true,
          },
        ],
        summary: {
          totalCount: 1,
          statusCounts: {
            draft: 0,
            submitted: 1,
            approved: 0,
            rejected: 0,
            settled: 0,
          },
          documentTypeCounts: {
            change_order: 1,
            site_visa: 0,
            progress_payment: 0,
          },
        },
      },
    });
  } finally {
    await gatewayApp.close();
    await apiApp.close();
  }
});

test("review and process-document workflow tools update summaries over HTTP", async () => {
  const apiApp = createGatewayTestApiApp({
    appOptions: {
      billVersionRepository: new InMemoryBillVersionRepository(seededBillVersions),
      reviewSubmissionRepository: new InMemoryReviewSubmissionRepository(
        seededReviewSubmissions,
      ),
      processDocumentRepository: new InMemoryProcessDocumentRepository(
        seededProcessDocuments,
      ),
    },
  });

  const gatewayApp = createGatewayTestApp(apiApp);

  const token = await createGatewayTestToken();

  try {
    const reviewToolResponse = await gatewayApp.inject({
      method: "POST",
      url: "/v1/tools/decide-review",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        projectId: "project-001",
        reviewSubmissionId: "review-submission-001",
        action: "approve",
        comment: "通过",
      },
    });

    assert.equal(reviewToolResponse.statusCode, 200);
    assert.equal(reviewToolResponse.json().tool, "decide_review");
    assert.equal(reviewToolResponse.json().result.status, "approved");

    const reviewSummaryResponse = await gatewayApp.inject({
      method: "GET",
      url: "/v1/resources/review-summary?projectId=project-001&billVersionId=bill-version-001&status=approved",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(reviewSummaryResponse.statusCode, 200);
    assert.equal(reviewSummaryResponse.json().data.items[0].id, "review-submission-001");
    assert.equal(reviewSummaryResponse.json().data.items[0].status, "approved");
    assert.equal(reviewSummaryResponse.json().data.summary.statusCounts.approved, 1);

    const processToolResponse = await gatewayApp.inject({
      method: "POST",
      url: "/v1/tools/update-process-document-status",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        projectId: "project-001",
        documentId: "process-document-001",
        status: "approved",
        comment: "通过",
      },
    });

    assert.equal(processToolResponse.statusCode, 200);
    assert.equal(processToolResponse.json().tool, "update_process_document_status");
    assert.equal(processToolResponse.json().result.status, "approved");

    const processSummaryResponse = await gatewayApp.inject({
      method: "GET",
      url: "/v1/resources/process-document-summary?projectId=project-001&stageCode=estimate&documentType=change_order&status=approved",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(processSummaryResponse.statusCode, 200);
    assert.equal(processSummaryResponse.json().data.items[0].id, "process-document-001");
    assert.equal(processSummaryResponse.json().data.items[0].status, "approved");
    assert.equal(processSummaryResponse.json().data.summary.statusCounts.approved, 1);
  } finally {
    await gatewayApp.close();
    await apiApp.close();
  }
});

test("review rejection and process-document submit tools update summaries over HTTP", async () => {
  const apiApp = createGatewayTestApiApp({
    appOptions: {
      billVersionRepository: new InMemoryBillVersionRepository(seededBillVersions),
      reviewSubmissionRepository: new InMemoryReviewSubmissionRepository(
        seededReviewSubmissions,
      ),
      processDocumentRepository: new InMemoryProcessDocumentRepository(
        seededProcessDocuments,
      ),
    },
  });

  const gatewayApp = createGatewayTestApp(apiApp);

  const token = await createGatewayTestToken();

  try {
    const reviewToolResponse = await gatewayApp.inject({
      method: "POST",
      url: "/v1/tools/decide-review",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        projectId: "project-001",
        reviewSubmissionId: "review-submission-001",
        action: "reject",
        reason: "工程量依据不足",
        comment: "退回补充",
      },
    });

    assert.equal(reviewToolResponse.statusCode, 200);
    assert.equal(reviewToolResponse.json().tool, "decide_review");
    assert.equal(reviewToolResponse.json().result.status, "rejected");
    assert.equal(reviewToolResponse.json().result.rejectionReason, "工程量依据不足");

    const reviewSummaryResponse = await gatewayApp.inject({
      method: "GET",
      url: "/v1/resources/review-summary?projectId=project-001&billVersionId=bill-version-001&status=rejected",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(reviewSummaryResponse.statusCode, 200);
    assert.equal(reviewSummaryResponse.json().data.items[0].id, "review-submission-001");
    assert.equal(reviewSummaryResponse.json().data.items[0].status, "rejected");
    assert.equal(
      reviewSummaryResponse.json().data.items[0].rejectionReason,
      "工程量依据不足",
    );
    assert.equal(reviewSummaryResponse.json().data.summary.statusCounts.rejected, 2);

    const processToolResponse = await gatewayApp.inject({
      method: "POST",
      url: "/v1/tools/update-process-document-status",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        projectId: "project-001",
        documentId: "process-document-002",
        status: "submitted",
        comment: "提交审核",
      },
    });

    assert.equal(processToolResponse.statusCode, 200);
    assert.equal(processToolResponse.json().tool, "update_process_document_status");
    assert.equal(processToolResponse.json().result.status, "submitted");

    const processSummaryResponse = await gatewayApp.inject({
      method: "GET",
      url: "/v1/resources/process-document-summary?projectId=project-001&stageCode=estimate&documentType=site_visa&status=submitted",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(processSummaryResponse.statusCode, 200);
    assert.equal(processSummaryResponse.json().data.items[0].id, "process-document-002");
    assert.equal(processSummaryResponse.json().data.items[0].status, "submitted");
    assert.equal(processSummaryResponse.json().data.summary.statusCounts.submitted, 1);
  } finally {
    await gatewayApp.close();
    await apiApp.close();
  }
});

test("review cancel and process-document reject tools update summaries over HTTP", async () => {
  const apiApp = createGatewayTestApiApp({
    appOptions: {
      billVersionRepository: new InMemoryBillVersionRepository(seededBillVersions),
      reviewSubmissionRepository: new InMemoryReviewSubmissionRepository(
        seededReviewSubmissions,
      ),
      processDocumentRepository: new InMemoryProcessDocumentRepository(
        seededProcessDocuments,
      ),
    },
  });

  const gatewayApp = createGatewayTestApp(apiApp);

  const submitterToken = await createGatewayTestTokenForUser({
    sub: "user-002",
    displayName: "Submitter User",
    roleCodes: ["cost_engineer"],
  });
  const reviewerToken = await createGatewayTestToken();

  try {
    const cancelReviewResponse = await gatewayApp.inject({
      method: "POST",
      url: "/v1/tools/decide-review",
      headers: {
        authorization: `Bearer ${submitterToken}`,
      },
      payload: {
        projectId: "project-001",
        reviewSubmissionId: "review-submission-001",
        action: "cancel",
        comment: "撤回重提",
      },
    });

    assert.equal(cancelReviewResponse.statusCode, 200);
    assert.equal(cancelReviewResponse.json().result.status, "cancelled");

    const cancelledReviewSummary = await gatewayApp.inject({
      method: "GET",
      url: "/v1/resources/review-summary?projectId=project-001&billVersionId=bill-version-001&status=cancelled",
      headers: {
        authorization: `Bearer ${reviewerToken}`,
      },
    });

    assert.equal(cancelledReviewSummary.statusCode, 200);
    assert.equal(cancelledReviewSummary.json().data.items[0].id, "review-submission-001");
    assert.equal(cancelledReviewSummary.json().data.items[0].status, "cancelled");
    assert.equal(cancelledReviewSummary.json().data.summary.statusCounts.cancelled, 1);

    const rejectDocumentResponse = await gatewayApp.inject({
      method: "POST",
      url: "/v1/tools/update-process-document-status",
      headers: {
        authorization: `Bearer ${reviewerToken}`,
      },
      payload: {
        projectId: "project-001",
        documentId: "process-document-001",
        status: "rejected",
        comment: "退回调整",
      },
    });

    assert.equal(rejectDocumentResponse.statusCode, 200);
    assert.equal(rejectDocumentResponse.json().result.status, "rejected");

    const rejectedDocumentSummary = await gatewayApp.inject({
      method: "GET",
      url: "/v1/resources/process-document-summary?projectId=project-001&stageCode=estimate&documentType=change_order&status=rejected",
      headers: {
        authorization: `Bearer ${reviewerToken}`,
      },
    });

    assert.equal(rejectedDocumentSummary.statusCode, 200);
    assert.equal(rejectedDocumentSummary.json().data.items[0].id, "process-document-001");
    assert.equal(rejectedDocumentSummary.json().data.items[0].status, "rejected");
    assert.equal(rejectedDocumentSummary.json().data.summary.statusCounts.rejected, 1);
  } finally {
    await gatewayApp.close();
    await apiApp.close();
  }
});

test("workflow tools surface structured API failures over HTTP", async () => {
  const apiApp = createGatewayTestApiApp({
    appOptions: {
      billVersionRepository: new InMemoryBillVersionRepository(seededBillVersions),
      reviewSubmissionRepository: new InMemoryReviewSubmissionRepository(
        seededReviewSubmissions,
      ),
      processDocumentRepository: new InMemoryProcessDocumentRepository(
        seededProcessDocuments,
      ),
    },
  });

  const gatewayApp = createGatewayTestApp(apiApp);

  const reviewerToken = await createGatewayTestToken();
  const submitterToken = await createGatewayTestTokenForUser({
    sub: "user-002",
    displayName: "Submitter User",
    roleCodes: ["cost_engineer"],
  });

  try {
    const cancelByReviewerResponse = await gatewayApp.inject({
      method: "POST",
      url: "/v1/tools/decide-review",
      headers: {
        authorization: `Bearer ${reviewerToken}`,
      },
      payload: {
        projectId: "project-001",
        reviewSubmissionId: "review-submission-001",
        action: "cancel",
        comment: "非提交人撤回",
      },
    });

    assert.equal(cancelByReviewerResponse.statusCode, 403);
    assert.deepEqual(cancelByReviewerResponse.json().error, {
      code: "FORBIDDEN",
      message: "Only the submitter can cancel this review",
    });

    const selfRejectDocumentResponse = await gatewayApp.inject({
      method: "POST",
      url: "/v1/tools/update-process-document-status",
      headers: {
        authorization: `Bearer ${submitterToken}`,
      },
      payload: {
        projectId: "project-001",
        documentId: "process-document-001",
        status: "rejected",
        comment: "自审退回",
      },
    });

    assert.equal(selfRejectDocumentResponse.statusCode, 403);
    assert.deepEqual(selfRejectDocumentResponse.json().error, {
      code: "FORBIDDEN",
      message: "You do not have permission to review this resource",
    });
  } finally {
    await gatewayApp.close();
    await apiApp.close();
  }
});
