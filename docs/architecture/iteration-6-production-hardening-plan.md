# 新点 SaaS 造价系统 Iteration 6 生产硬化计划

## 1. 迭代目标

Iteration 6 不新增主业务范围，目标是把已经完成的 V1/I5 主链推进到可上线试运行状态。

本迭代重点覆盖：

- 回归矩阵与发布准入
- 数据库模式与迁移审查
- 异步任务压测与降级保护
- Provider、Worker、MCP Gateway 健康检查聚合
- 日志、审计、错误码与运维手册收口

本迭代明确不做：

- 新增业务实体
- 新增 AI 自动执行正式写操作
- 重写前端信息架构
- 引入新的任务队列或流程引擎

## 2. 当前基线

- I1-I5 主线能力已完成代码闭环。
- `docs/context/current-working-context.md` 是当前工作状态入口。
- `docs/architecture/backend-implementation-checklist.md` 已按实际完成状态同步。
- OpenAPI 与已实现路由文档通过生成脚本维护。
- 生产硬化前仍需补齐导出任务压测和运行时健康检查聚合。

## 3. 任务拆分

### 3.1 发布准入与回归矩阵

- [x] 固化整仓准入命令：`npm run typecheck`, `npm run test`, `npm run docs:api`, `npm run docs:openspec`
- [x] 增加数据库模式 smoke 准入：`npm run dev:smoke:live-db`
- [x] 建立前端关键页面回归矩阵：项目、清单、汇总、审核、任务、AI 推荐、知识
- [x] 建立 MCP Gateway 资源回归矩阵：capabilities、project-context、stage-context、bill-version-context、ai-provider-telemetry、skill-definitions、runtime-diagnostics

验收标准：

- 任一发布候选都能按同一套命令判断是否可进入试运行。
- 本地缺少 Docker、Postgres 或 `LLM_API_KEY` 时，文档能明确区分环境问题和代码回归。

当前验证记录：

- 2026-05-04 `npm run typecheck` 通过
- 2026-05-04 `npm run test` 通过
- 2026-05-04 `npm run docs:api` 通过
- 2026-05-04 `npm run docs:openspec` 通过
- 2026-05-04 `npm run dev:smoke:live-db` 首次阻塞于本机 Docker daemon 未运行，错误为无法连接 `/Users/huahaha/.docker/run/docker.sock`
- 2026-05-04 Docker 启动后复跑 `npm run dev:smoke:live-db` 通过
- 2026-05-05 `npm --workspace saas-pricing-frontend test -- test/project-detail-page.test.tsx` 通过
- 2026-05-05 `npm run typecheck` 通过
- 2026-05-05 `npm run test` 通过
- 2026-05-05 `npm run docs:api` 通过
- 2026-05-05 `npm run docs:openspec` 通过
- 2026-05-05 `npm run dev:smoke:live-db` 通过
- 2026-05-05 `npm run test:workspace` 通过

前端关键页面回归矩阵：

| 页面 | 覆盖测试 | 发布准入关注点 |
|------|----------|----------------|
| 项目列表/仪表盘 | `apps/frontend/test/projects-dashboard.test.ts` | 项目状态、阶段状态、主导航入口 |
| 项目详情 | `apps/frontend/test/project-detail-page.test.tsx` | 工作台聚合、权限摘要、Provider 诊断入口、运行诊断入口 |
| 清单页 | `apps/frontend/test/bill-items-page.test.tsx` | 版本状态、计价错误、重算任务提示、来源链 |
| 汇总页 | `apps/frontend/test/summary-page.test.tsx` | 汇总/偏差筛选、报表导出、下载入口 |
| 审核页 | `apps/frontend/test/project-reviews-page.test.tsx` | 审核通过/驳回/撤回、回流链接 |
| 过程单据页 | `apps/frontend/test/project-process-documents-page.test.tsx` | 提交、审批、驳回、结算锁定 |
| 任务状态页 | `apps/frontend/test/project-job-status-page.test.tsx` | 失败范围、重试、导出、任务摘要 |
| AI 推荐页 | `apps/frontend/test/project-ai-recommendations-page.test.tsx` | 异步推荐、接受/忽略、Provider 诊断 |
| 知识/审计页 | `apps/frontend/test/project-knowledge-page.test.tsx`, `apps/frontend/test/project-audit-logs-page.test.tsx` | 抽取结果、审计过滤 |

MCP Gateway resource 回归矩阵：

| Resource | 覆盖测试 | 发布准入关注点 |
|----------|----------|----------------|
| `capabilities` | `apps/mcp-gateway/test/app.test.ts` | capability URI 与 route 注册一致 |
| `project-context` | `apps/mcp-gateway/test/app.test.ts`, `apps/mcp-gateway/test/project-summary-context.e2e.test.ts` | summary、jobs、knowledge、memory 聚合 |
| `stage-context` | `apps/mcp-gateway/test/app.test.ts` | 阶段 scope 与权限透传 |
| `bill-version-context` | `apps/mcp-gateway/test/app.test.ts` | 版本 scope、summary details、知识/记忆聚合 |
| `ai-provider-telemetry` | `apps/mcp-gateway/test/app.test.ts`, `apps/mcp-gateway/test/api-client.test.ts` | Provider 失败、延迟、重试告警 |
| `skill-definitions` | `apps/mcp-gateway/test/app.test.ts`, `apps/mcp-gateway/test/api-client.test.ts` | skills 预留定义读取 |
| `runtime-diagnostics` | `apps/mcp-gateway/test/app.test.ts`, `apps/mcp-gateway/test/api-client.test.ts` | API health、MCP Gateway、Worker job 摘要、Provider health/telemetry 聚合 |

### 3.2 数据库模式与迁移审查

- [x] 复跑数据库模式核心 API 测试
- [x] 审查新增表、枚举、索引和迁移顺序
- [x] 抽样验证 `project_member`、`background_job`、`knowledge_entry`、`memory_entry`、`skill_definition` 的数据库映射
- [x] 补充迁移回滚注意事项

验收标准：

- 数据库模式和内存模式在主流程行为上保持一致。
- 数据库映射错误不会被内存仓储测试掩盖。

### 3.3 异步任务压测与保护

- [x] 对 `report_export` 创建、claim、执行、完成、失败状态做压力样本
- [x] 对 `project_recalculate` 和 `ai_recommendation` 任务做失败恢复样本
- [x] 明确导出任务最大输入规模、超时、失败消息和下载生命周期
- [x] 在任务状态页和 MCP 任务摘要中保留失败原因可读性

验收标准：

- 大规模导出不会阻塞主请求。
- 失败任务可追踪、可重试或可明确人工处理。

当前验证记录：

- `apps/api/test/report-export-task.test.ts` 覆盖 report export 失败时 background job 和 export task 同步失败、审计日志写入。
- `apps/api/test/report-export-task.test.ts` 覆盖 12 个 report export job 连续创建、入队、执行完成，并保持下载就绪。
- `apps/worker/test/job-runner.test.ts` 覆盖 `project_recalculate` 连续完成和 `ai_recommendation` 部分失败时保留 provider failure summary。

报表导出保护口径：

| 项目 | 当前口径 | 后续扩展点 |
|------|----------|------------|
| 最大输入规模 | `stage_bill` 明细最多取 100 条，`variance` 明细最多取 20 条 | 若试运行数据量超过内存 JSON 预览承载能力，改为对象存储文件流 |
| 超时 | Worker 任务由轮询进程承接，主请求只返回 `202` 和任务引用 | 后续可在 Worker 层增加单任务执行超时和取消 |
| 失败消息 | `report_export_task.errorMessage` 与 `background_job.errorMessage` 同步保留 | 前端和 MCP 均继续读取结构化任务状态 |
| 下载生命周期 | 完成后保留 `downloadFileName`、`downloadContentType`、`downloadContentLength` 和预览内容 | 后续接对象存储时增加过期时间和重新生成入口 |

### 3.4 健康检查聚合

- [x] 聚合 API、Worker、AI Runtime Provider、MCP Gateway 的健康信息
- [x] 明确 Provider 未配置、Provider 调用失败、Provider 返回非法三类错误
- [x] 前端诊断入口继续展示后端结构化错误原文兜底
- [x] MCP Gateway 暴露运行时诊断资源或能力摘要

验收标准：

- 试运行时能快速判断失败来自环境、上游 Provider、队列执行还是业务校验。
- Agent 和前端用户看到的诊断口径一致。

当前实现：

- API `/health` 暴露 API 进程状态
- API `/v1/ai/provider-health` 暴露 Provider 配置与连通性
- API `/v1/projects/:projectId/ai/provider-telemetry` 暴露 Provider 作业失败、延迟、重试告警
- API `/v1/jobs` 暴露 Worker 可观测的任务类型和状态摘要
- MCP Gateway `/health` 暴露网关进程状态
- MCP Gateway `/v1/resources/runtime-diagnostics` 聚合 API、Worker job、Provider health、Provider telemetry 与 gateway 状态
- 前端项目详情页“运行诊断”聚合 API health、Provider health/telemetry 和 Worker 任务摘要，并保留任务状态与 Provider 诊断跳转入口

Provider 故障分类：

| 类别 | 主要信号 | 处理方向 |
|------|----------|----------|
| 未配置 | `configured: false`, `healthy: false`, message 包含 `LLM_API_KEY is required` | 补环境变量，不按代码回归处理 |
| 调用失败 | job failed、`AI_PROVIDER_REQUEST_FAILED`、telemetry consecutive failure 增长 | 检查 Provider 地址、网络、鉴权和超时 |
| 返回非法 | `AI_PROVIDER_RESPONSE_INVALID`、job result 带 provider failure summary | 检查模型输出 JSON schema 和 prompt 约束 |

### 3.5 运维与上线文档

- [x] 补齐本地、测试、生产环境变量说明
- [x] 补齐数据库、Redis、AI Provider、MCP Gateway 启停顺序
- [x] 补齐常见故障排查：缺少 `LLM_API_KEY`、Docker 未启动、OpenAPI 未同步、导出任务失败
- [x] 明确发布前文档生成与校验顺序

验收标准：

- 新接手人员可以按文档完成本地启动、回归验证和常见故障定位。

当前运维入口：[production-readiness-runbook.md](./production-readiness-runbook.md)。

## 4. 推荐推进顺序

1. 回归矩阵和准入命令固化
2. 数据库模式 smoke 复跑
3. 报表导出压测与任务保护
4. 健康检查聚合
5. 运维和上线文档收口

## 5. 完成标准

Iteration 6 完成时，至少满足以下结果：

- 发布候选具备统一准入命令
- 数据库模式主流程可复验
- 报表导出和后台任务具备压力样本
- Provider、Worker、MCP Gateway 的故障来源可定位
- 运维文档能支撑试运行
