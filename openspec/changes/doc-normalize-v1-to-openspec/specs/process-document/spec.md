# Spec: 过程单据专题

## 概述

本 spec 定义新点 SaaS 造价系统中的过程单据专题规则，用于统一变更单、签证单、进度款等过程单据的类型边界、状态流转、金额影响和与正式造价版本的联动关系。

本 spec 主要整理自以下文档：

- [设计文档_v1.0_优化中.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/设计文档_v1.0_优化中.md)
- [state-machines.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/state-machines.md)

## ADDED Requirements

### Requirement: MUST 过程单据必须作为施工过程阶段的正式业务对象

MUST 变更单、签证单、进度款等过程单据必须作为施工过程中的正式业务对象管理，不能只以备注或临时字段方式存在。

#### Scenario: 创建过程单据

- **GIVEN** 用户在施工过程阶段处理造价变动
- **WHEN** 系统新增过程单据
- **THEN** 应以正式单据对象保存其类型、编号、金额和上下文

### Requirement: MUST 过程单据必须绑定明确的阶段和专业上下文

MUST 每条过程单据都必须绑定所属项目、阶段和专业上下文，确保可见范围、责任归属和后续联动一致。

#### Scenario: 查看过程单据

- **GIVEN** 用户查看某条过程单据
- **WHEN** 系统展示详情
- **THEN** 应能明确其所属项目、阶段和专业

### Requirement: MUST 过程单据必须支持草稿、提交、通过和驳回状态

MUST 过程单据必须具备至少草稿、已提交、已通过和已驳回等状态语义，用于支撑编制、审核和结果生效。

#### Scenario: 流转过程单据

- **GIVEN** 过程单据处于不同处理阶段
- **WHEN** 用户执行提交或审核动作
- **THEN** 系统应在草稿、提交、通过和驳回之间按规则流转

### Requirement: MUST 审批通过的过程单据才能影响正式结果

MUST 只有审批通过的过程单据才允许影响清单版本、汇总金额或结算结果，未通过单据不得作为正式变动依据。

#### Scenario: 使用过程单据影响结果

- **GIVEN** 某过程单据尚未通过
- **WHEN** 系统尝试将其纳入正式结果
- **THEN** 系统不应将该单据作为正式生效依据

### Requirement: MUST 施工过程阶段的新增或调整必须可追溯到过程单据

MUST 施工过程阶段发生新增项、调整项或重新测算时，必须能够追溯到对应过程单据。

#### Scenario: 追溯施工过程调整

- **GIVEN** 某施工过程结果与合同基线存在差异
- **WHEN** 用户查看来源链
- **THEN** 应能定位到对应变更单、签证单或进度款单据

### Requirement: MUST 过程单据通过后必须触发下游联动

MUST 过程单据审批通过后，系统必须触发清单变更版本生成、结果重算或汇总刷新等下游联动，而不是停留在孤立记录层。

#### Scenario: 审批通过过程单据

- **GIVEN** 某过程单据审核通过
- **WHEN** 系统完成状态切换
- **THEN** 应触发相应的版本或汇总联动

## Implementation Notes

以下内容是当前仓库实现现状的观察，不属于规范要求本身：

- `apps/api/src/modules/process/process-document-service.ts` 当前已支持 `change_order`、`site_visa`、`progress_payment` 三类单据的创建、查询和状态更新。
- 当前实现已返回 `isEditable`、`isReviewable` 等操作态字段，并按项目、阶段、专业进行权限过滤。
- 当前服务已对创建和状态变更写入审计日志，但与清单变更版本、结算视图和更细粒度联动仍属于后续实现。

这些现状说明过程单据已经具备基础专题骨架，但完整业务闭环仍高于当前实现范围。
