# Spec: 价目版本与取费模板专题

## 概述

本 spec 定义新点 SaaS 造价系统中的价目版本与取费模板专题规则，用于统一项目默认绑定、筛选查询、切换重算、生效优先级和模板版本管理边界。

本 spec 主要整理自以下文档：

- [设计文档_v1.0_优化中.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/设计文档_v1.0_优化中.md)
- [iteration-3-jira-cards.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/iteration-3-jira-cards.md)

## ADDED Requirements

### Requirement: 项目必须支持绑定默认价目版本和默认取费模板

项目层必须支持绑定默认价目版本和默认取费模板，作为后续计价和页面展示的默认配置来源。

#### Scenario: 初始化项目计价配置

- **GIVEN** 用户创建或维护项目
- **WHEN** 系统保存项目默认计价配置
- **THEN** 应能绑定默认价目版本和默认取费模板

### Requirement: 价目版本必须支持按地区和专业筛选

价目版本查询必须至少支持按地区、专业和状态筛选，以匹配项目实际取价场景。

#### Scenario: 查询价目版本

- **GIVEN** 用户在项目中切换价目版本
- **WHEN** 用户筛选候选列表
- **THEN** 系统应支持按地区、专业和状态过滤

### Requirement: 取费模板必须支持按地区、项目类型和阶段筛选

取费模板查询必须至少支持按地区、项目类型、阶段和状态筛选，以命中正确计费规则。

#### Scenario: 查询取费模板

- **GIVEN** 用户在项目中选择取费模板
- **WHEN** 系统列出候选模板
- **THEN** 应支持按地区、项目类型、阶段和状态过滤

### Requirement: 切换价目版本或取费模板必须触发结果重算

当项目或阶段切换价目版本或取费模板时，系统必须触发受影响结果重算或进入待重算状态。

#### Scenario: 切换项目默认配置

- **GIVEN** 用户切换默认价目版本或默认取费模板
- **WHEN** 保存变更
- **THEN** 系统应触发相应重算或标记受影响结果待重算

### Requirement: 取费规则命中必须遵循明确优先级

当存在多条可能命中的取费规则时，系统必须按明确优先级选择生效规则，并在冲突时提示确认。

#### Scenario: 命中多条取费规则

- **GIVEN** 存在项目专属、地区和系统默认等多条取费规则
- **WHEN** 系统解析生效规则
- **THEN** 应按既定优先级命中最终规则

### Requirement: 已被引用的模板不得被直接删除覆盖

已被项目引用的价目版本或取费模板不得被直接删除或无痕覆盖，应通过停用或生成新版本方式维护。

#### Scenario: 修改已引用模板

- **GIVEN** 某模板已被项目正式引用
- **WHEN** 用户尝试删除或覆盖
- **THEN** 系统不应直接破坏历史绑定

## Implementation Notes

以下内容是当前仓库实现现状的观察，不属于规范要求本身：

- `apps/api/src/modules/pricing/price-version-service.ts` 当前已支持按 `regionCode`、`disciplineCode` 和 `status` 查询价目版本。
- `apps/api/src/modules/fee/fee-template-service.ts` 当前已支持按 `regionCode`、`projectType`、`stageCode` 和 `status` 查询取费模板，并可读取模板规则明细。
- `apps/api/src/modules/project/project-service.ts` 当前已支持项目默认价目版本和默认取费模板绑定，并会在变更时写入审计日志。

这些现状说明价目与取费配置主线已经具备查询和默认绑定骨架，但完整版本化管理、切换联动和前端专题体验仍属于后续实现。
