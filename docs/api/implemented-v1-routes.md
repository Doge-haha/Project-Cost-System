# 当前已实现 V1 API 路由

日期：2026-04-25

说明：

- 本文件记录当前代码已注册的 `/v1` 路由。
- `openapi-v1.yaml` 为当前 `/v1` 生成契约。
- 历史 `/api/v1` 草案已归档到 `openapi-v1-legacy.yaml`。
- 本文件由 `npm run docs:api-routes` 生成。

摘要：

- 路由总数：109
- 分组总数：16
- 方法分布：GET 46 / POST 43 / PUT 16 / DELETE 4
- 源文件：apps/api/src/app/register-ai-recommendation-routes.ts / apps/api/src/app/register-bill-item-routes.ts / apps/api/src/app/register-bill-source-import-routes.ts / apps/api/src/app/register-bill-version-routes.ts / apps/api/src/app/register-bill-work-item-routes.ts / apps/api/src/app/register-import-routes.ts / apps/api/src/app/register-job-routes.ts / apps/api/src/app/register-knowledge-routes.ts / apps/api/src/app/register-master-data-routes.ts / apps/api/src/app/register-pricing-routes.ts / apps/api/src/app/register-process-document-routes.ts / apps/api/src/app/register-project-core-routes.ts / apps/api/src/app/register-quota-routes.ts / apps/api/src/app/register-recalculate-routes.ts / apps/api/src/app/register-report-routes.ts / apps/api/src/app/register-review-routes.ts / apps/api/src/app/setup-app-base.ts

## Auth

- `GET /v1/me`

## Projects

- `GET /v1/projects`
- `POST /v1/projects`
- `GET /v1/projects/:projectId`
- `GET /v1/projects/:projectId/ai/bill-recommendations`
- `GET /v1/projects/:projectId/ai/quota-recommendations`
- `GET /v1/projects/:projectId/ai/recommendations`
- `GET /v1/projects/:projectId/ai/variance-warnings`
- `POST /v1/projects/:projectId/bill-imports/source`
- `POST /v1/projects/:projectId/bill-imports/source/preview`
- `GET /v1/projects/:projectId/bill-items`
- `POST /v1/projects/:projectId/bill-items`
- `PUT /v1/projects/:projectId/bill-items/:itemId`
- `GET /v1/projects/:projectId/bill-items/:itemId/work-items`
- `POST /v1/projects/:projectId/bill-items/:itemId/work-items`
- `PUT /v1/projects/:projectId/bill-items/:itemId/work-items/:workItemId`
- `PUT /v1/projects/:projectId/default-fee-template`
- `PUT /v1/projects/:projectId/default-price-version`
- `PUT /v1/projects/:projectId/default-pricing-config`
- `GET /v1/projects/:projectId/disciplines`
- `PUT /v1/projects/:projectId/disciplines`
- `GET /v1/projects/:projectId/members`
- `PUT /v1/projects/:projectId/members`
- `GET /v1/projects/:projectId/stages`
- `PUT /v1/projects/:projectId/stages`
- `PUT /v1/projects/:projectId/status`
- `GET /v1/projects/:projectId/workspace`

## Bill Versions

- `GET /v1/projects/:projectId/bill-versions`
- `POST /v1/projects/:projectId/bill-versions`
- `GET /v1/projects/:projectId/bill-versions/:billVersionId`
- `POST /v1/projects/:projectId/bill-versions/:billVersionId/copy-from`
- `POST /v1/projects/:projectId/bill-versions/:billVersionId/lock`
- `POST /v1/projects/:projectId/bill-versions/:billVersionId/recalculate`
- `GET /v1/projects/:projectId/bill-versions/:billVersionId/source-chain`
- `POST /v1/projects/:projectId/bill-versions/:billVersionId/submit`
- `POST /v1/projects/:projectId/bill-versions/:billVersionId/unlock`
- `GET /v1/projects/:projectId/bill-versions/:billVersionId/validation-summary`
- `POST /v1/projects/:projectId/bill-versions/:billVersionId/withdraw`

## Bill Items

- `GET /v1/projects/:projectId/bill-versions/:billVersionId/items`
- `POST /v1/projects/:projectId/bill-versions/:billVersionId/items`
- `DELETE /v1/projects/:projectId/bill-versions/:billVersionId/items/:itemId`
- `PUT /v1/projects/:projectId/bill-versions/:billVersionId/items/:itemId`
- `PUT /v1/projects/:projectId/bill-versions/:billVersionId/items/:itemId/manual-pricing`
- `PUT /v1/projects/:projectId/bill-versions/:billVersionId/items/:itemId/move`
- `POST /v1/projects/:projectId/bill-versions/:billVersionId/items/batch`
- `GET /v1/projects/:projectId/bill-versions/:billVersionId/items/tree`

## Bill Work Items

- `GET /v1/projects/:projectId/bill-versions/:billVersionId/items/:itemId/work-items`
- `POST /v1/projects/:projectId/bill-versions/:billVersionId/items/:itemId/work-items`
- `DELETE /v1/projects/:projectId/bill-versions/:billVersionId/items/:itemId/work-items/:workItemId`
- `PUT /v1/projects/:projectId/bill-versions/:billVersionId/items/:itemId/work-items/:workItemId`

## Quota Lines

- `GET /v1/projects/:projectId/bill-versions/:billVersionId/items/:itemId/quota-lines`
- `POST /v1/projects/:projectId/bill-versions/:billVersionId/items/:itemId/quota-lines`
- `GET /v1/projects/:projectId/quota-lines`
- `DELETE /v1/projects/:projectId/quota-lines/:quotaLineId`
- `PUT /v1/projects/:projectId/quota-lines/:quotaLineId`
- `POST /v1/projects/:projectId/quota-lines/batch-create`
- `GET /v1/projects/:projectId/quota-lines/candidates`
- `GET /v1/projects/:projectId/quota-lines/source-chain`
- `POST /v1/projects/:projectId/quota-lines/validate`

## Reviews

- `POST /v1/projects/:projectId/bill-versions/:billVersionId/reviews`
- `GET /v1/projects/:projectId/reviews`
- `POST /v1/projects/:projectId/reviews/:reviewSubmissionId/approve`
- `POST /v1/projects/:projectId/reviews/:reviewSubmissionId/cancel`
- `POST /v1/projects/:projectId/reviews/:reviewSubmissionId/reject`

## Process Documents

- `GET /v1/projects/:projectId/process-documents`
- `POST /v1/projects/:projectId/process-documents`
- `DELETE /v1/projects/:projectId/process-documents/:documentId`
- `PUT /v1/projects/:projectId/process-documents/:documentId`
- `PUT /v1/projects/:projectId/process-documents/:documentId/status`

## Pricing / Fee / Engine

- `POST /v1/engine/calculate`
- `GET /v1/fee-templates`
- `GET /v1/fee-templates/:feeTemplateId`
- `GET /v1/price-versions`
- `GET /v1/price-versions/:priceVersionId/items`

## Reports

- `POST /v1/reports/export`
- `GET /v1/reports/export/:taskId`
- `GET /v1/reports/export/:taskId/download`
- `GET /v1/reports/summary`
- `GET /v1/reports/summary/details`
- `GET /v1/reports/variance-breakdown`
- `GET /v1/reports/version-compare`

## Audit Logs

- `GET /v1/projects/:projectId/audit-logs`

## Master Data

- `GET /v1/discipline-types`
- `GET /v1/standard-sets`

## Background Jobs

- `GET /v1/jobs`
- `GET /v1/jobs/:jobId`
- `POST /v1/jobs/:jobId/complete`
- `POST /v1/jobs/:jobId/fail`
- `POST /v1/jobs/:jobId/process`
- `POST /v1/jobs/:jobId/retry`
- `POST /v1/jobs/pull-next`
- `POST /v1/projects/:projectId/recalculate`

## AI Recommendations

- `POST /v1/ai/bill-recommendations`
- `POST /v1/ai/quota-recommendations`
- `POST /v1/ai/recommendations/:recommendationId/accept`
- `POST /v1/ai/recommendations/:recommendationId/expire`
- `POST /v1/ai/recommendations/:recommendationId/ignore`
- `POST /v1/ai/recommendations/expire-stale`
- `POST /v1/ai/variance-warnings`

## AI Runtime / Knowledge

- `POST /v1/ai-runtime/extract-jobs`
- `POST /v1/ai-runtime/extract-preview`
- `POST /v1/projects/:projectId/ai-runtime/extract-from-audit`
- `GET /v1/projects/:projectId/knowledge-entries`
- `GET /v1/projects/:projectId/knowledge-search`
- `GET /v1/projects/:projectId/memory-entries`

## Import Tasks

- `GET /v1/projects/:projectId/import-tasks`
- `POST /v1/projects/:projectId/import-tasks`
- `GET /v1/projects/:projectId/import-tasks/:taskId/error-report`
- `POST /v1/projects/:projectId/import-tasks/upload`

## MCP Gateway 对应覆盖

Gateway 已通过注入式 e2e 覆盖以下 API 主线：

- reports summary / details / export
- jobs list / status / retry
- AI runtime preview / extract jobs / extract from audit
- knowledge entries
- import tasks / error report / upload retry scope
- reviews
- review workflow decisions
- process documents
- process document workflow status
- project recalculate
