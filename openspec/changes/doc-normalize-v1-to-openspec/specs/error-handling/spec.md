# Spec: 错误处理专题

## 概述

本 spec 定义新点 SaaS 造价系统中的错误处理规则，用于统一 HTTP 状态码、错误响应结构、前端反馈级别、表格行状态和任务型错误处理口径。

本 spec 主要整理自以下文档：

- [设计文档_v1.0_优化中.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/设计文档_v1.0_优化中.md)
- [backend-implementation-checklist.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/backend-implementation-checklist.md)
- [api-contract/spec.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/openspec/changes/doc-normalize-v1-to-openspec/specs/api-contract/spec.md)

## ADDED Requirements

### Requirement: API错误必须采用统一响应结构

系统 API 错误响应必须至少包含错误码和错误消息，并允许携带结构化细节，供前端展示、日志追踪和协作排查使用。

#### Scenario: 返回业务校验错误

- **GIVEN** 用户提交的数据不满足业务规则
- **WHEN** API 拒绝该请求
- **THEN** 响应应包含稳定的错误码和可读错误消息
- **AND** 可在 details 中携带字段、资源或失败上下文

### Requirement: HTTP状态码必须表达错误类别

系统必须用 HTTP 状态码表达错误类别，避免全部返回 200 后再由业务字段区分失败。

#### Scenario: 请求被权限拒绝

- **GIVEN** 用户没有目标资源的操作权限
- **WHEN** 用户调用受限接口
- **THEN** API 应返回 403
- **AND** 错误消息应提示无权限操作

### Requirement: 参数错误和业务规则错误必须区分

参数格式错误、字段缺失与业务规则不满足必须区分处理。参数错误可返回 400，字段格式正确但业务规则不满足时应返回 422。

#### Scenario: 提交锁定资源变更

- **GIVEN** 用户提交的请求格式正确
- **AND** 目标资源处于不允许修改的业务状态
- **WHEN** API 校验业务规则
- **THEN** API 不应把该问题降级为通用参数错误
- **AND** 应返回能表达业务规则失败的状态码和错误码

### Requirement: 锁定资源写入必须返回锁定语义

当数据处于锁定状态且不允许直接修改时，写接口必须返回锁定语义，优先使用 423 表达资源被锁定。

#### Scenario: 修改已锁定清单版本

- **GIVEN** 清单版本已经锁定
- **WHEN** 用户尝试修改清单项、定额行或人工调价字段
- **THEN** API 应拒绝写入
- **AND** 返回锁定相关错误码和可读提示

### Requirement: 前端反馈级别必须与错误类别匹配

前端 toast、alert 或页面错误卡片必须根据错误类别选择反馈级别：成功为 success，参数或冲突类问题为 warning，认证、权限和服务异常为 error。

#### Scenario: 展示数据冲突

- **GIVEN** API 返回 409 数据冲突
- **WHEN** 前端展示反馈
- **THEN** 应使用 warning 级别
- **AND** 文案应包含冲突原因或下一步处理提示

### Requirement: 表格行级错误必须可定位

表格编辑、计算、导入预览等行级交互必须能将错误定位到具体行或字段，不得只显示无法定位的全局错误。

#### Scenario: 行保存失败

- **GIVEN** 用户在表格中编辑多行数据
- **WHEN** 其中一行保存失败
- **THEN** 该行应进入保存失败状态
- **AND** 应展示失败原因或可查看的错误详情

### Requirement: 任务型错误必须保留失败上下文

批量导入、批量重算、报表导出和 AI 推荐等任务型能力失败时，必须保留失败上下文，支持查看失败原因、失败范围和后续重试或重新发起。

#### Scenario: 批量导入失败

- **GIVEN** 导入任务执行失败或部分失败
- **WHEN** 用户查看任务结果
- **THEN** 系统应展示失败明细
- **AND** 应允许下载错误报告或进入失败范围排查

### Requirement: AI失败不得阻断人工主流程

AI 推荐、AI 审核、知识抽取等辅助能力失败时，不得阻断人工主流程，应提示稍后重试或切换手工处理。

#### Scenario: AI推荐失败

- **GIVEN** 用户正在进行清单编制或审核
- **WHEN** AI 推荐接口失败
- **THEN** 页面应提示 AI 暂不可用
- **AND** 用户仍可继续人工处理当前业务

### Requirement: 服务端异常不得泄露敏感内部细节

生产环境中的 500 类错误不得直接暴露堆栈、数据库连接串、密钥、对象存储地址签名等敏感信息。

#### Scenario: 服务端抛出未捕获异常

- **GIVEN** API 内部发生未捕获异常
- **WHEN** 系统返回 500
- **THEN** 响应应使用通用服务异常提示
- **AND** 详细堆栈只应进入受控日志或观测系统

## Implementation Notes

以下内容是当前仓库实现现状的观察，不属于规范要求本身：

- 当前 OpenAPI 生成文档已经包含共享 `ErrorResponse` schema。
- `apps/api` 当前多条路由已覆盖 401、403、404、422 等常见错误响应。
- 当前前端 `ApiError` 已能保留后端返回的 `error.code`，导入任务页面已识别 `IMPORT_TASK_RETRY_INPUT_INCOMPLETE` 并展示专门处理提示。
- 当前导入任务、报表导出和后台任务已经具备部分失败原因和错误报告链路。

这些现状说明错误处理主线已经形成，但仍需要继续把错误码清单、锁定态 423、前端统一错误组件和生产日志脱敏收口。
