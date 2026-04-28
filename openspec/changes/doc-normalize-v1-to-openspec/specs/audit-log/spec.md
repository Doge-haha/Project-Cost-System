# Spec: 审计日志专题

## 概述

本 spec 定义新点 SaaS 造价系统中的审计日志专题规则，用于统一关键动作留痕、多态资源关联、前后状态快照和过滤查询边界。

本 spec 主要整理自以下文档：

- [设计文档_v1.0_优化中.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/设计文档_v1.0_优化中.md)
- [data-model.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/data-model.md)
- [iteration-4-task-breakdown.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/iteration-4-task-breakdown.md)

## ADDED Requirements

### Requirement: MUST 所有关键状态切换必须写入审计日志

MUST 项目、阶段、清单版本、审核流、过程单据、导出任务和 AI 接受类关键动作都必须写入审计日志。

#### Scenario: 执行关键业务动作

- **GIVEN** 用户或系统执行关键状态切换或关键业务动作
- **WHEN** 动作成功生效
- **THEN** 系统应写入对应审计日志

### Requirement: MUST 审计日志必须采用多态资源关联

MUST 审计日志必须能关联不同类型资源，而不是为每类资源单独维护互不统一的日志结构。

#### Scenario: 记录资源变更

- **GIVEN** 系统需要记录不同业务资源的变更
- **WHEN** 写入审计日志
- **THEN** 日志应包含统一的资源类型和资源标识

### Requirement: MUST 审计日志必须保留操作者和时间

MUST 每条正式审计日志都必须保留操作者、项目上下文和创建时间，以支撑追溯和责任判定。

#### Scenario: 查看审计记录

- **GIVEN** 用户查看某条审计日志
- **WHEN** 系统展示记录
- **THEN** 应能看到操作者、项目上下文和发生时间

### Requirement: MUST 审计日志应支持前后状态快照

MUST 对更新类动作，审计日志应尽量保留变更前和变更后的结构化快照，而不是只留一段描述性文本。

#### Scenario: 记录更新动作

- **GIVEN** 某资源发生更新
- **WHEN** 系统写入审计日志
- **THEN** 应能保留前后快照或等价结构化信息

### Requirement: MUST 审计日志必须支持按资源和时间过滤查询

MUST 审计日志查询必须至少支持按资源类型、资源标识、动作、操作者和时间范围过滤。

#### Scenario: 过滤审计日志

- **GIVEN** 用户需要定位某资源的历史变更
- **WHEN** 用户设置筛选条件
- **THEN** 系统应支持按资源和时间等条件过滤

### Requirement: MUST 审计日志必须受项目可见权限控制

MUST 审计日志虽然用于追溯，但仍必须受项目可见范围和日志查看权限约束，不能向无权用户暴露。

#### Scenario: 无权限用户查看日志

- **GIVEN** 用户不具备项目可见权限
- **WHEN** 用户尝试查看审计日志
- **THEN** 系统应拒绝访问

## Implementation Notes

以下内容是当前仓库实现现状的观察，不属于规范要求本身：

- `apps/api/src/modules/audit/audit-log-service.ts` 当前已支持按项目、资源类型、资源标识、动作、操作者和时间范围过滤日志。
- `apps/api/src/modules/audit/audit-log-repository.ts` 当前已定义统一的 `resourceType`、`resourceId`、`action`、`operatorId`、`beforePayload`、`afterPayload` 结构。
- 当前仓库多条主链服务已经接入审计日志写入，但审计日志专题页和更丰富的审计分析能力仍主要停留在文档设计层。

这些现状说明审计日志底座已经存在，并且已经是统一能力，而不是零散附属实现。
