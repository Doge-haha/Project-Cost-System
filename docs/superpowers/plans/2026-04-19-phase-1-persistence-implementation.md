# Phase 1 Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `apps/api` 建立真实数据库、事务和迁移骨架，让后续仓储替换可以逐模块推进而不破坏现有接口行为。

**Architecture:** 这一阶段先不一次性替换全部仓储，而是搭出持久化底座：数据库配置解析、连接工厂、事务 runner、schema/迁移脚手架和本地脚本。应用层继续保留现有仓储接口与内存实现，后续阶段按模块切换到数据库实现，避免大爆炸式迁移。

**Tech Stack:** TypeScript, PostgreSQL, Redis, pg, drizzle-orm, drizzle-kit, Fastify, Node.js test runner.

---

## Scope

本阶段只做“底座”，不做完整业务表替换。完成后应具备：

- `apps/api` 能解析数据库配置
- 能创建真实 PostgreSQL 连接
- 能用真实事务 runner 包裹业务操作
- 能在仓库中维护 schema 和迁移脚本
- 能通过脚本初始化本地数据库开发环境

本阶段不要求：

- 立刻把 `project` / `bill` / `quota` 仓储全部切到数据库
- 完成前端联调
- 接入 Redis 队列语义

## File Structure

### New files

- `apps/api/drizzle.config.ts`
  - Drizzle Kit 配置入口
- `apps/api/src/infrastructure/database/database-config.ts`
  - 解析和校验数据库环境变量
- `apps/api/src/infrastructure/database/database-client.ts`
  - 创建 `pg` pool 和 drizzle db 句柄
- `apps/api/src/infrastructure/database/schema.ts`
  - 第一批核心 schema 占位与通用表工具
- `apps/api/src/infrastructure/database/testing/fake-pg.ts`
  - 事务 runner 单测需要的最小 pg client/pool stub
- `apps/api/test/database-config.test.ts`
  - 数据库配置解析测试
- `apps/api/test/transaction-runner.test.ts`
  - 事务 runner 测试

### Modified files

- `apps/api/package.json`
  - 增加数据库依赖和脚本
- `apps/api/src/shared/tx/transaction.ts`
  - 从占位实现升级为“内联 + pg”双实现
- `README.md`
  - 补充 API 持久化准备命令
- `deploy/docker/docker-compose.dev.yml`
  - 如有必要补健康检查或开发说明

## Task 1: Database Dependency and Script Scaffolding

**Files:**
- Modify: `apps/api/package.json`
- Create: `apps/api/drizzle.config.ts`

- [ ] 添加 `pg`, `drizzle-orm`, `drizzle-kit` 依赖与脚本
- [ ] 约定 `db:generate`, `db:migrate`, `db:push` 三类脚本
- [ ] 确认 drizzle 配置从 `DATABASE_URL` 读取连接串

**Acceptance check:**

- `npm install` 后依赖解析成功
- `npm --workspace @saas-pricing/api run typecheck` 通过

## Task 2: Database Configuration Parser

**Files:**
- Create: `apps/api/src/infrastructure/database/database-config.ts`
- Test: `apps/api/test/database-config.test.ts`

- [ ] 先写失败测试，覆盖：
  - 缺少 `DATABASE_URL` 时报错
  - 可选 `DATABASE_MAX_CONNECTIONS` 默认值
  - 可选 `DATABASE_SSL_MODE` 解析
- [ ] 实现配置解析函数，返回稳定结构
- [ ] 保证错误信息可读，适合本地排查

**Acceptance check:**

- `node --import tsx --test test/database-config.test.ts`

## Task 3: Database Client Factory

**Files:**
- Create: `apps/api/src/infrastructure/database/database-client.ts`
- Modify: `apps/api/src/infrastructure/database/database-config.ts`

- [ ] 实现 PostgreSQL pool 创建函数
- [ ] 实现 drizzle db 创建函数
- [ ] 暴露关闭连接的方法，方便测试和后续 app shutdown

**Acceptance check:**

- `npm --workspace @saas-pricing/api run typecheck`

## Task 4: Transaction Runner Upgrade

**Files:**
- Modify: `apps/api/src/shared/tx/transaction.ts`
- Create: `apps/api/src/infrastructure/database/testing/fake-pg.ts`
- Test: `apps/api/test/transaction-runner.test.ts`

- [ ] 先写失败测试，覆盖：
  - `InlineTransactionRunner` 仍可直接运行
  - `PgTransactionRunner` 成功路径会 `BEGIN -> COMMIT`
  - 失败路径会 `BEGIN -> ROLLBACK`
- [ ] 实现 `PgTransactionRunner`
- [ ] 保持 `TransactionRunner` 接口不变，避免影响 `create-app.ts`

**Acceptance check:**

- `node --import tsx --test test/transaction-runner.test.ts`

## Task 5: Initial Schema and Migration Skeleton

**Files:**
- Create: `apps/api/src/infrastructure/database/schema.ts`
- Modify: `apps/api/drizzle.config.ts`

- [ ] 建一个最小 schema 文件，先放公共列工具和后续会扩展的第一批表定义占位
- [ ] 保证后续 `project`、`bill` 等模块有统一 schema 入口
- [ ] 先不迁业务逻辑，只把迁移脚手架打通

**Acceptance check:**

- `npm --workspace @saas-pricing/api run db:generate`

## Task 6: Documentation and Environment Sync

**Files:**
- Modify: `README.md`
- Modify: `deploy/docker/docker-compose.dev.yml`

- [ ] 补充 `DATABASE_URL` 推荐写法
- [ ] 补充 API 持久化阶段常用命令
- [ ] 保证开发环境说明和新脚本一致

**Acceptance check:**

- README 中的命令可直接复用

## Task 7: Full Verification

**Files:**
- Verify whole workspace

- [ ] 跑 API 聚焦测试
- [ ] 跑整仓测试
- [ ] 跑整仓类型检查

**Acceptance check:**

- `npm --workspace @saas-pricing/api test`
- `npm test`
- `npm run typecheck`

## Follow-up After This Phase

本阶段完成后，下一份子计划应是“Phase 2: Persist Project and Bill Core”，优先把下面这些模块切到数据库：

- `project`
- `project_stage`
- `project_member`
- `project_discipline`
- `bill_version`
- `bill_item`
- `bill_work_item`

