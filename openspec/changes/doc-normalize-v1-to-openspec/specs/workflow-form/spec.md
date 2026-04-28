# Spec: 流程与表单配置规则

## 概述

本 spec 定义新点 SaaS 造价系统中流程配置与表单配置的稳定规则，用于统一流程引擎职责、表单 schema 边界、绑定规则和运行时实例口径。

本 spec 主要整理自以下文档：

- [workflow-and-form-engine-design.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/workflow-and-form-engine-design.md)
- [state-machines.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/state-machines.md)

## ADDED Requirements

### Requirement: MUST 流程引擎只负责流转，业务系统掌握业务真相

MUST 系统必须坚持流程引擎只负责“流程流转”，业务系统继续掌握业务主状态和业务事实。

#### Scenario: 执行审核流程

- **GIVEN** 某业务对象进入审核流程
- **WHEN** 流程节点流转
- **THEN** 流程层负责节点、待办和动作推进
- **AND** 业务对象主状态仍应由业务系统维护

### Requirement: MUST 清单和定额主编辑界面不得强行走通用表单引擎

MUST 清单、定额、汇总和报表等重表格业务不得强行放入通用流程表单渲染器，必须保留领域专用渲染体系。

#### Scenario: 渲染清单编辑页面

- **GIVEN** 用户打开清单编辑页面
- **WHEN** 系统决定渲染方式
- **THEN** 该页面应使用领域专用表格引擎
- **AND** 不应退化为通用表单引擎页面

### Requirement: MUST V1只支持可配置流程和可配置表单，不扩展成通用低代码平台

MUST V1 应支持流程模板、节点配置、审批人规则、节点表单配置和字段显隐只读必填等能力，但不应扩展成通用低代码平台。

#### Scenario: 定义V1能力边界

- **GIVEN** 团队规划流程配置能力
- **WHEN** 判断是否属于 V1
- **THEN** 可配置流程和表单属于 V1
- **AND** 拖拽式页面搭建器、通用脚本平台和跨系统编排不属于 V1

### Requirement: MUST 系统必须支持流程定义、版本、绑定和运行时实例分层

MUST 系统必须将流程能力至少分成以下层次：

- 流程定义
- 流程版本
- 流程绑定
- 流程实例
- 流程任务

#### Scenario: 发布新流程版本

- **GIVEN** 某流程定义存在多个版本
- **WHEN** 用户发布新版本
- **THEN** 只有已发布版本可供新实例使用
- **AND** 已运行实例不得随新版本漂移

### Requirement: MUST 流程绑定必须支持按业务条件命中

MUST 流程绑定必须允许至少按 `resource_type`、`stage_code`、`submission_type`、`project_type` 等维度命中合适流程。

#### Scenario: 命中锁定申请流程

- **GIVEN** 某业务对象发起锁定申请
- **WHEN** 系统查找适用流程
- **THEN** 系统应能按资源类型、阶段和提交类型命中对应绑定规则

### Requirement: MUST 表单配置必须拆分数据结构、UI布局和字段规则

MUST 系统必须将流程表单配置拆成至少三部分：

- 数据结构定义
- UI 布局定义
- 字段规则定义

#### Scenario: 配置审核表单

- **GIVEN** 某审核节点需要表单
- **WHEN** 系统定义该表单
- **THEN** 应分别表达字段结构、页面布局和字段权限规则

### Requirement: MUST 节点级字段权限必须可配置

MUST 系统必须允许在流程节点级别配置字段的显隐、只读、必填等规则。

#### Scenario: 审核节点显示字段

- **GIVEN** 某字段在提交节点可编辑
- **WHEN** 流程流转到审核节点
- **THEN** 该字段应可按节点规则变为只读、隐藏或必填

### Requirement: MUST 流程动作必须形成表单提交与任务记录

MUST 用户在流程中的提交、通过、驳回、撤回等动作必须形成可追溯的任务记录和表单提交记录。

#### Scenario: 提交变更单流程

- **GIVEN** 用户提交一张变更单
- **WHEN** 动作成功
- **THEN** 系统应保存相应表单提交记录
- **AND** 应创建或推进相应流程任务记录

## Implementation Notes

以下内容是当前仓库实现现状的观察，不属于规范要求本身：

- 当前仓库已有详细流程与表单设计文档，但完整的流程定义、绑定和表单引擎实现仍主要停留在架构设计层。
- `apps/api` 已有审核提交流、锁定流和过程单据状态主链，为后续流程引擎接入提供业务骨架。

这些现状说明流程边界已明确，但完整流程配置平台仍属于后续工程工作。
