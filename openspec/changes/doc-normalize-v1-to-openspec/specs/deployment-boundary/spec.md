# Spec: 部署运行边界

## 概述

本 spec 定义新点 SaaS 造价系统在开发、测试和生产环境中的部署边界与运行原则，用于统一环境隔离、组件职责、存储边界和 V1 可接受部署复杂度。

本 spec 主要整理自以下文档：

- [deployment-architecture.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/deployment-architecture.md)
- [technical-architecture-and-platform-selection.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/technical-architecture-and-platform-selection.md)

## ADDED Requirements

### Requirement: MUST 系统必须至少区分dev、test、prod环境

MUST 系统部署必须至少区分开发、测试和生产三套环境，且环境间应保持明确隔离。

#### Scenario: 部署测试环境

- **GIVEN** 系统需要提供联调或回归环境
- **WHEN** 环境被创建
- **THEN** 该环境应与开发和生产环境隔离

### Requirement: MUST V1部署必须优先追求稳定和可维护

MUST V1 的部署设计必须优先满足快速搭建、稳定联调、便于排障和可持续维护，而不是追求过早复杂化。

#### Scenario: 选择V1部署方案

- **GIVEN** 团队在选择部署形态
- **WHEN** 评估 V1 方案
- **THEN** 应优先选择稳定、清晰且易维护的方案

### Requirement: MUST 业务数据、文件实体和临时状态必须分开存放

MUST 系统必须坚持以下边界：

- 业务元数据存放在关系数据库
- 文件实体存放在对象存储
- 临时任务状态或缓存存放在 Redis 等运行时组件

#### Scenario: 保存导出文件

- **GIVEN** 系统生成报表或导出文件
- **WHEN** 持久化该结果
- **THEN** 文件实体不应直接塞入主业务数据库

### Requirement: MUST Frontend、API和Worker必须作为独立运行角色部署

MUST 系统必须将前端、业务 API 和 Worker 视为独立运行角色，避免把异步任务和交互服务完全混为同一运行边界。

#### Scenario: 部署后台任务处理

- **GIVEN** 系统需要处理导出、导入、重算或 AI 相关任务
- **WHEN** 设计部署形态
- **THEN** 这些任务应可由独立 Worker 角色承接

### Requirement: MUST V1的流程引擎可以内嵌于API运行边界

MUST 在 V1 阶段，流程引擎可以作为 API 内部模块运行，而不强制要求独立拆分成单独服务。

#### Scenario: 部署流程能力

- **GIVEN** 系统需要承接审核流和锁定流
- **WHEN** 设计 V1 部署边界
- **THEN** 流程引擎可以内嵌在 API 运行边界中

### Requirement: MUST 开发环境必须支持轻量本地联调

MUST 开发环境应支持基于 Docker Compose 或等价轻量方案的一键启动，方便本地开发和单人联调。

#### Scenario: 本地开发

- **GIVEN** 开发者需要本地联调
- **WHEN** 启动依赖环境
- **THEN** 系统应支持通过轻量方式启动数据库、缓存和对象存储等依赖

### Requirement: MUST 测试与生产环境不得共用关键存储

MUST 测试环境和生产环境不得共用数据库、缓存、对象存储 bucket 或其他关键存储资源。

#### Scenario: 配置对象存储

- **GIVEN** 系统存在测试和生产两套环境
- **WHEN** 配置对象存储
- **THEN** 两套环境必须使用隔离的存储边界

### Requirement: MUST 无状态服务不得依赖本机状态

MUST API 等无状态服务不得将 session、正式文件或关键任务状态依赖于单机本地存储。

#### Scenario: 扩容API实例

- **GIVEN** API 需要水平扩展
- **WHEN** 系统部署多个实例
- **THEN** 关键运行状态不应依赖某一台应用机本地文件

### Requirement: MUST 生产环境必须具备监控、日志和恢复能力

MUST 生产环境必须至少具备日志采集、基础监控、备份和恢复能力。

#### Scenario: 发生生产故障

- **GIVEN** 生产环境出现任务失败或服务异常
- **WHEN** 团队进行排障与恢复
- **THEN** 系统应具备必要日志、监控和恢复路径

## Implementation Notes

以下内容是当前仓库实现现状的观察，不属于规范要求本身：

- 当前仓库已提供 [deploy/docker/docker-compose.dev.yml](/Users/huahaha/WorkSpace/something/新点SaaS计价/deploy/docker/docker-compose.dev.yml) 用于开发依赖启动。
- `README.md` 已明确本地开发依赖 PostgreSQL、Redis 和相关环境变量。
- `apps/api` 当前支持 `memory` 与 `database` 两种运行模式，说明仓库正处于从轻量运行到真实持久化运行的过渡阶段。

这些现状说明基本运行边界已经形成，但完整环境治理仍属于后续持续建设工作。
