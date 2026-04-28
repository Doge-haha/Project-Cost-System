# Spec: 项目成员与角色专题

## 概述

本 spec 定义新点 SaaS 造价系统中的项目成员与角色专题规则，用于统一平台角色、项目成员、业务身份、作用范围和成员授权边界。

本 spec 主要整理自以下文档：

- [设计文档_v1.0_优化中.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/设计文档_v1.0_优化中.md)
- [permission-matrix.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/permission-matrix.md)
- [iteration-1-task-breakdown.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/iteration-1-task-breakdown.md)

## ADDED Requirements

### Requirement: MUST 平台角色和项目成员授权必须分层

MUST 平台角色决定能进入哪些模块，项目成员配置决定能否进入某个项目以及能操作哪些范围，二者不得混成单一概念。

#### Scenario: 判断用户能否进入项目

- **GIVEN** 某用户具备平台角色
- **WHEN** 系统判断其是否能访问某项目
- **THEN** 仍应校验项目成员配置和作用范围

### Requirement: MUST 项目成员必须支持阶段和专业等范围限定

MUST 项目成员授权必须至少支持项目、阶段、专业和单体等范围限定，以满足细粒度协作分工。

#### Scenario: 配置成员范围

- **GIVEN** 项目需要细分协作边界
- **WHEN** 用户配置项目成员
- **THEN** 应能限定其阶段、专业或单体范围

### Requirement: MUST 成员配置必须支持系统角色和业务身份并存

MUST 正式成员配置必须同时承载系统角色和业务身份语义，避免只有权限没有业务语境。

#### Scenario: 查看成员信息

- **GIVEN** 用户查看某项目成员
- **WHEN** 系统展示成员配置
- **THEN** 应能看到其系统角色和业务身份信息

### Requirement: MUST 项目负责人必须自动纳入项目成员体系

MUST 项目负责人不能游离于项目成员体系之外，项目创建或负责人切换后必须体现在项目成员配置中。

#### Scenario: 创建项目并指定负责人

- **GIVEN** 用户创建新项目
- **WHEN** 系统保存项目负责人
- **THEN** 该负责人应自动成为项目成员

### Requirement: MUST 审核人与编制人必须允许分离配置

MUST 成员体系必须支持审核人与编制人分离配置，以承接后续审核流和审编分离要求。

#### Scenario: 配置审核成员

- **GIVEN** 项目存在审核阶段
- **WHEN** 用户配置成员职责
- **THEN** 系统应支持将审核职责与编制职责分离

## Implementation Notes

以下内容是当前仓库实现现状的观察，不属于规范要求本身：

- `apps/api/src/modules/project/project-member-repository.ts` 当前已支持读取项目成员以及 `project/stage/discipline/unit` 级别的范围配置。
- `apps/api/src/modules/project/project-authorization-service.ts` 当前已基于角色策略和成员范围做查看/编辑权限判断。
- 当前仓库已有 `/v1/projects/:projectId/members` 读取入口，但完整的成员维护与业务身份编辑体验仍主要体现于文档设计中。

这些现状说明成员与角色底座已经具备，但完整配置专题仍高于当前实现范围。
