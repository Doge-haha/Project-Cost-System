# Spec: MCP上下文打包规则

## 概述

本 spec 定义新点 SaaS 造价系统面向 AI Agent 的 MCP 能力边界、上下文打包方式和权限裁剪规则，用于统一 resource、tool 和聚合上下文的设计口径。

本 spec 主要整理自以下文档：

- [mcp-capability-design.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/mcp-capability-design.md)
- [backend-architecture-redesign.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/backend-architecture-redesign.md)

## ADDED Requirements

### Requirement: MCP层必须作为AI专用能力层存在

系统必须将 MCP 层视为面向 AI Agent 的能力接口层，而不是简单复用前后端联调 API。

#### Scenario: AI 请求业务能力

- **GIVEN** AI Agent 需要访问系统能力
- **WHEN** 系统为其提供接口
- **THEN** 应优先提供面向 AI 任务组织的 MCP 能力
- **AND** 不应要求 AI 直接拼装大量底层 REST endpoint

### Requirement: MCP层不得绕过业务服务直接查库

MCP 层不得绕过业务服务和权限模型直接访问数据库表。

#### Scenario: 获取项目上下文

- **GIVEN** MCP 需要读取项目上下文
- **WHEN** 系统执行该读取
- **THEN** 应通过业务服务或其受控聚合层完成
- **AND** 不应直接跳过业务校验访问底层表

### Requirement: MCP能力必须区分resource和tool

系统必须明确区分：

- `resource`：稳定读取、上下文打包、可缓存内容
- `tool`：查询、分析或动作型能力

#### Scenario: 提供上下文资源

- **GIVEN** AI 需要读取稳定上下文
- **WHEN** 系统设计该能力
- **THEN** 应优先设计为 resource 而不是动作型 tool

### Requirement: 系统必须支持分层上下文资源

MCP 层至少应支持以下上下文资源方向：

- 项目上下文
- 阶段上下文
- 清单版本上下文
- 清单项上下文
- 审核与流程上下文
- 知识与记忆上下文

#### Scenario: 获取清单版本上下文

- **GIVEN** AI 需要分析一个清单版本
- **WHEN** 系统提供对应上下文
- **THEN** 上下文中应包含版本基础信息、来源、锁定状态和关键摘要

### Requirement: MCP上下文必须以任务友好的聚合结果返回

MCP 返回的上下文必须优先面向任务理解和推理，而不是原始分散表结构。

#### Scenario: 返回项目上下文

- **GIVEN** AI 读取项目级上下文
- **WHEN** 系统返回结果
- **THEN** 应提供项目信息、启用阶段、专业配置、风险摘要和关键操作摘要等聚合内容

### Requirement: MCP动作型工具必须受更严格权限控制

所有动作型 MCP 工具必须在查询和资源读取基础上追加更严格的权限控制，尤其是涉及写操作和预览执行时。

#### Scenario: 调用写工具

- **GIVEN** 用户通过 MCP 调用写操作工具
- **WHEN** 系统执行权限判断
- **THEN** 系统应验证其具备相应写权限
- **AND** 无权限用户不得通过 MCP 绕过页面权限

### Requirement: MCP返回必须经过权限裁剪

MCP 层返回的资源和工具结果必须经过权限裁剪，只暴露调用者被允许看到的内容。

#### Scenario: 获取阶段上下文

- **GIVEN** 用户只被授权部分阶段范围
- **WHEN** 其通过 MCP 获取上下文
- **THEN** 系统应只返回其可见阶段的上下文信息

### Requirement: MCP上下文必须允许接入知识与记忆增强

MCP 上下文应允许在权限满足时引入知识条目、记忆摘要和历史案例，用于增强 AI 推理质量。

#### Scenario: 读取复盘上下文

- **GIVEN** AI 需要理解项目复盘背景
- **WHEN** 系统返回复盘上下文
- **THEN** 应允许包含偏差汇总、关键异常和可复用经验摘要

## Implementation Notes

以下内容是当前仓库实现现状的观察，不属于规范要求本身：

- `apps/mcp-gateway` 当前已作为独立应用存在，并明确声明 `resource`、`tool`、`context-aggregation` 等能力定位。
- `apps/mcp-gateway` 当前已具备基于角色的权限裁剪骨架。
- 架构文档已明确 MCP Gateway 不直接查库，需通过业务 API 和受控服务获取数据。

这些现状说明 MCP 能力层方向已经明确，但完整资源矩阵和工具矩阵仍属于后续工程工作。
