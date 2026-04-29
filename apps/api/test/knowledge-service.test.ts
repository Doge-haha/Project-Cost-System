import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemoryKnowledgeEntryRepository,
  type KnowledgeEntryRecord,
} from "../src/modules/knowledge/knowledge-entry-repository.js";
import { InMemoryMemoryEntryRepository } from "../src/modules/knowledge/memory-entry-repository.js";
import { KnowledgeService } from "../src/modules/knowledge/knowledge-service.js";
import { InMemoryProjectDisciplineRepository } from "../src/modules/project/project-discipline-repository.js";
import { InMemoryProjectMemberRepository } from "../src/modules/project/project-member-repository.js";
import { InMemoryProjectRepository } from "../src/modules/project/project-repository.js";
import { InMemoryProjectStageRepository } from "../src/modules/project/project-stage-repository.js";

test("KnowledgeService reserves project retrospective and review rejection knowledge writes", async () => {
  const service = createKnowledgeService();

  const retrospective = await service.persistProjectRetrospective({
    projectId: "project-001",
    stageCode: "estimate",
    title: "Estimate replay",
    summary: "Material price risks need earlier evidence.",
    tags: ["risk", "material"],
    sourceId: "retrospective-001",
  });
  const rejection = await service.persistReviewRejectionTags({
    projectId: "project-001",
    stageCode: "estimate",
    reviewSubmissionId: "review-001",
    reason: "Missing supplier proof for steel price.",
    tags: ["material", "evidence"],
    operatorId: "user-001",
  });

  assert.equal(retrospective.sourceType, "project_retrospective");
  assert.equal(retrospective.sourceAction, "conclusion");
  assert.deepEqual(retrospective.tags, [
    "project_retrospective",
    "risk",
    "material",
  ]);
  assert.equal(retrospective.metadata.sourceId, "retrospective-001");
  assert.equal(rejection.sourceType, "review_submission");
  assert.equal(rejection.sourceAction, "reject");
  assert.deepEqual(rejection.tags, [
    "review_rejection",
    "reject",
    "material",
    "evidence",
  ]);
  assert.equal(rejection.metadata.reviewSubmissionId, "review-001");
});

test("KnowledgeService reserves project, organization, and AI runtime memory writes", async () => {
  const service = createKnowledgeService();

  const projectPreference = await service.persistProjectPreference({
    projectId: "project-001",
    stageCode: "estimate",
    preferenceKey: "review_threshold",
    content: "Flag material variances above 8%.",
  });
  const organizationPreference = await service.persistOrganizationPreference({
    projectId: "project-001",
    organizationId: "org-001",
    preferenceKey: "quota_standard",
    content: "Prefer local 2024 quota basis.",
  });
  const runtimeFeedback = await service.persistAiRuntimeFeedback({
    projectId: "project-001",
    stageCode: "estimate",
    sourceJobId: "job-001",
    feedbackKey: "recommendation_precision",
    content: "Quota recommendation precision improved after adding references.",
    status: "accepted",
  });

  assert.equal(projectPreference.subjectType, "project");
  assert.equal(projectPreference.subjectId, "project-001");
  assert.equal(
    projectPreference.memoryKey,
    "project-001:project:review_threshold",
  );
  assert.equal(organizationPreference.subjectType, "organization");
  assert.equal(organizationPreference.subjectId, "org-001");
  assert.equal(
    organizationPreference.memoryKey,
    "org-001:organization:quota_standard",
  );
  assert.equal(runtimeFeedback.subjectType, "ai_runtime");
  assert.equal(runtimeFeedback.subjectId, "job-001");
  assert.equal(runtimeFeedback.sourceJobId, "job-001");
  assert.equal(runtimeFeedback.metadata.status, "accepted");
});

test("KnowledgeService keeps reserved metadata fields authoritative", async () => {
  const service = createKnowledgeService();

  const retrospective = await service.persistProjectRetrospective({
    projectId: "project-001",
    title: "Estimate replay",
    summary: "Keep the explicit source id.",
    sourceId: "retrospective-001",
    metadata: { sourceId: "stale-source" },
  });
  const rejection = await service.persistReviewRejectionTags({
    projectId: "project-001",
    reviewSubmissionId: "review-001",
    reason: "Missing supplier proof.",
    tags: [],
    operatorId: "user-001",
    metadata: {
      reviewSubmissionId: "review-stale",
      operatorId: "user-stale",
    },
  });
  const runtimeFeedback = await service.persistAiRuntimeFeedback({
    projectId: "project-001",
    sourceJobId: "job-001",
    feedbackKey: "precision",
    content: "Accepted feedback should win over stale metadata.",
    status: "accepted",
    metadata: {
      feedbackKey: "stale-key",
      status: "ignored",
    },
  });
  const projectPreference = await service.persistProjectPreference({
    projectId: "project-001",
    preferenceKey: "review_threshold",
    content: "Use explicit preference key.",
    metadata: { preferenceKey: "stale-threshold" },
  });
  const organizationPreference = await service.persistOrganizationPreference({
    projectId: "project-001",
    organizationId: "org-001",
    preferenceKey: "quota_standard",
    content: "Use explicit organization preference key.",
    metadata: { preferenceKey: "stale-standard" },
  });

  assert.equal(retrospective.metadata.sourceId, "retrospective-001");
  assert.equal(rejection.metadata.reviewSubmissionId, "review-001");
  assert.equal(rejection.metadata.operatorId, "user-001");
  assert.equal(runtimeFeedback.metadata.feedbackKey, "precision");
  assert.equal(runtimeFeedback.metadata.status, "accepted");
  assert.equal(projectPreference.metadata.preferenceKey, "review_threshold");
  assert.equal(organizationPreference.metadata.preferenceKey, "quota_standard");
});

function createKnowledgeService(seed: KnowledgeEntryRecord[] = []) {
  return new KnowledgeService(
    new InMemoryKnowledgeEntryRepository(seed),
    new InMemoryMemoryEntryRepository([]),
    new InMemoryProjectRepository([
      {
        id: "project-001",
        code: "P001",
        name: "Demo Project",
        status: "active",
      },
    ]),
    new InMemoryProjectStageRepository([
      {
        id: "stage-001",
        projectId: "project-001",
        stageCode: "estimate",
        stageName: "Estimate",
        status: "active",
        sequenceNo: 1,
      },
    ]),
    new InMemoryProjectDisciplineRepository([
      {
        id: "discipline-001",
        projectId: "project-001",
        disciplineCode: "civil",
        disciplineName: "Civil",
        defaultStandardSetCode: null,
        status: "enabled",
      },
    ]),
    new InMemoryProjectMemberRepository([
      {
        id: "member-001",
        projectId: "project-001",
        userId: "user-001",
        displayName: "Owner",
        roleCode: "project_owner",
        scopes: [{ scopeType: "project", scopeValue: "project-001" }],
      },
    ]),
  );
}
