# Current Working Context

Date: 2026-05-05

## Project

- Monorepo: SaaS pricing platform for construction cost workflows.
- Workspaces: `apps/api`, `apps/frontend`, `apps/worker`, `apps/mcp-gateway`, `apps/ai-runtime`, `packages/job-contracts`.
- Current mainline: database-mode TypeScript API, React frontend, worker queue, MCP gateway, Python AI runtime.

## Active Change Set

- Git status before this ledger update: `main` ahead of `origin/main` by 12 commits.
- I5 implementation and post-I5 I4/reporting/status closure are committed locally through `385e159 Align project stage status flow`.
- Current uncommitted work syncs global status docs and adds the I6 production hardening plan.
- Push is intentionally not awaited in this workflow.

## Completed Work

- Added Provider telemetry API for AI recommendation jobs.
- Added frontend Provider diagnostics and telemetry summary.
- Added rollback blocked reasons API and frontend copy mapping.
- Fixed database background job repository filtering and field mapping.
- Fixed database background job `findById`, `create`, and `update` stability.
- Added database-mode Provider telemetry integration coverage.
- Fixed `pg-mem` helper row normalization for raw SQL and Drizzle query compatibility.
- Reworked database project member repository mapping for project/user lookup and replacement.
- Added persisted project member scope type validation.
- Added generic AI recommendation list route filtering coverage.
- Fixed frontend async recommendation form so cleared limit is omitted instead of submitted as `0`.
- Added database project member empty replacement cleanup coverage.
- Added database background job partial update preservation coverage.
- Added AI Provider telemetry authorization coverage for non-members and system administrators.
- Added MCP Gateway `ai-provider-telemetry` resource, API client method, capability metadata, tests, and docs.
- Added AI recommendation async job/provider integration, recommendation accept/ignore/expire/rollback hardening, and frontend AI panel diagnostics.
- Added reference quota candidate enrichment and semantic recall path for quota recommendations.
- Added knowledge/memory extraction persistence, MCP context memory hints, knowledge relation support, skill definition API, and MCP `skill-definitions` resource.
- Added MCP module boundary placeholders for `mcp-capability`, `mcp-context-builder`, and `mcp-permission-guard`.
- Marked Iteration 5 task breakdown complete and synchronized AI/MCP checklist status.
- Added stage status flow alignment after bill-version review and project status changes.
- Added stage bill report export support.
- Synchronized I4 implementation status.
- Synchronized backend implementation checklist with the actual I1-I5 completed baseline.
- Added I6 production hardening plan and updated roadmap/document index/README routing to post-I5 work.
- Added MCP Gateway `runtime-diagnostics` resource for API health, Provider health/telemetry, Worker job summary, and Gateway status.
- Added I6 frontend/MCP regression matrices and production readiness runbook.
- Added report export repeated-job pressure sample and Provider diagnostics structured-error fallback coverage.
- Added Worker pressure sample for repeated `project_recalculate` and `ai_recommendation` jobs with provider failure summaries.
- Regenerated API route and OpenAPI docs.
- Added project detail page runtime diagnostics panel for API health, Provider health/telemetry, and Worker task summary with links to task status and Provider diagnostics.
- Added automated deployment rehearsal for Docker/Postgres, API, Worker, MCP Gateway runtime diagnostics, trial project creation, report export processing, and frontend production build.
- Fixed rehearsal blockers in database mode: Provider health no longer depends on a synthetic global audit project, and system-admin Worker tokens can read report summaries for queued export jobs.
- Added strict Provider rehearsal mode so试运行准入 can fail fast when real `LLM_API_KEY`/`LLM_MODEL`/`LLM_BASE_URL` Provider health is missing.

## Validation

Latest validation passed:

```bash
npm run typecheck
npm run test
npm run docs:api
npm run docs:openspec
npm run dev:smoke:live-db
npm --workspace @saas-pricing/mcp-gateway run typecheck
npm --workspace @saas-pricing/mcp-gateway test -- test/api-client.test.ts test/app.test.ts
npm --workspace @saas-pricing/api test -- test/report-export-task.test.ts
npm --workspace @saas-pricing/worker test -- test/job-runner.test.ts
npm --workspace saas-pricing-frontend test -- test/project-ai-recommendations-page.test.tsx
npm --workspace saas-pricing-frontend test -- test/project-detail-page.test.tsx
npm run test:workspace
npm run deploy:rehearsal
```

Database smoke initially blocked because Docker daemon was not running at `/Users/huahaha/.docker/run/docker.sock`; after Docker started, the same command passed.

`npm run deploy:provider-rehearsal` is now the required real-Provider gate for trial rollout. It intentionally fails in shells without `LLM_API_KEY`, `LLM_MODEL`, and `LLM_BASE_URL`.

Targeted validation also passed for:

```bash
npm --workspace @saas-pricing/mcp-gateway test -- test/app.test.ts
npm --workspace @saas-pricing/mcp-gateway run typecheck
npm run test:workspace
npm --workspace @saas-pricing/api test -- test/ai-recommendation.test.ts
npm --workspace @saas-pricing/api test -- test/background-job-processor.test.ts test/database-mode-app.test.ts test/database-app-options.test.ts
npm --workspace saas-pricing-frontend test -- test/project-ai-recommendations-page.test.tsx
```

## Graph Review

- Latest `code-review-graph` context: 2249 nodes, 29801 edges across 272 files.
- I6 closure review risk is moderate; remaining graph warnings are mostly coarse function-level coverage signals after targeted page and gateway coverage.

## Next Tasks

- Treat I1-I5 as complete unless new regression evidence appears.
- Continue I6 production hardening:
  1. apply real Provider secrets and run `npm run deploy:provider-rehearsal`
  2. run the same rehearsal against the trial environment
  3. execute a real business sample through import, pricing, AI recommendation, report export, and runtime diagnostics
- Do not spend more cycles waiting on push unless explicitly asked.
