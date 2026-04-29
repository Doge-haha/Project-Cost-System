import { randomUUID } from "node:crypto";

import { desc, eq } from "drizzle-orm";

import type { ApiDatabase } from "../../infrastructure/database/database-client.js";
import { reviewSubmissions } from "../../infrastructure/database/schema.js";
import type { ReviewSubmissionStatus } from "./review-submission-constants.js";

export type ReviewSubmissionRecord = {
  id: string;
  projectId: string;
  billVersionId: string;
  stageCode: string;
  disciplineCode: string;
  status: ReviewSubmissionStatus;
  submittedBy: string;
  submittedAt: string;
  submissionComment?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewComment?: string | null;
  rejectionReason?: string | null;
};

export interface ReviewSubmissionRepository {
  listByProjectId(projectId: string): Promise<ReviewSubmissionRecord[]>;
  findById(reviewSubmissionId: string): Promise<ReviewSubmissionRecord | null>;
  findPendingByBillVersionId(
    billVersionId: string,
  ): Promise<ReviewSubmissionRecord | null>;
  create(
    input: Omit<ReviewSubmissionRecord, "id">,
  ): Promise<ReviewSubmissionRecord>;
  updateDecision(input: {
    reviewSubmissionId: string;
    status: ReviewSubmissionRecord["status"];
    reviewedBy: string;
    reviewedAt: string;
    reviewComment?: string | null;
    rejectionReason?: string | null;
  }): Promise<ReviewSubmissionRecord>;
}

export class InMemoryReviewSubmissionRepository
  implements ReviewSubmissionRepository
{
  private readonly submissions: ReviewSubmissionRecord[];

  constructor(seed: ReviewSubmissionRecord[]) {
    this.submissions = seed.map((submission) => ({ ...submission }));
  }

  async listByProjectId(projectId: string): Promise<ReviewSubmissionRecord[]> {
    return this.submissions.filter(
      (submission) => submission.projectId === projectId,
    );
  }

  async findById(
    reviewSubmissionId: string,
  ): Promise<ReviewSubmissionRecord | null> {
    return (
      this.submissions.find(
        (submission) => submission.id === reviewSubmissionId,
      ) ?? null
    );
  }

  async findPendingByBillVersionId(
    billVersionId: string,
  ): Promise<ReviewSubmissionRecord | null> {
    return (
      this.submissions.find(
        (submission) =>
          submission.billVersionId === billVersionId &&
          submission.status === "pending",
      ) ?? null
    );
  }

  async create(
    input: Omit<ReviewSubmissionRecord, "id">,
  ): Promise<ReviewSubmissionRecord> {
    const created: ReviewSubmissionRecord = {
      id: `review-submission-${String(this.submissions.length + 1).padStart(3, "0")}`,
      ...input,
    };

    this.submissions.push(created);
    return created;
  }

  async updateDecision(input: {
    reviewSubmissionId: string;
    status: ReviewSubmissionRecord["status"];
    reviewedBy: string;
    reviewedAt: string;
    reviewComment?: string | null;
    rejectionReason?: string | null;
  }): Promise<ReviewSubmissionRecord> {
    const target = this.submissions.find(
      (submission) => submission.id === input.reviewSubmissionId,
    );
    if (!target) {
      throw new Error("Review submission not found");
    }

    target.status = input.status;
    target.reviewedBy = input.reviewedBy;
    target.reviewedAt = input.reviewedAt;
    target.reviewComment = input.reviewComment ?? null;
    target.rejectionReason = input.rejectionReason ?? null;

    return target;
  }
}

export class DbReviewSubmissionRepository
  implements ReviewSubmissionRepository
{
  constructor(private readonly db: ApiDatabase) {}

  async listByProjectId(projectId: string): Promise<ReviewSubmissionRecord[]> {
    const records = await this.db.query.reviewSubmissions.findMany({
      where: (table, { eq: isEqual }) => isEqual(table.projectId, projectId),
      orderBy: (table, { desc }) => [desc(table.submittedAt), desc(table.id)],
    });

    return records.map(mapReviewSubmissionRecord);
  }

  async findById(
    reviewSubmissionId: string,
  ): Promise<ReviewSubmissionRecord | null> {
    const record = await this.db.query.reviewSubmissions.findFirst({
      where: (table, { eq: isEqual }) => isEqual(table.id, reviewSubmissionId),
    });

    return record ? mapReviewSubmissionRecord(record) : null;
  }

  async findPendingByBillVersionId(
    billVersionId: string,
  ): Promise<ReviewSubmissionRecord | null> {
    const record = await this.db.query.reviewSubmissions.findFirst({
      where: (table, { and: andAlso, eq: isEqual }) =>
        andAlso(
          isEqual(table.billVersionId, billVersionId),
          isEqual(table.status, "pending"),
        ),
      orderBy: (table, { desc }) => [desc(table.submittedAt), desc(table.id)],
    });

    return record ? mapReviewSubmissionRecord(record) : null;
  }

  async create(
    input: Omit<ReviewSubmissionRecord, "id">,
  ): Promise<ReviewSubmissionRecord> {
    const [created] = await this.db
      .insert(reviewSubmissions)
      .values({
        id: randomUUID(),
        projectId: input.projectId,
        billVersionId: input.billVersionId,
        stageCode: input.stageCode,
        disciplineCode: input.disciplineCode,
        status: input.status,
        submittedBy: input.submittedBy,
        submittedAt: new Date(input.submittedAt),
        submissionComment: input.submissionComment ?? null,
        reviewedBy: input.reviewedBy ?? null,
        reviewedAt: input.reviewedAt ? new Date(input.reviewedAt) : null,
        reviewComment: input.reviewComment ?? null,
        rejectionReason: input.rejectionReason ?? null,
      })
      .returning();

    return mapReviewSubmissionRecord(created);
  }

  async updateDecision(input: {
    reviewSubmissionId: string;
    status: ReviewSubmissionRecord["status"];
    reviewedBy: string;
    reviewedAt: string;
    reviewComment?: string | null;
    rejectionReason?: string | null;
  }): Promise<ReviewSubmissionRecord> {
    const [updated] = await this.db
      .update(reviewSubmissions)
      .set({
        status: input.status,
        reviewedBy: input.reviewedBy,
        reviewedAt: new Date(input.reviewedAt),
        reviewComment: input.reviewComment ?? null,
        rejectionReason: input.rejectionReason ?? null,
      })
      .where(eq(reviewSubmissions.id, input.reviewSubmissionId))
      .returning();

    if (!updated) {
      throw new Error("Review submission not found");
    }

    return mapReviewSubmissionRecord(updated);
  }
}

function mapReviewSubmissionRecord(
  record: typeof reviewSubmissions.$inferSelect,
): ReviewSubmissionRecord {
  return {
    id: record.id,
    projectId: record.projectId,
    billVersionId: record.billVersionId,
    stageCode: record.stageCode,
    disciplineCode: record.disciplineCode,
    status: record.status as ReviewSubmissionRecord["status"],
    submittedBy: record.submittedBy,
    submittedAt: record.submittedAt.toISOString(),
    submissionComment: record.submissionComment ?? null,
    reviewedBy: record.reviewedBy ?? null,
    reviewedAt: record.reviewedAt?.toISOString() ?? null,
    reviewComment: record.reviewComment ?? null,
    rejectionReason: record.rejectionReason ?? null,
  };
}
