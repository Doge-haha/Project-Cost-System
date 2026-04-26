# Spec: 权限按钮显隐规则

## 概述

本 spec 定义新点 SaaS 造价系统前端按钮显隐与只读态的规则，用于统一页面操作入口如何同时受权限、状态和锁定条件约束。

本 spec 主要整理自以下文档：

- [permission-matrix.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/permission-matrix.md)
- [state-machines.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/state-machines.md)

## ADDED Requirements

### Requirement: 按钮显隐必须同时受权限和状态约束

前端按钮是否可见或可用，必须同时受用户权限和当前业务状态约束，不能只依据其中一项决定。

#### Scenario: 判断提交按钮

- **GIVEN** 用户进入某业务页面
- **WHEN** 页面判断是否显示“提交审核”
- **THEN** 必须同时判断用户是否具备 `submit` 能力
- **AND** 当前对象是否处于可提交状态

### Requirement: 锁定状态必须优先抑制编辑类按钮

当版本、父对象或资源处于锁定状态时，编辑类按钮必须被禁用或隐藏，即使用户本身具备编辑权限。

#### Scenario: 查看清单编辑按钮

- **GIVEN** 用户具备 `bill:edit` 权限
- **WHEN** 当前版本已锁定
- **THEN** 添加、编辑、删除等修改类按钮不应继续可用

### Requirement: 审核按钮必须只在审核态向审核人开放

审核通过、审核驳回等按钮必须只在对象进入待审核状态时，向具备审核权限的用户开放。

#### Scenario: 显示审核动作

- **GIVEN** 某阶段处于 `pending_review`
- **WHEN** 页面为审核人渲染操作区
- **THEN** 才应显示审核通过和驳回按钮

### Requirement: 页面只读态必须有统一触发条件

当前阶段待审核、当前版本锁定、项目归档或用户只有只读权限时，页面应整体进入只读态。

#### Scenario: 项目归档后访问页面

- **GIVEN** 项目已经归档
- **WHEN** 用户进入相关业务页面
- **THEN** 页面应整体只读

### Requirement: 工作内容和从属对象按钮必须继承父对象限制

工作内容、定额行等从属对象的按钮显隐，必须继承父清单项或父版本的状态限制。

#### Scenario: 查看工作内容新增按钮

- **GIVEN** 用户具备 `bill_work_item:edit` 权限
- **WHEN** 父清单行已锁定
- **THEN** “添加工作内容”按钮不应可用

### Requirement: 导出类按钮必须映射独立导出权限

报表导出、批量导出和类似输出按钮必须映射独立导出权限，而不是默认等同于查看权限。

#### Scenario: 显示导出报表按钮

- **GIVEN** 用户可以查看报表页面
- **WHEN** 页面判断是否显示导出动作
- **THEN** 仍应校验其是否具备 `report:export` 或等价导出权限

### Requirement: AI相关按钮必须区分查看与接受权限

AI 推荐面板中的查看、接受、忽略和写正式数据按钮必须区分权限，不得对只读用户暴露写入动作。

#### Scenario: 审核员查看AI推荐

- **GIVEN** 某用户只能查看 AI 推荐
- **WHEN** 页面渲染 AI 面板
- **THEN** 可显示查看入口
- **AND** 不应显示接受并写正式数据的按钮

## Implementation Notes

以下内容是当前仓库实现现状的观察，不属于规范要求本身：

- 当前仓库已有权限矩阵文档中关于按钮显隐和页面只读态的明确建议。
- 当前前端实现仍处于工作台骨架阶段，完整按钮显隐逻辑尚未全部落齐。

这些现状说明按钮规则已具备稳定口径，但完整落地仍属于后续前端实现工作。
