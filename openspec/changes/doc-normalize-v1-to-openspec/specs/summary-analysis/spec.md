# Spec: 汇总分析专题

## 概述

本 spec 定义新点 SaaS 造价系统中的汇总分析专题规则，用于统一多维汇总、偏差分析、版本对比、风险提示和汇总视图边界。

本 spec 主要整理自以下文档：

- [设计文档_v1.0_优化中.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/设计文档_v1.0_优化中.md)
- [iteration-4-jira-cards.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/iteration-4-jira-cards.md)

## ADDED Requirements

### Requirement: MUST 汇总页必须支持多维度查看结果

MUST 汇总页必须至少支持按项目、阶段、专业、单体和费用结构等维度查看结果，不得将正式汇总能力限制为单一视角。

#### Scenario: 切换汇总视角

- **GIVEN** 用户进入汇总页
- **WHEN** 用户切换查看维度
- **THEN** 系统应支持项目、阶段、专业、单体或费用结构视角

### Requirement: MUST 汇总结果必须基于明确版本上下文

MUST 每次汇总和分析都必须绑定明确的数据版本、筛选条件和统计范围，以保证结果可解释和可追溯。

#### Scenario: 查看汇总结果

- **GIVEN** 用户查看某次汇总数据
- **WHEN** 系统展示结果
- **THEN** 应能说明所属项目、版本或筛选范围

### Requirement: MUST 偏差分析必须支持核心阶段对比

MUST 系统必须支持估算、目标、合同、过程和结算等核心阶段之间的偏差分析，用于识别成本偏离。

#### Scenario: 查看阶段偏差

- **GIVEN** 项目存在多个阶段结果
- **WHEN** 用户打开偏差分析
- **THEN** 系统应支持核心阶段之间的差异比较

### Requirement: MUST 超阈值偏差必须形成风险提示

MUST 当偏差超过预设阈值时，系统必须在汇总视图中形成风险提示，并允许用户下钻定位来源。

#### Scenario: 偏差超阈值

- **GIVEN** 某项偏差超过阈值
- **WHEN** 系统刷新汇总结果
- **THEN** 汇总页应标识风险
- **AND** 应支持跳转查看明细来源

### Requirement: MUST 汇总分析必须支持版本对比

MUST 汇总分析必须支持对两个版本进行同口径对比，以帮助识别引用、变更或重算带来的结果差异。

#### Scenario: 比较两个版本

- **GIVEN** 用户选择基准版本和目标版本
- **WHEN** 系统执行对比
- **THEN** 应按同一项编码或同一口径输出差异结果

### Requirement: MUST 汇总指标必须区分系统结果与最终结果

MUST 若系统存在人工调价或人工修正，汇总指标必须能够区分系统结果和最终结果，避免偏差分析失真。

#### Scenario: 查看汇总指标

- **GIVEN** 项目中存在人工调整
- **WHEN** 汇总页展示金额指标
- **THEN** 系统应支持区分系统金额和最终金额

## Implementation Notes

以下内容是当前仓库实现现状的观察，不属于规范要求本身：

- `apps/api/src/modules/reports/summary-service.ts` 当前已实现项目级汇总、偏差明细和版本对比骨架。
- 当前实现可返回 `totalSystemAmount`、`totalFinalAmount`、`varianceAmount`、`varianceRate` 等基础指标。
- 当前仓库中的报表导出任务已复用汇总查询结果，但完整图表分析、风险提示区和多表格展示仍主要停留在文档设计层。

这些现状说明汇总分析主链已经具备基础接口能力，但完整管理视图和专题体验仍待后续实现。
