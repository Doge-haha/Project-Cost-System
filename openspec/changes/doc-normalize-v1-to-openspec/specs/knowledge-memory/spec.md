# Spec: 知识与记忆沉淀规则

## 概述

本 spec 定义新点 SaaS 造价系统中知识沉淀层与系统记忆层的边界、来源和使用规则，用于统一可迁移经验、上下文偏好和 AI 长期增智的数据口径。

本 spec 主要整理自以下文档：

- [knowledge-and-memory-architecture.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/knowledge-and-memory-architecture.md)
- [mcp-capability-design.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/mcp-capability-design.md)

## ADDED Requirements

### Requirement: MUST 系统必须区分知识与记忆

MUST 系统必须明确区分“知识”和“记忆”两类沉淀对象。

- `knowledge` 表示可复用、可迁移、跨项目仍有价值的稳定经验。
- `memory` 表示与特定用户、项目、组织或流程相关、可变化的上下文偏好和历史痕迹。

#### Scenario: 判断沉淀对象类型

- **GIVEN** 某条业务结论需要沉淀
- **WHEN** 系统判断其归属
- **THEN** 若其具备跨项目复用价值，应归为知识
- **AND** 若其主要反映当前上下文偏好或局部习惯，应归为记忆

### Requirement: MUST 知识与记忆不得混写

MUST 系统不得把通用知识和局部记忆混在同一沉淀层中，以避免普适规律被局部偏好污染。

#### Scenario: 沉淀审核经验

- **GIVEN** 某条审核经验来自多个项目反复出现的共性规律
- **WHEN** 系统保存该内容
- **THEN** 应将其沉淀为知识而非单项目记忆

### Requirement: MUST 系统必须支持多来源知识沉淀

MUST 系统必须允许至少从以下来源提取知识：

- 项目复盘
- 审核与驳回
- AI 推荐结果
- 审计日志
- 基础规则文档

#### Scenario: 从复盘生成知识

- **GIVEN** 项目复盘完成
- **WHEN** 系统提取其中的稳定经验
- **THEN** 系统应允许生成可复用知识条目

### Requirement: MUST 记忆必须支持多层粒度

MUST 系统记忆至少应支持以下粒度：

- 用户记忆
- 项目记忆
- 组织记忆
- AI 运行记忆

#### Scenario: 保存项目偏好

- **GIVEN** 某项目反复使用固定审核口径
- **WHEN** 系统沉淀该习惯
- **THEN** 该内容应可作为项目记忆存在

### Requirement: MUST 知识库必须同时支持文档型和结构化沉淀

MUST 系统必须同时支持文档型知识和结构化知识，以适配检索增强、规则搜索、统计分析和模式推断。

#### Scenario: 沉淀驳回原因模式

- **GIVEN** 多条驳回意见形成重复模式
- **WHEN** 系统保存这些结果
- **THEN** 既应允许保留文本说明
- **AND** 也应允许提炼为结构化模式

### Requirement: MUST 记忆必须能够按主体与来源追溯

MUST 每条记忆应至少能追溯到主体、来源动作或来源任务，避免形成不可解释的黑盒偏好。

#### Scenario: 查看用户记忆来源

- **GIVEN** 系统保存了一条用户偏好记忆
- **WHEN** 用户或系统查看该记忆
- **THEN** 应能知道其关联主体和来源上下文

### Requirement: MUST 知识与记忆必须可供 MCP 和 AI 使用

MUST 系统沉淀的知识与记忆必须能够以受控方式被 MCP、AI Runtime 或相关查询能力读取，用于检索、辅助推理和上下文增强。

#### Scenario: AI 检索历史经验

- **GIVEN** AI 需要理解某项目或资源上下文
- **WHEN** 系统提供增强上下文
- **THEN** 系统应能够按权限返回知识或记忆摘要

### Requirement: MUST 知识与记忆读取必须受权限控制

MUST 知识和记忆虽然服务 AI，但其读取仍必须受项目权限、资源边界和数据可见性限制。

#### Scenario: 读取项目记忆

- **GIVEN** 用户尝试查看某项目记忆
- **WHEN** 用户不具备该项目访问权限
- **THEN** 系统应拒绝返回对应记忆内容

### Requirement: MUST 知识与记忆的生成和使用必须可审计

MUST 知识候选提取、记忆生成、查询命中和关键使用动作应可追溯，以支持治理和质量提升。

#### Scenario: 生成知识候选

- **GIVEN** 系统从审核或审计日志中提取知识候选
- **WHEN** 该过程被执行
- **THEN** 系统应保留可追溯记录

## Implementation Notes

以下内容是当前仓库实现现状的观察，不属于规范要求本身：

- `apps/api` 当前已存在 `knowledge_entry` 和 `memory_entry` 相关仓储与服务骨架。
- `apps/api` 已提供知识条目、记忆条目和知识搜索相关接口。
- `apps/api` 当前已为知识条目与记忆条目补齐基础检索索引，并在知识抽取结果落库时写入 `knowledge_entry.create` 与 `memory_entry.create` 审计日志。
- `apps/ai-runtime` 当前已有 `knowledge_pipeline.py`，能够从审计事件中提取 `knowledgeCandidates` 和 `memoryCandidates`。

这些现状说明知识与记忆主线已经有初步实现，但完整治理和产品化仍属于后续工程工作。
