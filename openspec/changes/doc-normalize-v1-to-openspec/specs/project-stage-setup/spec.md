# Spec: 项目创建与阶段配置专题

## 概述

本 spec 定义新点 SaaS 造价系统中的项目创建与阶段配置专题规则，用于统一项目创建、模板展开、阶段启用顺序、负责人初始化和默认业务参数绑定。

本 spec 主要整理自以下文档：

- [设计文档_v1.0_优化中.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/设计文档_v1.0_优化中.md)
- [iteration-1-task-breakdown.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/iteration-1-task-breakdown.md)
- [iteration-1-jira-cards.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/iteration-1-jira-cards.md)

## ADDED Requirements

### Requirement: 项目创建必须以阶段模板为起点

新项目创建必须从阶段模板或自定义模板展开，而不是让阶段链路完全从空白状态手工拼装。

#### Scenario: 创建新项目

- **GIVEN** 用户开始创建项目
- **WHEN** 用户选择阶段模板
- **THEN** 系统应按模板展开默认阶段链路

### Requirement: 阶段启用和顺序必须可按项目单独调整

即使来源于模板，启用阶段、阶段顺序和阶段负责人也必须允许在项目层按需调整。

#### Scenario: 调整项目阶段配置

- **GIVEN** 模板已展开默认阶段
- **WHEN** 用户编辑阶段配置
- **THEN** 系统应允许调整启用状态、顺序和负责人

### Requirement: 项目创建时必须初始化关键默认参数

项目创建或项目初始化时，系统必须能够绑定默认审核人、默认价目版本、默认取费模板或其他关键业务参数。

#### Scenario: 保存项目初始化参数

- **GIVEN** 用户填写项目基础信息
- **WHEN** 系统完成保存
- **THEN** 应一并保存关键默认业务参数

### Requirement: 需要审核的阶段必须具备审核责任人配置

若项目启用了需要审核的阶段，则必须存在审核责任人或等价审核配置，避免流程断点。

#### Scenario: 启用需要审核的阶段

- **GIVEN** 某阶段需要审核
- **WHEN** 用户保存阶段配置
- **THEN** 系统应校验审核责任配置是否完整

### Requirement: 项目创建完成后必须进入统一工作台

项目创建完成后，系统应将用户带入统一工作台，而不是停留在孤立配置表单。

#### Scenario: 完成创建流程

- **GIVEN** 用户已完成项目创建
- **WHEN** 系统返回创建结果
- **THEN** 用户应能继续进入项目工作台

## Implementation Notes

以下内容是当前仓库实现现状的观察，不属于规范要求本身：

- 当前仓库已有项目、阶段和成员等基础模型，并支持项目默认价目版本与默认取费模板绑定。
- `apps/api/src/modules/project/project-service.ts` 当前主要覆盖项目读取和默认计价配置更新，完整的“模板展开式创建流程”仍更多体现在文档和路由设计中。
- 文档中已经明确 `POST /api/v1/projects`、`GET/PUT /api/v1/projects/:id/stages` 和工作台聚合接口的主流程关系。

这些现状说明项目启动链路已经具备数据基础，但完整的创建与阶段配置体验仍需靠专题实现收口。
