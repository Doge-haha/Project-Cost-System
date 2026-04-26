# Upload Comparison Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten the job status page's upload-aftercare comparison so it clearly reports what the new batch resolved, what still matches, and what newly appeared.

**Architecture:** Keep the summary logic in `project-job-status-model.ts`, keep the page as a thin renderer, and drive the comparison from the uploaded batch refresh result that the page already fetches. Add focused regression tests at the model and page layers so the UI text and the count semantics stay aligned.

**Tech Stack:** TypeScript, React, Vitest, Testing Library

---

### Task 1: Extend the comparison summary model

**Files:**
- Modify: `apps/frontend/src/features/projects/project-job-status-model.ts`
- Test: `apps/frontend/test/project-job-status-model.test.ts`

- [x] **Step 1: Write the failing test**

```ts
test("tracks newly introduced failures in the uploaded batch comparison summary", () => {
  const summary = buildFailedItemComparisonSummary({
    baselineItems: failedItems,
    currentItems: [
      failedItems[1]!,
      {
        lineNo: 7,
        reasonCode: "invalid_value",
        reasonLabel: "字段值非法",
        errorMessage: "projectId 不能为空",
        projectId: "project-001",
        resourceType: "bill_item",
        action: "create",
        keys: ["projectId", "resourceType", "action"],
        retryEventSnapshot: null,
      },
    ],
  });

  expect(summary).toEqual({
    baselineCount: 2,
    currentCount: 2,
    stillFailedCount: 1,
    resolvedCount: 1,
    newFailedCount: 1,
    unmatchedCount: 1,
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm --workspace saas-pricing-frontend test -- project-job-status-model.test.ts`

- [x] **Step 3: Write minimal implementation**

```ts
const resolvedCount = Math.max(input.baselineItems.length - stillFailedCount, 0);
const newFailedCount = Math.max(input.currentItems.length - stillFailedCount, 0);

return {
  baselineCount: input.baselineItems.length,
  currentCount: input.currentItems.length,
  stillFailedCount,
  resolvedCount,
  newFailedCount,
  unmatchedCount: resolvedCount,
};
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm --workspace saas-pricing-frontend test -- project-job-status-model.test.ts`

- [x] **Step 5: Commit**

```bash
git add apps/frontend/src/features/projects/project-job-status-model.ts apps/frontend/test/project-job-status-model.test.ts
git commit -m "feat: enrich upload comparison summary counts"
```

### Task 2: Render the richer comparison copy

**Files:**
- Modify: `apps/frontend/src/features/projects/project-job-status-page.tsx`
- Test: `apps/frontend/test/project-job-status-page.test.tsx`

- [x] **Step 1: Write the failing test**

```ts
expect(
  screen.getByText(/对照结果：原失败范围中仍命中 1 条/)
).toBeInTheDocument();
expect(screen.getByText(/旧失败是否被新批次消化/)).toBeInTheDocument();
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm --workspace saas-pricing-frontend test -- project-job-status-page.test.tsx`

- [x] **Step 3: Write minimal implementation**

```tsx
<p className="page-description">
  对照结果：原失败范围中仍命中 {uploadComparisonSummary.stillFailedCount} 条，
  已消化 {uploadComparisonSummary.resolvedCount} 条，新批次额外出现{" "}
  {uploadComparisonSummary.newFailedCount} 条。
</p>
<p className="page-description">
  这条对照会把旧失败是否被新批次消化、以及当前批次是否引入新的失败，拆开给你看。
</p>
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm --workspace saas-pricing-frontend test -- project-job-status-page.test.tsx`

- [x] **Step 5: Commit**

```bash
git add apps/frontend/src/features/projects/project-job-status-page.tsx apps/frontend/test/project-job-status-page.test.tsx
git commit -m "feat: clarify upload comparison summary"
```
