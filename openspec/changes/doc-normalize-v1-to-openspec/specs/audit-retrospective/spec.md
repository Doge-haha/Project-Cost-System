# Spec: 审计复盘专题

## 概述

本 spec 定义新点 SaaS 造价系统中的审计复盘专题规则，用于统一项目复盘、差异归因、指标提取、知识沉淀和经验回流边界。

本 spec 主要整理自以下文档：

- [设计文档_v1.0_优化中.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/设计文档_v1.0_优化中.md)
- [data-model.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/data-model.md)
- [knowledge-and-memory-architecture.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/knowledge-and-memory-architecture.md)
- [ai-native-architecture-review.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/ai-native-architecture-review.md)

## ADDED Requirements

### Requirement: 项目复盘必须作为正式阶段承接结果回收

项目复盘必须作为正式业务阶段存在，用于承接结算后的差异分析、经验总结和资产沉淀。

#### Scenario: 进入复盘阶段

- **GIVEN** 项目已完成主要执行和结算工作
- **WHEN** 系统进入复盘阶段
- **THEN** 应允许围绕差异、指标和经验开展正式复盘

### Requirement: 复盘必须基于可追溯事实而不是纯文本总结

正式复盘结论必须建立在版本链、审核记录、审计日志、偏差结果和过程单据等可追溯事实之上。

#### Scenario: 生成复盘结论

- **GIVEN** 用户或系统准备形成复盘结论
- **WHEN** 组织复盘材料
- **THEN** 应能够追溯到具体业务事实来源

### Requirement: 复盘必须支持指标提取和模式归纳

项目复盘不应只产出报告文本，还必须支持提取结构化指标、差异模式和经验规则。

#### Scenario: 提取复盘知识

- **GIVEN** 项目存在可复用经验
- **WHEN** 系统执行知识提取
- **THEN** 应能形成结构化指标或知识条目

### Requirement: 复盘知识必须进入统一知识沉淀链路

复盘得到的知识结论必须进入统一知识沉淀链路，与审核经验、异常模式和 AI 反馈一起复用。

#### Scenario: 持久化复盘知识

- **GIVEN** 某条复盘结论被确认有效
- **WHEN** 系统保存该结论
- **THEN** 应进入统一知识条目体系

### Requirement: 复盘结果必须服务后续项目引用

项目复盘的目标之一是支持后续项目复用，因此复盘结果必须能被检索、过滤和引用，而不是只保存在单项目附件里。

#### Scenario: 后续项目检索经验

- **GIVEN** 新项目需要参考历史经验
- **WHEN** 用户或 AI 检索历史知识
- **THEN** 应能命中来自复盘阶段的有效结论

## Implementation Notes

以下内容是当前仓库实现现状的观察，不属于规范要求本身：

- `apps/api/src/modules/knowledge/knowledge-service.ts` 当前已支持知识条目和记忆条目的读取、搜索与抽取结果持久化。
- `apps/worker/src/jobs/knowledge-extraction-worker.ts` 当前已具备知识抽取后台任务骨架，可承接来自审计日志等来源的抽取任务。
- 当前实现更接近“复盘知识沉淀能力底座”，但完整独立的项目复盘阶段页面、复盘报告编排和复盘工作流仍主要停留在文档设计层。

这些现状说明审计复盘的下层能力已经存在，但完整复盘专题还需要更上层业务实现配合。
