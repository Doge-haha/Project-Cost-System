# Spec: 对象存储文件专题

## 概述

本 spec 定义新点 SaaS 造价系统中的对象存储文件专题规则，用于统一报表文件、导入导出文件、错误报告和业务元数据分离存储边界。

本 spec 主要整理自以下文档：

- [设计文档_v1.0_优化中.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/设计文档_v1.0_优化中.md)
- [deployment-architecture.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/deployment-architecture.md)
- [technical-architecture-and-platform-selection.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/technical-architecture-and-platform-selection.md)

## ADDED Requirements

### Requirement: 大文件实体必须走对象存储而不是业务主表

报表文件、导入文件、错误报告和其他大文件实体必须走对象存储，业务数据库只保留元数据和引用关系。

#### Scenario: 保存导出文件

- **GIVEN** 系统生成报表或错误报告文件
- **WHEN** 系统持久化结果
- **THEN** 文件实体应存入对象存储
- **AND** 数据库只记录元数据与关联

### Requirement: 文件元数据必须绑定明确业务上下文

每个正式文件记录都必须绑定所属项目、任务类型、来源任务或业务对象，以便后续追溯和权限控制。

#### Scenario: 查看文件记录

- **GIVEN** 用户查看某文件记录
- **WHEN** 系统展示详情
- **THEN** 应能说明其业务来源和关联上下文

### Requirement: 对象存储必须默认采用私有访问边界

对象存储中的正式业务文件必须默认采用私有访问边界，而不是直接公开暴露。

#### Scenario: 下载业务文件

- **GIVEN** 用户请求下载某文件
- **WHEN** 系统校验权限
- **THEN** 仅在授权后才允许生成访问路径或下载结果

### Requirement: 开发与生产环境必须支持不同对象存储实现

对象存储能力应支持本地私有化环境和云环境的不同实现，例如本地 MinIO 与云上 OSS/S3/COS。

#### Scenario: 部署不同环境

- **GIVEN** 系统部署在开发或生产环境
- **WHEN** 配置文件存储后端
- **THEN** 应支持切换不同对象存储实现

## Implementation Notes

以下内容是当前仓库实现现状的观察，不属于规范要求本身：

- 当前仓库设计文档已明确“报表文件和导入文件只存元数据到数据库，实体文件走对象存储”。
- 部署和技术选型文档已明确开发/私有化优先 `MinIO`，云部署优先 `S3 / OSS / COS`。
- 当前仓库未见独立文件存储服务模块实现，说明对象存储专题目前仍主要停留在架构与部署设计层。

这些现状说明对象存储边界已经稳定，但正式文件平台实现仍属于后续工作。
