import { describe, expect, test } from "vitest";

import {
  appendReviewBatchSummary,
  buildNextReviewActionState,
  buildReviewReturnQuery,
  buildReviewStatusHint,
  normalizeReviewFilter,
  normalizeReviewSummaryFocus,
} from "../src/features/projects/project-reviews-model";

type ReviewFixture = {
  id: string;
  billVersionSummary: {
    versionName: string;
  };
  status: "pending";
  canApprove: boolean;
  canReject: boolean;
  canCancel: boolean;
  rejectionReason: string | null;
  lastComment: string | null;
};

const reviewItems: ReviewFixture[] = [
  {
    id: "review-001",
    billVersionSummary: {
      versionName: "清单版本 A",
    },
    status: "pending",
    canApprove: true,
    canReject: true,
    canCancel: false,
    rejectionReason: null,
    lastComment: null,
  },
  {
    id: "review-002",
    billVersionSummary: {
      versionName: "清单版本 B",
    },
    status: "pending",
    canApprove: false,
    canReject: false,
    canCancel: true,
    rejectionReason: "请重新检查",
    lastComment: null,
  },
];

describe("review model helpers", () => {
  test("normalizes review filters and summary focus values", () => {
    expect(normalizeReviewFilter("pending")).toBe("pending");
    expect(normalizeReviewFilter("actionable")).toBe("actionable");
    expect(normalizeReviewFilter("unknown")).toBe("all");
    expect(normalizeReviewSummaryFocus("rejected")).toBe("rejected");
    expect(normalizeReviewSummaryFocus("other")).toBeNull();
  });

  test("builds review return query and batch summary", () => {
    const query = buildReviewReturnQuery("approved", "清单版本 A", "review-001");
    expect(query).toContain("refresh=reviews");
    expect(query).toContain("resultStatus=approved");
    expect(query).toContain("resultName=%E6%B8%85%E5%8D%95%E7%89%88%E6%9C%AC+A");
    expect(query).toContain("resultKind=review");
    expect(query).toContain("resultId=review-001");

    expect(
      appendReviewBatchSummary(query, [
        {
          reviewId: "review-001",
          versionName: "清单版本 A",
          status: "approved",
          detail: "",
        },
        {
          reviewId: "review-002",
          versionName: "清单版本 B",
          status: "rejected",
          detail: "",
        },
      ]),
    ).toContain("batchCount=2");
  });

  test("builds review status hints from review permissions and status", () => {
    expect(
      buildReviewStatusHint({
        status: "pending",
        canApprove: true,
        canReject: false,
        canCancel: false,
      }),
    ).toBe("待审核，可由当前角色执行通过或驳回。");
    expect(
      buildReviewStatusHint({
        status: "approved",
        canApprove: false,
        canReject: false,
        canCancel: false,
      }),
    ).toBe("审核已通过，可回到工作台继续查看后续流转。");
  });

  test("picks the next actionable review after one is completed", () => {
    expect(buildNextReviewActionState(reviewItems, "review-001")).toEqual({
      reviewId: "review-002",
      mode: "cancel",
      reason: "请重新检查",
    });
  });
});
