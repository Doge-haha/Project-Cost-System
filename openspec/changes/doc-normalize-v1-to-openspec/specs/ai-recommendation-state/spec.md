# Spec: AI 推荐状态机专题

## 概述

本 spec 定义新点 SaaS 造价系统中的 AI 推荐状态机专题规则，用于统一推荐生成、接受、忽略、失效和上下文变化失效边界。

本 spec 主要整理自以下文档：

- [state-machines.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/state-machines.md)
- [iteration-5-task-breakdown.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/iteration-5-task-breakdown.md)
- [设计文档_v1.0_优化中.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/设计文档_v1.0_优化中.md)

## ADDED Requirements

### Requirement: AI 推荐必须从 generated 起始

AI 推荐一旦生成，初始状态必须是 `generated`，不能跳过待人工判断阶段直接进入终态。

#### Scenario: 生成推荐

- **GIVEN** 系统完成一次 AI 推荐
- **WHEN** 推荐结果被保存
- **THEN** 该推荐应进入 `generated`

### Requirement: 仅人工确认才能进入 accepted

只有经过人工明确确认的推荐结果，才能从 `generated` 进入 `accepted`。

#### Scenario: 接受推荐

- **GIVEN** 某推荐处于 `generated`
- **WHEN** 用户明确接受该推荐
- **THEN** 推荐应进入 `accepted`

### Requirement: 人工忽略必须进入 ignored

当用户决定不采用某推荐时，系统必须将该推荐置为 `ignored`，而不是简单删除。

#### Scenario: 忽略推荐

- **GIVEN** 某推荐处于 `generated`
- **WHEN** 用户明确忽略该推荐
- **THEN** 推荐应进入 `ignored`

### Requirement: 上下文变化必须使旧推荐进入 expired

当源清单版本、定额上下文、阶段或相关输入条件发生关键变化时，旧推荐必须失效并进入 `expired`。

#### Scenario: 上下文发生变化

- **GIVEN** 某推荐依赖的业务上下文已变化
- **WHEN** 系统检测到版本或上下文变更
- **THEN** 旧推荐应进入 `expired`

### Requirement: 终态推荐不得被直接改写回 generated

推荐进入 `accepted`、`ignored` 或 `expired` 之后，不得再直接改写回 `generated`，如需重新建议应生成新推荐记录。

#### Scenario: 重新生成建议

- **GIVEN** 某旧推荐已进入终态
- **WHEN** 系统需要给出新的建议
- **THEN** 应生成新的推荐记录而不是重置旧记录

## Implementation Notes

以下内容是当前仓库实现现状的观察，不属于规范要求本身：

- 当前状态机文档和迭代任务已明确 `generated -> accepted / ignored / expired` 的唯一主链。
- 当前仓库实现更偏向 AI runtime 预览和知识抽取底座，未见完整独立的 AI 推荐实体与状态流服务模块。
- 现有 AI Copilot 专题已经明确“不直写正式表”，这为推荐状态机落地提供了稳定前提。

这些现状说明 AI 推荐状态机规则已经很清楚，但正式推荐状态服务仍属于后续实现。
