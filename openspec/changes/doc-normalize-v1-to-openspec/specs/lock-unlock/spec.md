# Spec: 锁定解锁专题

## 概述

本 spec 定义新点 SaaS 造价系统中的锁定解锁专题规则，用于统一合同基线锁定、解锁申请、锁定优先级、只读边界和锁定后唯一调整入口。

本 spec 主要整理自以下文档：

- [设计文档_v1.0_优化中.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/设计文档_v1.0_优化中.md)
- [permission-matrix.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/permission-matrix.md)
- [workflow-and-form-engine-design.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/workflow-and-form-engine-design.md)
- [state-machines.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/state-machines.md)

## ADDED Requirements

### Requirement: 合同基线类对象必须支持独立锁定状态

合同清单和其他基线类成果必须具备独立锁定状态，锁定状态与普通编辑状态分离但必须联动。

#### Scenario: 确认合同基线

- **GIVEN** 某合同清单已完成审核确认
- **WHEN** 用户执行锁定
- **THEN** 系统应将其置为正式锁定状态

### Requirement: 锁定优先级必须高于编辑权限

一旦资源进入锁定状态，锁定约束必须高于普通编辑权限，不能因为用户仍有编辑能力而绕过锁定。

#### Scenario: 已锁定资源尝试编辑

- **GIVEN** 用户对某资源具备编辑权限
- **WHEN** 该资源已处于锁定状态
- **THEN** 系统不应允许直接编辑

### Requirement: 锁定和解锁必须通过正式申请流转

正式锁定和正式解锁不得仅靠直接字段切换完成，而应通过明确的锁定申请或解锁申请流转。

#### Scenario: 发起解锁申请

- **GIVEN** 当前基线已锁定
- **WHEN** 用户申请解锁
- **THEN** 系统应创建正式解锁申请记录

### Requirement: 锁定后的直接修改必须统一返回受限语义

锁定后的修改类接口必须统一返回受限状态，前后端都应能识别这是“锁定导致不可写”而不是一般校验失败。

#### Scenario: 调用锁定后的写接口

- **GIVEN** 某正式版本已锁定
- **WHEN** 客户端调用修改接口
- **THEN** 系统应返回锁定受限语义

### Requirement: 锁定后所有调整必须转入后续正式入口

合同基线锁定后，后续造价调整必须通过过程单据、审核流或结算调整等正式入口进行，不得回写原基线。

#### Scenario: 锁定后发生业务调整

- **GIVEN** 合同基线已锁定
- **WHEN** 用户需要反映后续造价变化
- **THEN** 系统应引导改走过程单据或其他正式调整入口

### Requirement: 锁定和解锁通过后必须写审计并联动状态

锁定和解锁一旦通过，系统必须写入审计日志并联动版本状态、按钮显隐和页面只读行为。

#### Scenario: 锁定申请通过

- **GIVEN** 某锁定申请审核通过
- **WHEN** 系统完成处理
- **THEN** 应同步更新锁定状态
- **AND** 写入审计日志

## Implementation Notes

以下内容是当前仓库实现现状的观察，不属于规范要求本身：

- 当前仓库测试已覆盖“审核通过后清单版本进入 `locked`”的主线结果。
- `apps/api/src/modules/review/review-submission-service.ts` 当前已将审核通过与版本锁定联动起来。
- 当前仓库未见完整独立的锁定/解锁申请专题模块，说明正式的锁定流和解锁流仍主要依据文档和状态机口径推进。

这些现状说明锁定主语义已经在实现中出现，但完整锁定/解锁专题仍高于当前代码边界。
