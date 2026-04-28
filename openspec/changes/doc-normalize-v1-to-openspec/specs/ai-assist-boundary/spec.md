# Spec: AI辅助边界

## 概述

本 spec 定义新点 SaaS 造价系统中 AI 能力的业务边界，用于统一 AI 推荐、预警、辅助审核、知识抽取和人工确认的角色，避免 AI 直接破坏正式业务主链。

本 spec 主要整理自以下文档：

- [设计文档_v1.0_优化中.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/设计文档_v1.0_优化中.md)
- [backend-architecture-redesign.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/backend-architecture-redesign.md)
- [iteration-5-task-breakdown.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/iteration-5-task-breakdown.md)

## ADDED Requirements

### Requirement: V1 的 AI 能力必须聚焦辅助推荐、预警分析和数据沉淀

在 V1 范围内，AI 能力必须以辅助推荐、预警分析和数据沉淀为主，不应把后续增强能力误写成首版强制交付。

#### Scenario: 判断 AI 能力是否属于 V1

- **GIVEN** 某个 AI 能力被纳入需求范围
- **WHEN** 系统判断其所属范围
- **THEN** V1 应优先覆盖清单推荐、定额匹配、造价预警、辅助审核和指标沉淀

### Requirement: AI 输出必须作为建议而非直接正式写入

AI 生成的结果必须首先作为建议、预警或解释信息存在，不能绕过正式业务链直接写入主业务数据。

#### Scenario: 生成 AI 推荐

- **GIVEN** AI 生成了清单推荐或定额推荐
- **WHEN** 结果返回到业务系统
- **THEN** 系统应先将其保存为建议结果
- **AND** 不应自动直接改写正式清单或正式定额数据

### Requirement: 正式业务写入只能通过业务后端完成

无论 AI Runtime、Worker 还是其他辅助能力层，都不能绕过业务后端直接执行正式业务写入。

#### Scenario: AI 想写入正式数据

- **GIVEN** 某个 AI 结果需要落正式业务表
- **WHEN** 系统执行落库
- **THEN** 该写入必须通过正式业务后端和相应权限校验完成

### Requirement: AI 结果必须支持人工确认

AI 推荐、预警或辅助审核结果必须支持人工确认、接受、忽略或失效等显式处理动作。

#### Scenario: 接受 AI 推荐

- **GIVEN** 用户查看某条 AI 推荐
- **WHEN** 用户决定接受该推荐
- **THEN** 系统应以人工确认动作为前提写入正式结果

### Requirement: AI 结果必须受权限控制

AI 结果的查看、接受、忽略和落正式数据动作必须受角色和项目权限控制，不得对所有用户开放同样能力。

#### Scenario: 审核员查看 AI 推荐

- **GIVEN** 某用户具备只读审核角色
- **WHEN** 用户访问 AI 推荐
- **THEN** 系统可以允许其查看
- **AND** 不应默认允许其直接接受并写正式数据

### Requirement: AI 结果必须具备失效机制

当源上下文、清单版本、定额上下文或其他关键条件发生变化时，旧的 AI 建议必须允许失效，避免继续误导业务操作。

#### Scenario: 上下文变化导致推荐失效

- **GIVEN** 某条 AI 推荐基于旧版本上下文生成
- **WHEN** 源版本或关键上下文发生变化
- **THEN** 系统应允许该推荐进入失效态

### Requirement: AI 辅助审核必须输出依据和解释

AI 在辅助审核、异常识别和预警场景中，必须输出支撑理由、依据摘要或上下文说明，而不仅是单一结论。

#### Scenario: 展示 AI 预警

- **GIVEN** AI 标识某条造价结果为异常
- **WHEN** 用户查看该预警
- **THEN** 系统应同时展示异常原因、对比依据或支撑上下文摘要

### Requirement: AI 读上下文可以广，但正式写入边界必须窄

AI 可以在权限允许前提下读取项目、阶段、清单、知识或历史案例上下文，但正式写入边界必须严格受限。

#### Scenario: AI 读取业务上下文

- **GIVEN** AI 需要生成推荐
- **WHEN** 系统向其提供上下文
- **THEN** 系统可以提供所需只读上下文
- **AND** AI 不应获得绕过业务规则的写入能力

### Requirement: AI 关键动作必须保留审计与追溯

AI 推荐生成、接受、忽略、失效和人工确认落正式数据等关键动作，必须保留审计记录。

#### Scenario: 忽略 AI 推荐

- **GIVEN** 用户忽略一条 AI 推荐
- **WHEN** 该动作被系统接受
- **THEN** 系统应保留可追溯记录

## Implementation Notes

以下内容是当前仓库实现现状的观察，不属于规范要求本身：

- `apps/api` 当前已有 `AiRuntimePreviewService`，通过 CLI 调用 Python AI Runtime 并解析结构化 JSON 响应。
- `apps/ai-runtime` 当前已有 OpenAI-compatible LLM Provider 适配器，可通过 `LLM_API_KEY`、`LLM_MODEL`、`LLM_BASE_URL` 或任务入参执行真实 LLM chat 调用。
- `apps/worker` 当前已有 `knowledge-extraction-worker`，可执行知识抽取预览类任务；`AiRuntimeCliClient` 已具备知识抽取、参考定额语义检索和 LLM chat 三类 CLI 调用通道。
- `apps/api` 当前已有 AI 推荐生成、查看、接受、忽略、失效和偏差预警接口；接受清单/定额推荐时通过业务后端落正式表并写审计。
- AI 推荐生成时会在输入/输出 JSON payload 中写入 `aiAssistTraceId`、provider/model 摘要和输入输出字段摘要；调用方传入 provider/model 时会保留原始来源，生成审计日志也会保留同一 trace id。
- 架构文档已明确 AI Runtime 不负责正式业务写入，正式写入必须通过 `apps/api`。

这些现状说明 AI 边界已经从架构约束推进到 API 主链，真实外部 AI Provider 的最小调用通道已经落地；生产级超时重试策略、调用指标和模型治理仍属于后续工程工作。
