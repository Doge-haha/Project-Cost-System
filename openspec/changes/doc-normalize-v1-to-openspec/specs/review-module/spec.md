# Spec: 审核模块专题

## 概述

本 spec 定义新点 SaaS 造价系统中的审核模块专题规则，用于统一提交审核、通过、驳回、撤回、审编分离和资源状态联动边界。

本 spec 主要整理自以下文档：

- [设计文档_v1.0_优化中.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/设计文档_v1.0_优化中.md)
- [iteration-4-task-breakdown.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/iteration-4-task-breakdown.md)
- [state-machines.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/state-machines.md)

## ADDED Requirements

### Requirement: 正式成果必须通过审核提交流进入审核流

清单版本、阶段成果或其他正式业务成果在进入审核前，必须先形成明确的审核提交流对象，而不是直接修改资源终态。

#### Scenario: 提交审核

- **GIVEN** 用户准备提交正式成果
- **WHEN** 用户执行提交动作
- **THEN** 系统应创建正式审核提交流记录

### Requirement: 审核流必须支持待审核、通过、驳回和撤回

审核流必须至少支持待审核、通过、驳回和撤回等状态语义，以承载完整的审核决策过程。

#### Scenario: 审核状态流转

- **GIVEN** 某审核提交流处于处理中
- **WHEN** 审核人或提交人执行相应动作
- **THEN** 系统应在待审核、通过、驳回和撤回之间按规则切换

### Requirement: 审核人与提交人必须分离

审核人不得审核自己提交的成果，系统必须显式落实审编分离。

#### Scenario: 提交人尝试审核自己

- **GIVEN** 某用户既是提交人又尝试执行审核
- **WHEN** 系统校验动作权限
- **THEN** 应拒绝该审核操作

### Requirement: 同一资源不得并存多个待审核记录

同一正式资源在已有待审核记录时，不得重复提交新的待审核记录，以避免状态冲突。

#### Scenario: 重复提交审核

- **GIVEN** 某资源已经存在待审核记录
- **WHEN** 用户再次提交审核
- **THEN** 系统应拒绝重复提交

### Requirement: 审核通过或驳回必须联动资源状态

审核通过或驳回后，系统必须联动更新对应资源、阶段或项目状态，避免出现审核结论与业务状态脱节。

#### Scenario: 审核通过成果

- **GIVEN** 某成果审核通过
- **WHEN** 系统完成审核动作
- **THEN** 对应资源和上层状态应同步推进

#### Scenario: 审核驳回成果

- **GIVEN** 某成果被驳回
- **WHEN** 系统完成驳回动作
- **THEN** 对应资源应回到可编辑态
- **AND** 保留驳回意见

### Requirement: 撤回只允许发生在未审核终态前

撤回动作只能发生在待审核阶段，已经通过或驳回的记录不得再被撤回改写。

#### Scenario: 撤回已终态记录

- **GIVEN** 某审核记录已通过或驳回
- **WHEN** 用户尝试撤回
- **THEN** 系统应拒绝撤回

## Implementation Notes

以下内容是当前仓库实现现状的观察，不属于规范要求本身：

- `apps/api/src/modules/review/review-submission-service.ts` 当前已支持审核提交、查询、通过、驳回和撤回骨架。
- 当前实现已限制“仅 `submitted` 的清单版本才能进入审核”，并防止同一版本出现重复 `pending` 审核。
- 当前返回结果中已包含 `canApprove`、`canReject`、`canCancel` 等动作态字段，并已记录审计日志。

这些现状说明审核流主线已经具备基础闭环，但更广泛的资源类型、锁定申请和多级审核仍属于后续扩展范围。
