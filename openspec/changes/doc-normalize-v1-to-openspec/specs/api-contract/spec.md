# Spec: API契约规则

## 概述

本 spec 定义新点 SaaS 造价系统的 API 契约边界，用于统一 REST 风格、资源分组、请求响应语义、错误返回和接口作为前后端联调基线的职责。

本 spec 主要整理自以下文档：

- [openapi-v1.yaml](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/api/openapi-v1.yaml)
- [project-document-index.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/project-document-index.md)

## ADDED Requirements

### Requirement: OpenAPI必须作为接口契约基线

系统必须以 OpenAPI 文档作为前后端联调和接口边界的契约基线，而不是依赖口头约定或代码猜测。

#### Scenario: 前端接入新接口

- **GIVEN** 前端需要接入某个业务接口
- **WHEN** 团队确认接口口径
- **THEN** 应以 OpenAPI 契约为准

### Requirement: API必须采用统一的/v1版本前缀

正式业务 API 必须采用统一的 `/v1` 版本前缀，以明确版本边界。

#### Scenario: 新增业务路由

- **GIVEN** 系统新增正式业务接口
- **WHEN** 设计其路径
- **THEN** 该路径应位于 `/v1` 命名空间下

### Requirement: API必须按业务资源分组而不是按页面分组

API 应优先按项目、阶段、清单版本、审核提交、过程单据、报表和任务等业务资源分组，而不是按前端页面结构分组。

#### Scenario: 设计清单接口

- **GIVEN** 系统需要暴露清单相关能力
- **WHEN** 设计接口路径
- **THEN** 应围绕清单版本和清单项等业务资源组织路径

### Requirement: 写接口必须使用明确动作语义

需要触发业务动作的接口必须使用清晰语义，例如提交、审核、复制来源、撤回、重算、导出任务等，而不是把所有动作揉进模糊更新接口。

#### Scenario: 提交清单版本

- **GIVEN** 用户要提交清单版本审核
- **WHEN** 系统提供接口
- **THEN** 应存在明确表达“提交”动作的接口语义

### Requirement: 请求和响应结构必须使用稳定schema

每个正式接口都必须对应稳定的请求和响应 schema，避免同一接口在不同调用场景返回不兼容结构。

#### Scenario: 查询项目详情

- **GIVEN** 客户端调用项目详情接口
- **WHEN** 系统返回结果
- **THEN** 返回结构应符合稳定的项目 schema

### Requirement: 错误返回必须采用统一结构

系统错误返回必须至少包含错误码和错误消息，并允许携带结构化细节。

#### Scenario: 提交非法请求

- **GIVEN** 用户提交了非法请求
- **WHEN** 系统拒绝该请求
- **THEN** 返回应包含统一错误结构

### Requirement: API必须区分同步查询和异步任务接口

同步查询接口和异步任务接口必须区分开来，涉及导出、后台处理和长时间执行任务时应使用任务型接口。

#### Scenario: 发起报表导出

- **GIVEN** 用户请求报表导出
- **WHEN** 系统受理请求
- **THEN** 应返回任务型响应而不是阻塞等待完整结果

### Requirement: API契约必须与权限模型协同设计

API 最低权限要求必须能够与权限模型映射，不得出现接口契约与权限矩阵完全脱节的情况。

#### Scenario: 调用审核接口

- **GIVEN** 用户请求审核某资源
- **WHEN** 系统校验权限
- **THEN** 该接口应有明确对应的最低权限要求

## Implementation Notes

以下内容是当前仓库实现现状的观察，不属于规范要求本身：

- 当前仓库已有 [openapi-v1.yaml](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/api/openapi-v1.yaml) 作为主要 API 基线。
- `apps/api/src/app/register-*.ts` 已实现大部分 `/v1` 路由骨架。
- 现有实现覆盖项目、阶段、清单版本、审核、汇总、导出任务和后台任务等接口主线。

这些现状说明 API 契约已经有清晰基线，但仍需持续保持文档与实现同步。
