# Spec: AI Copilot 交互专题

## 概述

本 spec 定义新点 SaaS 造价系统中的 AI Copilot 交互专题规则，用于统一 AI 推荐面板、人工确认、失败降级、推荐不直写正式表和交互入口边界。

本 spec 主要整理自以下文档：

- [设计文档_v1.0_优化中.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/设计文档_v1.0_优化中.md)
- [iteration-5-task-breakdown.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/iteration-5-task-breakdown.md)
- [ai-native-architecture-review.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/ai-native-architecture-review.md)

## ADDED Requirements

### Requirement: MUST AI Copilot 只能作为辅助交互层存在

MUST AI Copilot 的定位必须是辅助推荐、预警和解释，而不是绕过业务规则直接执行正式写操作。

#### Scenario: 触发AI推荐

- **GIVEN** 用户在清单、定额或审核场景中触发 AI 能力
- **WHEN** 系统返回结果
- **THEN** 结果应作为辅助建议呈现

### Requirement: MUST AI 推荐不得直接改写正式业务表

MUST AI 推荐在未经过人工确认前，不得直接写入正式清单、定额或审核结论。

#### Scenario: 生成推荐结果

- **GIVEN** 系统已生成 AI 推荐
- **WHEN** 用户尚未确认
- **THEN** 系统不得直接改写正式业务对象

### Requirement: MUST AI 交互必须支持人工接受、忽略和失效

MUST AI 推荐结果必须支持人工接受、忽略和失效等状态流转，以反映人工判断和上下文过期。

#### Scenario: 处理AI推荐

- **GIVEN** 某条 AI 推荐已生成
- **WHEN** 用户处理该推荐
- **THEN** 系统应支持接受、忽略或失效等处理结果

### Requirement: MUST AI 失败必须降级而不阻断人工主流程

MUST AI 调用失败、超时或返回异常时，不得阻断人工主流程，应提示稍后重试并允许继续手工处理。

#### Scenario: AI推荐失败

- **GIVEN** AI 服务调用失败
- **WHEN** 用户仍需继续业务处理
- **THEN** 系统应降级提示而不阻断主流程

### Requirement: MUST AI Copilot 必须提供明确上下文来源

MUST 每次 AI 交互都必须基于明确上下文来源，例如清单特征、定额候选、偏差结果或审计日志，而不是无约束自由生成。

#### Scenario: 查看推荐依据

- **GIVEN** 用户查看某条 AI 推荐
- **WHEN** 系统展示推荐信息
- **THEN** 应能说明其主要输入上下文或依据摘要

## Implementation Notes

以下内容是当前仓库实现现状的观察，不属于规范要求本身：

- `apps/api/src/modules/ai/ai-runtime-preview-service.ts` 当前已支持通过独立 CLI 入口做 AI runtime 预览调用。
- `apps/api/src/app/register-project-routes.ts` 当前已提供 AI 预览、知识抽取任务和从审计日志抽取的相关路由。
- 当前实现更偏向 AI runtime 和知识抽取底座，完整的“AI 清单 Copilot / AI 定额 Copilot / AI 审核 Copilot”交互面板仍主要停留在产品与迭代设计层。

这些现状说明 AI 交互基础能力已经存在，但完整 Copilot 交互专题仍需要上层业务界面和状态管理配合。
