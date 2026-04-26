# Spec: 后台任务总线专题

## 概述

本 spec 定义新点 SaaS 造价系统中的后台任务总线规则，用于统一异步任务类型、入队、领取、执行、完成、失败、重试和审计追踪口径。

本 spec 主要整理自以下文档：

- [state-machines.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/state-machines.md)
- [backend-project-skeleton-design.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/backend-project-skeleton-design.md)
- [technical-architecture-and-platform-selection.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/technical-architecture-and-platform-selection.md)
- [report-and-async/spec.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/openspec/changes/doc-normalize-v1-to-openspec/specs/report-and-async/spec.md)

## ADDED Requirements

### Requirement: 长耗时能力必须通过后台任务承接

报表导出、批量重算、导入处理、知识抽取、AI 推荐和其他长耗时能力必须通过后台任务承接，不得阻塞交互请求等待完整执行完成。

#### Scenario: 发起报表导出

- **GIVEN** 用户发起报表导出
- **WHEN** API 接收请求
- **THEN** 系统应创建后台任务
- **AND** 返回任务标识与已受理状态

### Requirement: 后台任务必须具备统一状态机

后台任务必须至少支持 `queued`、`processing`、`completed`、`failed` 四类状态，并保持单向状态流转。

#### Scenario: Worker执行任务

- **GIVEN** 某任务处于 `queued`
- **WHEN** Worker 领取并开始执行
- **THEN** 任务应进入 `processing`
- **AND** 执行结束后只能进入 `completed` 或 `failed`

### Requirement: 任务记录必须保留可追踪元数据

每条后台任务必须记录任务类型、所属项目、请求人、payload、状态、结果、错误信息、创建时间、开始时间和完成时间等追踪字段。

#### Scenario: 查询任务详情

- **GIVEN** 用户查看某条后台任务
- **WHEN** 系统返回任务详情
- **THEN** 结果应包含任务类型、状态、请求人、创建时间和执行结果摘要

### Requirement: Worker必须通过明确领取接口获取任务

Worker 必须通过明确的领取或消费接口获取待执行任务，前端查询任务状态不得改变任务状态。

#### Scenario: 前端轮询任务状态

- **GIVEN** 前端正在轮询某任务详情
- **WHEN** 前端请求任务状态
- **THEN** 该请求只能读取状态
- **AND** 不得把任务从 `queued` 改成 `processing`

### Requirement: 任务执行结果必须由执行方回写

任务完成或失败时，执行方必须回写结果或错误信息，任务总线不得只依赖前端推断执行结果。

#### Scenario: 重算任务失败

- **GIVEN** Worker 执行批量重算失败
- **WHEN** Worker 上报失败
- **THEN** 任务应进入 `failed`
- **AND** 任务记录应保留失败原因

### Requirement: 失败任务必须支持受控重试

失败任务必须支持受控重试或重新发起，重试时必须明确复用原始输入、修正输入或失败子集输入，不得静默混用不同范围。

#### Scenario: 重试导入失败子集

- **GIVEN** 导入任务存在失败明细
- **WHEN** 用户选择失败子集重试
- **THEN** 系统应明确记录本次重试范围
- **AND** 不得把失败子集误当作整批输入

### Requirement: 任务类型必须有明确执行器归属

每类后台任务必须有明确的处理器或执行器归属，未知任务类型不得被静默吞掉。

#### Scenario: Worker收到未知任务类型

- **GIVEN** Worker 领取到不支持的任务类型
- **WHEN** Worker 尝试执行
- **THEN** 系统应明确失败并记录原因
- **AND** 不应伪装成执行成功

### Requirement: 关键任务状态变化必须写入审计日志

后台任务的入队、完成、失败和关键重试动作必须写入审计日志或等价追踪记录。

#### Scenario: 任务失败

- **GIVEN** 某后台任务执行失败
- **WHEN** 系统更新任务状态
- **THEN** 应记录失败动作、任务类型、任务 id 和错误摘要

### Requirement: 后台任务查询必须受权限控制

后台任务查询、下载结果和重试操作必须受项目可见性、任务所有权和对应业务权限控制。

#### Scenario: 无权限用户查看任务

- **GIVEN** 用户不具备目标项目可见权限
- **WHEN** 用户尝试查询该项目后台任务
- **THEN** 系统应拒绝访问

## Implementation Notes

以下内容是当前仓库实现现状的观察，不属于规范要求本身：

- 当前 `apps/api/src/modules/jobs` 已有 `BackgroundJobService`、`BackgroundJobProcessor`、`BackgroundJobRepository` 和 `BackgroundJobSink`。
- 当前 `apps/worker` 已有 `QueueBackedWorker`、`WorkerPollingRunner`、`ApiBackgroundJobSource` 和 `ApiWorkerPlatformClient`。
- 当前任务类型已经覆盖 `report_export`、`project_recalculate` 和 `knowledge_extraction` 主线。
- 当前任务状态已覆盖 `queued`、`processing`、`completed`、`failed`。
- 当前导入失败子集重试已经通过 `retryEvents` 和 `retryContext` 保留本次重试范围。

这些现状说明后台任务总线已经进入可执行阶段，后续重点是补生产级队列、幂等领取、超时恢复、并发锁和任务观测指标。
