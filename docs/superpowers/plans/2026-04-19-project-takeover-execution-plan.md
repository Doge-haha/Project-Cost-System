# Project Takeover Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前仓库从“后端骨架已成型、以内存仓储为主、前端未启动”的状态，推进到“后端真实持久化、主业务链稳定、异步与 AI 链路可联调、前端可以正式启动”的状态。

**Architecture:** 以 `apps/api` 为业务事实入口，先完成真实数据库与事务底座，再稳定 `project -> bill_version -> bill_item -> quota_line -> calculate -> summary` 主链，随后收口 `worker / mcp-gateway / ai-runtime` 的协作边界，最后启动 `apps/frontend` 的最小可用工作台。当前计划是母计划，负责确定先后顺序、验收标准、风险和模块边界；进入每个阶段前，再按该阶段范围展开更细的实现计划。

**Tech Stack:** TypeScript, Fastify, Zod, Node.js workspaces, Python 3.11, pytest, PostgreSQL, Redis, Docker Compose, MCP gateway, background jobs.

---

## Planning Notes

- 这是一份接手开发母计划，不直接替代现有的 [2026-04-16-saas-pricing-v1-implementation.md](/Users/huahaha/Documents/New%20project/docs/superpowers/plans/2026-04-16-saas-pricing-v1-implementation.md:1)。
- 现有业务拆分文档仍有效，但本计划以“当前真实代码状态”为准，优先解决工程基线、持久化、模块收口问题。
- 本计划默认不扩大 `legacy/backend-java` 的代码面积，只把它作为规则和数据结构参考。
- 本计划不把 `apps/frontend` 提前到第一优先级，避免后端口径未稳时产生高返工成本。

## Current Baseline

### Already in place

- [x] `apps/api` 已具备项目、清单、定额、计价、审核、报表、后台任务、知识条目等骨架接口
- [x] `apps/worker` 已具备轮询执行和 AI Runtime CLI 调用能力
- [x] `apps/ai-runtime` 已具备知识/记忆候选抽取能力
- [x] `apps/mcp-gateway` 已具备 resource/tool/context 聚合模型
- [x] `npm run typecheck` 当前可通过

### Known gaps

- [ ] `apps/api` 当前仍以 `InMemory*Repository` 为默认主路径
- [ ] 真实数据库、迁移、事务 runner、配置分层尚未接入
- [ ] `apps/mcp-gateway` 存在回归，`npm test` 未全绿
- [ ] `apps/api/src/app/create-app.ts` 体积过大，路由与装配未完成模块拆分
- [ ] `apps/frontend` 仍是占位目录

## Workstreams

### Workstream A: Engineering Baseline

目标：让仓库回到稳定可回归、可持续迭代的状态。

涉及目录：

- `package.json`
- `README.md`
- `deploy/docker/docker-compose.dev.yml`
- `apps/mcp-gateway/test`
- `apps/mcp-gateway/src`

完成标志：

- `npm test` 全绿
- `npm run typecheck` 全绿
- 本地启动方式、环境变量、依赖拓扑清晰可复现

### Workstream B: Persistence Foundation

目标：把当前内存实现升级为真实持久化底座。

涉及目录：

- `apps/api/src/modules/**/**-repository.ts`
- `apps/api/src/shared/tx/transaction.ts`
- `apps/api/src/app/create-app.ts`
- `apps/api` 下新增数据库相关目录
- `deploy/docker/docker-compose.dev.yml`

完成标志：

- 核心业务数据可持久化
- 迁移和本地初始化可自动执行
- 事务边界不再是占位

### Workstream C: Core Business Chain

目标：稳定主业务链和权限、状态、审计的一致性。

涉及目录：

- `apps/api/src/modules/project`
- `apps/api/src/modules/bill`
- `apps/api/src/modules/quota`
- `apps/api/src/modules/pricing`
- `apps/api/src/modules/engine`
- `apps/api/src/modules/audit`

完成标志：

- `project -> bill_version -> bill_item -> quota_line -> calculate -> summary` 主链在真实数据层下可运行
- 权限、状态、审计在真实仓储模式下保持一致

### Workstream D: Async + AI + MCP

目标：让 `api / worker / ai-runtime / mcp-gateway` 形成稳定的协作闭环。

涉及目录：

- `apps/worker/src`
- `apps/ai-runtime/app`
- `apps/mcp-gateway/src`
- `packages/job-contracts/src/index.ts`

完成标志：

- 任务的入队、执行、完成/失败回写稳定
- AI Runtime 的输入输出契约稳定
- MCP 聚合结构稳定且测试通过

### Workstream E: Frontend Kickoff

目标：在后端主链稳定后启动最小可用前端。

涉及目录：

- `apps/frontend`
- API 文档和联调约定文件

完成标志：

- 前端可展示项目、阶段、清单、汇总 4 条核心页面路径
- 与稳定 API 建立联调节奏

## Phase Plan

### Phase 0: Stabilize the Repository

**Target:** 修复现有回归，恢复工程基线。

**Primary files and modules:**

- `apps/mcp-gateway/src/app/create-app.ts`
- `apps/mcp-gateway/test/app.test.ts`
- `README.md`
- `package.json`

- [ ] 修复 `apps/mcp-gateway` 的 3 个失败测试，恢复 `npm test` 全绿
- [ ] 对齐 `project-context` 的返回结构和测试口径
- [ ] 明确 `fetchKnowledgeEntries` 是否属于 `project-context` 的稳定返回契约
- [ ] 补充最小启动说明：Node、Python、Docker Compose、本地测试命令
- [ ] 在不改业务行为的前提下，完成一轮 smoke verification

**Acceptance criteria:**

- `npm test`
- `npm run typecheck`
- 关键服务职责与启动顺序可从 README 理解

### Phase 1: Persistence Decision and Bootstrapping

**Target:** 选定并接入真实持久化技术路线。

**Primary files and modules:**

- `apps/api/package.json`
- `apps/api/tsconfig.json`
- `apps/api/src/shared/tx/transaction.ts`
- `apps/api/src/app/create-app.ts`
- `deploy/docker/docker-compose.dev.yml`
- `apps/api` 下新增持久化目录

- [ ] 确认 ORM/查询层方案，建议优先在 `Drizzle` 和 `Prisma` 中二选一
- [ ] 增加数据库配置、连接初始化、迁移脚本和本地启动约定
- [ ] 为 PostgreSQL 和 Redis 补充开发环境配置项
- [ ] 替换 `InlineTransactionRunner` 占位实现，建立真实事务边界
- [ ] 定义仓储接口与持久化实现的并存过渡策略

**Acceptance criteria:**

- 新环境可自动拉起 PostgreSQL / Redis
- API 可通过真实连接初始化
- 至少一条事务型写路径完成真实提交与回滚验证

### Phase 2: Persist Project and Bill Core

**Target:** 优先把主业务根对象迁移到真实数据库。

**Primary files and modules:**

- `apps/api/src/modules/project/*`
- `apps/api/src/modules/bill/*`
- `apps/api/src/modules/audit/*`
- `apps/api/src/app/create-app.ts`

- [ ] 落第一批核心表：`project`, `project_stage`, `project_member`, `project_discipline`
- [ ] 落第二批主链表：`bill_version`, `bill_item`, `bill_work_item`
- [ ] 把上述模块的仓储切换到真实数据实现
- [ ] 保证项目授权、版本链、来源链、锁定前置规则在真实仓储下通过回归
- [ ] 审计日志继续覆盖关键写操作

**Acceptance criteria:**

- 项目与清单主链不再依赖内存仓储
- 相关 API 测试在真实仓储模式下通过
- 版本复制、提交、撤回、来源追溯行为一致

### Phase 3: Persist Pricing and Summary Core

**Target:** 把计价链和汇总链迁移到真实数据层。

**Primary files and modules:**

- `apps/api/src/modules/quota/*`
- `apps/api/src/modules/pricing/*`
- `apps/api/src/modules/fee/*`
- `apps/api/src/modules/engine/*`
- `apps/api/src/modules/reports/*`

- [ ] 落 `quota_line`, `price_version`, `price_item`, `fee_template`, `fee_rule`
- [ ] 接通项目默认价目和取费模板绑定
- [ ] 保证系统值、人工值、最终值并存模型在真实数据层可用
- [ ] 迁移 `summary`、`summary/details`、`version-compare` 查询
- [ ] 复核金额计算精度、过滤条件、聚合口径

**Acceptance criteria:**

- 计价、重算、汇总、偏差分析在真实数据库上可运行
- 金额口径与现有测试保持一致
- 相关查询不再依赖内存对象遍历

### Phase 4: Split API Composition and Harden Contracts

**Target:** 在功能稳定后降低 `create-app.ts` 的复杂度。

**Primary files and modules:**

- `apps/api/src/app/create-app.ts`
- `apps/api/src/app` 下新增路由注册/依赖装配文件
- `apps/api/src/modules/**`

- [ ] 将超大路由文件按领域拆分为模块注册器
- [ ] 将 repository/service 初始化逻辑从单文件中分离
- [ ] 明确 `api` 的依赖注入边界，减少默认路径隐式行为
- [ ] 补模块级测试，降低后续改动的回归成本

**Acceptance criteria:**

- `create-app.ts` 只保留启动装配职责
- 业务路由按领域拆分，可独立理解和维护
- 拆分后测试仍保持全绿

### Phase 5: Worker and Report Pipeline

**Target:** 让异步任务真正承接报表和重算流程。

**Primary files and modules:**

- `apps/worker/src/runtime/*`
- `apps/worker/src/jobs/*`
- `apps/api/src/modules/jobs/*`
- `apps/api/src/modules/reports/*`

- [ ] 明确任务创建、claim、执行、完成、失败的状态流
- [ ] 让报表导出任务在真实数据模式下可完整跑通
- [ ] 收口 `project_recalculate` 的真实执行路径
- [ ] 为失败信息、重试策略、监控日志预留扩展点

**Acceptance criteria:**

- `report_export` 任务能从 API 入队到 worker 完成
- `project_recalculate` 任务能在真实数据环境完成回写
- 任务列表与状态资源查询结果一致

### Phase 6: AI Runtime and Knowledge Persistence

**Target:** 稳定知识抽取和知识/记忆落库链路。

**Primary files and modules:**

- `apps/ai-runtime/app/runtime_service.py`
- `apps/ai-runtime/app/knowledge_pipeline.py`
- `apps/api/src/modules/knowledge/*`
- `apps/worker/src/runtime/ai-runtime-cli-client.ts`

- [ ] 固化 `knowledge_extraction` 任务的 payload 和 result 契约
- [ ] 将知识条目、记忆条目落库接入真实数据层
- [ ] 对齐 Python snake_case 输出与 TypeScript 侧持久化字段映射
- [ ] 补充基于审计日志触发抽取的端到端测试

**Acceptance criteria:**

- `audit log -> worker -> ai-runtime -> knowledge persistence` 全链路稳定
- 知识列表、记忆列表、搜索接口可基于真实数据运行
- AI 失败不会阻塞主业务流程

### Phase 7: MCP Gateway Contract Stabilization

**Target:** 让网关成为稳定的 AI 上下文入口。

**Primary files and modules:**

- `apps/mcp-gateway/src/app/create-app.ts`
- `apps/mcp-gateway/src/runtime/api-client.ts`
- `apps/mcp-gateway/test/app.test.ts`

- [ ] 固化 `capabilities`、`resource`、`tool_result` 返回结构
- [ ] 明确 `project-context` 的最小稳定字段和可选扩展字段
- [ ] 为知识摘要、任务摘要、单任务状态建立清晰的聚合边界
- [ ] 保证 gateway 测试覆盖所有稳定契约

**Acceptance criteria:**

- `mcp-gateway` 所有测试通过
- Agent 可稳定读取项目上下文、任务状态、知识摘要
- 网关不承担业务写入和业务规则决策

### Phase 8: Frontend Kickoff

**Target:** 在后端稳定后启动最小前端。

**Primary files and modules:**

- `apps/frontend/package.json`
- `apps/frontend` 下新增应用骨架
- 配套联调说明文档

- [ ] 初始化前端工程结构和基础路由
- [ ] 首批只实现项目列表/详情、阶段工作台、清单版本/清单树、汇总页
- [ ] 不在第一轮引入全部过程单据和 AI 面板
- [ ] 以前后端已稳定接口为准进行联调

**Acceptance criteria:**

- 前端可演示核心业务主链
- API 契约与页面数据需求闭环
- 后续功能页能在此基础上继续扩展

## Dependency Order

```text
Phase 0
  -> Phase 1
  -> Phase 2
  -> Phase 3
  -> Phase 4
  -> Phase 5
  -> Phase 6
  -> Phase 7
  -> Phase 8
```

允许局部并行的部分：

- `Phase 5` 和 `Phase 6` 可在 `Phase 3` 完成后部分并行
- `Phase 7` 可在 `Phase 6` 进行中并行收口
- `Phase 8` 只建议在 `Phase 2-3` 稳定后启动

## Risks and Controls

### Risk 1: Persistence migration breaks current tests

- 控制方式：先双轨保留接口层和仓储接口，再逐模块替换实现，不一次性推倒重来

### Risk 2: API file size continues to grow during migration

- 控制方式：持久化完成后立即进入 `Phase 4`，不把拆分无限后置

### Risk 3: Worker and API contracts drift apart

- 控制方式：以 `packages/job-contracts/src/index.ts` 为唯一任务契约源

### Risk 4: AI Runtime output shape drifts from TypeScript expectations

- 控制方式：端到端测试固定 payload/result 结构，避免“改一端忘一端”

### Risk 5: Frontend starts too early and drives unstable API churn

- 控制方式：前端启动严格依赖 `Phase 2-3` 的稳定完成

## Immediate Next Steps

- [ ] 先完成 `Phase 0`
- [ ] 在 `Phase 0` 结束后，为 `Phase 1` 单独写一份更细的持久化实施计划
- [ ] 在持久化技术方案确定前，不新增大块业务功能
- [ ] 在 `apps/frontend` 启动前，先确保 `api + worker + ai-runtime + mcp-gateway` 的基础契约稳定

## Definition of Ready for Implementation

进入正式开发前，至少满足以下条件：

- [ ] `npm test` 全绿
- [ ] `npm run typecheck` 全绿
- [ ] 持久化技术选型已定
- [ ] Phase 1 的子计划已写完
- [ ] 本地环境能稳定启动依赖服务

