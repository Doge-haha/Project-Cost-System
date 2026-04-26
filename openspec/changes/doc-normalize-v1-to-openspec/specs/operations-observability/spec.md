# Spec: 运维观测专题

## 概述

本 spec 定义新点 SaaS 造价系统中的运维观测规则，用于统一日志分类、健康检查、监控指标、告警、备份恢复和生产排障边界。

本 spec 主要整理自以下文档：

- [deployment-architecture.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/deployment-architecture.md)
- [deployment-boundary/spec.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/openspec/changes/doc-normalize-v1-to-openspec/specs/deployment-boundary/spec.md)
- [error-handling/spec.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/openspec/changes/doc-normalize-v1-to-openspec/specs/error-handling/spec.md)
- [background-job-bus/spec.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/openspec/changes/doc-normalize-v1-to-openspec/specs/background-job-bus/spec.md)

## ADDED Requirements

### Requirement: 系统必须区分应用日志、审计日志和任务日志

系统日志必须至少区分应用日志、审计日志和任务日志。三类日志服务于不同目的，不得互相替代。

#### Scenario: 排查任务失败

- **GIVEN** 某后台任务执行失败
- **WHEN** 运维或开发人员排查问题
- **THEN** 应能从任务日志看到任务执行过程
- **AND** 应能从审计日志看到关键业务动作

### Requirement: 应用日志必须覆盖请求耗时和异常信息

应用日志必须覆盖请求耗时、异常摘要、外部依赖调用失败和慢查询等排障关键事实。

#### Scenario: API响应变慢

- **GIVEN** 某 API 响应耗时异常升高
- **WHEN** 团队排查性能问题
- **THEN** 日志或指标应能定位到请求耗时和可能的慢依赖

### Requirement: 生产环境必须提供健康检查

生产环境必须提供健康检查能力，用于判断 API、Worker 和关键依赖是否可用。

#### Scenario: 部署后检查服务

- **GIVEN** 新版本部署完成
- **WHEN** 平台执行健康检查
- **THEN** 应能确认服务是否存活
- **AND** 不应暴露敏感内部信息

### Requirement: 监控指标必须覆盖核心运行组件

监控指标必须至少覆盖应用存活、数据库连接、Redis、后台任务成功失败数、报表导出耗时和 AI 调用失败率。

#### Scenario: AI调用失败率升高

- **GIVEN** AI Provider 出现不稳定
- **WHEN** AI 调用失败率升高
- **THEN** 监控应能反映失败率变化
- **AND** 团队可以判断是否需要降级或切换手工流程

### Requirement: 关键任务失败必须触发告警

导入、导出、重算、知识抽取和 AI 推荐等关键任务失败达到阈值时，系统必须触发告警或进入可见的运维待处理状态。

#### Scenario: 导入任务连续失败

- **GIVEN** 同一项目或同一任务类型连续失败
- **WHEN** 失败数量达到阈值
- **THEN** 系统应产生告警
- **AND** 告警应包含任务类型、项目上下文和失败摘要

### Requirement: 错误日志必须集中收集

生产环境错误日志必须集中收集，避免只保存在单台实例本地。

#### Scenario: API实例重启后排查错误

- **GIVEN** 某 API 实例发生异常并重启
- **WHEN** 团队排查历史错误
- **THEN** 仍应能从集中日志系统查看错误摘要

### Requirement: 敏感信息不得进入普通日志

日志不得记录明文密钥、JWT、数据库连接串、对象存储签名 URL、用户敏感字段等信息。

#### Scenario: 外部依赖调用失败

- **GIVEN** API 调用对象存储或 AI Provider 失败
- **WHEN** 系统记录错误日志
- **THEN** 日志应保留错误摘要和追踪标识
- **AND** 不应写入完整密钥或签名 URL

### Requirement: 生产环境必须具备备份与恢复演练

生产环境必须至少具备数据库备份、对象存储备份、配置备份和周期性恢复演练。

#### Scenario: 执行恢复演练

- **GIVEN** 团队进行月度恢复演练
- **WHEN** 在测试环境恢复生产备份样本
- **THEN** 应验证数据库可恢复
- **AND** 应验证导出文件、流程定义和表单配置可恢复

### Requirement: 观测能力必须支持跨组件关联

API、Worker、MCP Gateway、AI Runtime 和对象存储相关操作应尽量通过请求 id、任务 id、项目 id 或 trace id 关联，支持跨组件排障。

#### Scenario: 排查一次知识抽取失败

- **GIVEN** 用户反馈知识抽取失败
- **WHEN** 团队排查问题
- **THEN** 应能通过任务 id 或 trace id 串联 API 入队、Worker 执行和 AI Runtime 调用记录

## Implementation Notes

以下内容是当前仓库实现现状的观察，不属于规范要求本身：

- 当前 `deployment-architecture.md` 已明确 V1 至少需要健康检查、错误日志集中收集和关键任务失败告警。
- 当前 `deploy/docker/docker-compose.dev.yml` 已提供本地 PostgreSQL 和 Redis 依赖。
- 当前 API、Worker 和 MCP Gateway 已拆成独立运行角色，具备后续按组件采集日志和指标的基础。
- 当前后台任务记录已经包含任务类型、状态、错误信息和完成时间，可作为任务观测的基础数据源。

这些现状说明运维观测具备基础边界，但生产级 Prometheus、Grafana、Loki/ELK、集中告警和恢复演练仍属于后续建设范围。
