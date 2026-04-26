# Spec: 报表与异步任务规则

## 概述

本 spec 定义报表生成、导出任务和后台异步处理的稳定规则，用于统一报表模板边界、导出任务状态、失败处理、下载条件和后台任务追踪口径。

本 spec 主要整理自以下文档：

- [设计文档_v1.0_优化中.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/设计文档_v1.0_优化中.md)
- [state-machines.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/state-machines.md)
- [permission-matrix.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/permission-matrix.md)

## ADDED Requirements

### Requirement: 报表必须绑定明确的数据上下文

每个报表结果都必须绑定明确的数据上下文，至少包括所属项目、所属阶段或过滤维度、模板来源和生成版本。

#### Scenario: 查看报表记录

- **GIVEN** 用户查看某条报表记录
- **WHEN** 系统展示报表元数据
- **THEN** 系统应能展示报表名称、所属项目、所属阶段、模板名称和生成版本

### Requirement: 内置模板不得被直接覆盖

系统内置的国标报表模板不得被直接覆盖，只能复制后生成企业模板或自定义模板。

#### Scenario: 修改国标模板

- **GIVEN** 用户尝试编辑系统内置模板
- **WHEN** 用户提交修改
- **THEN** 系统不应直接覆盖内置模板
- **AND** 应通过复制生成新模板版本

### Requirement: 模板字段映射必须引用可追溯标准字段

报表模板的字段映射必须引用系统可追溯的标准字段，不得依赖无法追溯来源的手工拼装值作为正式字段来源。

#### Scenario: 配置报表字段来源

- **GIVEN** 用户或系统配置报表模板
- **WHEN** 某输出字段被绑定数据来源
- **THEN** 该来源应可追溯到标准业务字段或计算结果

### Requirement: 报表导出默认应采用异步任务模式

报表生成和导出默认应以异步任务方式执行，以支持排队、处理、完成、失败和后续下载。

#### Scenario: 发起导出

- **GIVEN** 用户发起报表导出
- **WHEN** 系统受理请求
- **THEN** 系统应创建异步导出任务
- **AND** 任务应先进入排队状态

### Requirement: 异步导出任务必须具备完整状态反馈

导出任务至少必须支持排队中、处理中、已完成和失败等状态语义，并允许用户查询当前状态。

#### Scenario: 查询导出进度

- **GIVEN** 用户已创建导出任务
- **WHEN** 用户查询任务状态
- **THEN** 系统应返回当前状态
- **AND** 在终态下明确说明是否可下载或失败原因

### Requirement: 仅已完成任务允许下载

只有已经完成的导出任务才允许进入下载流程，未完成或失败任务不得伪装成可下载结果。

#### Scenario: 下载未完成导出

- **GIVEN** 某导出任务尚未完成
- **WHEN** 用户尝试下载结果
- **THEN** 系统应拒绝下载

### Requirement: 失败任务必须保留错误信息并允许重发

失败的报表任务或后台任务必须保留错误原因，并允许用户或系统重新发起同类任务。

#### Scenario: 导出失败

- **GIVEN** 某导出任务执行失败
- **WHEN** 用户查看任务结果
- **THEN** 系统应展示失败原因
- **AND** 失败不应阻断重新发起导出

### Requirement: 后台任务必须具备统一追踪口径

除报表导出外，系统中的后台任务也必须统一采用可追踪的任务模型，至少记录任务类型、请求人、状态、创建时间、完成时间、结果和错误信息。

#### Scenario: 查看后台任务

- **GIVEN** 系统存在后台任务
- **WHEN** 用户查看任务列表或详情
- **THEN** 系统应能看到任务类型、状态、请求人和执行结果摘要

### Requirement: 报表与后台任务必须受权限控制

报表导出和后台任务查询必须受到项目可见性和导出权限控制，不得对无权用户暴露任务内容或结果。

#### Scenario: 无权限用户查看导出任务

- **GIVEN** 用户不是该项目授权成员或不具备报表导出能力
- **WHEN** 用户尝试查看或下载任务结果
- **THEN** 系统应拒绝访问

### Requirement: 关键任务状态切换必须写入审计日志

导出任务和后台任务的关键状态切换至少应对排队、完成和失败进行审计记录。

#### Scenario: 任务完成

- **GIVEN** 某任务从处理中进入完成
- **WHEN** 状态切换成功
- **THEN** 系统应写入审计记录

## Implementation Notes

以下内容是当前仓库实现现状的观察，不属于规范要求本身：

- `apps/api` 当前已有 `ReportExportTaskService`，支持 `queued`、`processing`、`completed`、`failed`。
- `apps/api` 当前已有 `BackgroundJobService`，支持统一后台任务排队和处理状态。
- `apps/worker` 当前已具备 `report_export`、`project_recalculate`、`knowledge_extraction_preview` 等任务处理骨架。
- 当前报表导出结果以 JSON 预览和下载为主，距离完整模板化报表输出还有实现空间。

这些现状说明任务执行主链已经存在，但完整报表平台能力仍属于后续演进范围。
