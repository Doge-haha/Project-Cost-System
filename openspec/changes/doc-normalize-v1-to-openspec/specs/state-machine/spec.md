# Spec: 状态机规则

## 概述

本 spec 定义新点 SaaS 造价系统核心业务对象的状态流转规则，用于统一项目、阶段、清单版本、审核提交、锁定解锁、过程单据和异步任务等对象的状态边界。

本 spec 主要整理自以下文档：

- [state-machines.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/state-machines.md)
- [workflow-and-form-engine-design.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/workflow-and-form-engine-design.md)
- [设计文档_v1.0_优化中.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/设计文档_v1.0_优化中.md)

本 spec 关注稳定状态语义，不直接限定具体数据库字段命名或 API 路径。

## ADDED Requirements

### Requirement: 核心对象必须存在单一主状态语义

每个核心业务对象必须存在一套单一主状态语义，不应让同一流程被多个互相冲突的状态字段重复表达。

#### Scenario: 定义对象状态

- **GIVEN** 系统为某个核心对象定义状态机
- **WHEN** 文档描述其主流程
- **THEN** 该对象应有清晰的主状态集合
- **AND** 状态跳转应由明确事件触发

### Requirement: 状态变化必须由显式事件触发

系统中的状态变化必须由提交、审核、锁定、解锁、归档等显式事件触发，不允许无依据的隐式跳转。

#### Scenario: 执行状态切换

- **GIVEN** 某对象处于既定状态
- **WHEN** 状态发生变化
- **THEN** 系统应能说明对应触发事件

### Requirement: 驳回后应回到最近可编辑状态

被驳回的业务对象原则上必须回到最近可编辑状态，而不是进入额外的模糊半状态。

#### Scenario: 审核驳回

- **GIVEN** 某对象已经提交审核
- **WHEN** 审核结果为驳回
- **THEN** 该对象应回到可编辑状态
- **AND** 驳回意见应被保留

### Requirement: 项目必须具备基本生命周期状态

项目至少必须支持以下生命周期语义：

- 草稿
- 执行中
- 审核中
- 已归档

#### Scenario: 项目启动

- **GIVEN** 项目已完成创建
- **WHEN** 首个已启用阶段开始执行
- **THEN** 项目应从草稿进入执行中

#### Scenario: 项目归档

- **GIVEN** 项目已完成业务处理或被明确归档
- **WHEN** 用户执行归档动作
- **THEN** 项目应进入归档态
- **AND** 默认只读

### Requirement: 阶段必须具备独立状态流转

项目阶段必须至少支持以下语义：

- 未开始
- 执行中
- 待审核
- 已通过
- 已完成
- 已跳过

#### Scenario: 提交阶段成果

- **GIVEN** 某阶段正在执行
- **WHEN** 阶段成果被提交审核
- **THEN** 阶段应进入待审核状态

#### Scenario: 阶段审核通过

- **GIVEN** 某阶段处于待审核
- **WHEN** 审核通过
- **THEN** 阶段应进入已通过
- **AND** 在完成流转动作后进入已完成

### Requirement: 清单版本必须具备独立审核状态

清单版本必须至少支持以下状态语义：

- 可编辑
- 已提交
- 已通过
- 已锁定
- 已驳回

#### Scenario: 提交清单版本

- **GIVEN** 某清单版本处于可编辑状态
- **WHEN** 用户发起审核提交
- **THEN** 该版本应进入已提交状态

#### Scenario: 通过后锁定

- **GIVEN** 某清单版本已审核通过
- **WHEN** 业务需要将其作为基线或只读成果
- **THEN** 系统应允许其进入锁定状态

### Requirement: 锁定与解锁必须具备独立流程语义

锁定与解锁必须被视为独立流程，至少应支持以下语义：

- 未锁定
- 已发起锁定申请
- 已锁定
- 已发起解锁申请

#### Scenario: 发起锁定申请

- **GIVEN** 某对象当前未锁定
- **WHEN** 用户发起锁定申请
- **THEN** 系统应记录其进入锁定申请中状态

#### Scenario: 锁定审批通过

- **GIVEN** 某对象处于锁定申请中
- **WHEN** 审批通过
- **THEN** 该对象应进入已锁定状态

### Requirement: 审核提交流必须具备独立记录状态

审核提交流必须作为独立记录管理，至少支持以下状态语义：

- 待审核
- 审核通过
- 审核驳回
- 已取消

#### Scenario: 创建审核提交

- **GIVEN** 用户对某资源发起审核
- **WHEN** 提交成功创建
- **THEN** 审核提交记录应进入待审核状态

#### Scenario: 取消审核提交

- **GIVEN** 某审核提交尚未被处理
- **WHEN** 用户撤销提交或流程失效
- **THEN** 审核提交记录应进入已取消状态

### Requirement: 过程单据必须仅在审批通过后生效

变更单、签证单、进度款等过程单据必须至少支持草稿、待审批、已通过、已驳回和已结清或已关闭等语义，并且只有审批通过后才能生效。

#### Scenario: 单据提交审批

- **GIVEN** 某过程单据处于草稿
- **WHEN** 用户提交审批
- **THEN** 单据应进入待审批状态

#### Scenario: 通过后影响主链

- **GIVEN** 某过程单据已审批通过
- **WHEN** 其金额或数量将影响主业务结果
- **THEN** 系统才应允许其影响清单版本、汇总或结算结果

### Requirement: 异步任务必须具备可追踪执行状态

报表导出、后台任务或类似异步处理必须具备排队中、处理中、已完成和失败等基础状态。

#### Scenario: 执行导出任务

- **GIVEN** 用户发起异步导出
- **WHEN** 任务被系统接收
- **THEN** 任务应先进入排队中
- **AND** 后续进入处理中、已完成或失败之一

### Requirement: 状态联动必须保持一致性

项目、阶段、清单版本、审核提交和锁定状态之间必须遵守一致的联动规则。

#### Scenario: 阶段提交联动

- **GIVEN** 某阶段的主清单版本提交审核
- **WHEN** 提交动作成功
- **THEN** 审核提交记录应进入待审核
- **AND** 清单版本应进入已提交
- **AND** 阶段应进入待审核
- **AND** 项目可进入审核中

#### Scenario: 驳回联动

- **GIVEN** 某阶段成果审核被驳回
- **WHEN** 驳回动作完成
- **THEN** 审核提交记录应进入已驳回
- **AND** 清单版本应回到可编辑
- **AND** 阶段应回到执行中

### Requirement: 所有关键状态切换必须可审计

以下关键状态切换必须写入审计记录：

- 项目归档
- 阶段启动、提交、通过、驳回、完成
- 清单版本提交、撤回、通过、驳回、锁定、解锁
- 审核提交创建、通过、驳回、取消
- 过程单据提交、通过、驳回
- 异步任务进入失败或完成

#### Scenario: 记录状态切换

- **GIVEN** 任一关键对象发生状态变化
- **WHEN** 该变化被系统接受
- **THEN** 系统应保留可追溯的审计记录

## Implementation Notes

以下内容是当前仓库实现现状的观察，不属于规范要求本身：

- `apps/api` 当前已有 `review-submission-service`，支持 `pending`、`approved`、`rejected`、`cancelled`。
- `apps/api` 当前 `BillVersionService` 已支持 `editable`、`submitted`、`locked` 等部分清单版本状态。
- `apps/api` 当前 `process-document-service` 已有 `draft`、`submitted`、`approved`、`rejected` 的过程单据状态骨架。
- `apps/api` 当前 `background-job-service` 已有 `queued`、`processing`、`completed`、`failed` 等异步任务状态。
- 当前代码中的项目和阶段状态仍比文档中的完整业务语义更简化。

这些现状说明状态机骨架已经存在，但完整业务语义应以前述规则为准。
