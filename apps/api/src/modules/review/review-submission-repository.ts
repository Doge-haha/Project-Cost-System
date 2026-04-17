export type ReviewSubmissionRecord = {
  id: string;
  projectId: string;
  billVersionId: string;
  stageCode: string;
  disciplineCode: string;
  status: "pending" | "approved" | "rejected";
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
