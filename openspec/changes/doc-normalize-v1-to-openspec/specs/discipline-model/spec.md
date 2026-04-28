# Spec: 专业模型专题

## 概述

本 spec 定义新点 SaaS 造价系统中的专业模型专题规则，用于统一专业主数据、业务视图专业、定额集关系和地区化差异的建模边界。

本 spec 主要整理自以下文档：

- [profession-model.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/profession-model.md)
- [source-field-mapping.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/source-field-mapping.md)

## ADDED Requirements

### Requirement: MUST 专业必须至少区分标准专业和业务视图专业

MUST 系统必须将专业至少区分为标准专业主数据和业务视图专业两层，避免把不同视图下的专业集合硬塞成单一枚举。

#### Scenario: 解释源专业集合

- **GIVEN** 系统读取来自不同业务视图的专业集合
- **WHEN** 设计目标模型
- **THEN** 应能区分标准专业与业务视图专业

### Requirement: MUST 专业主数据必须保留源兼容字段

MUST 专业模型必须保留如 `source_markup`、`gb08_code`、`gb13_code`、`discipline_group`、`business_view_type`、`region_code` 等兼容字段。

#### Scenario: 保存专业主数据

- **GIVEN** 系统导入一条专业定义
- **WHEN** 持久化该记录
- **THEN** 应保留必要源兼容字段用于追溯与映射

### Requirement: MUST 专业与定额集必须是一对多关系

MUST 一个专业必须允许对应多个定额集，定额集负责计价依据和版本，专业负责业务分类。

#### Scenario: 查询专业下的定额集

- **GIVEN** 用户查看某专业配置
- **WHEN** 系统展示其计价依据
- **THEN** 该专业应可关联多个定额集

### Requirement: MUST 地区与业务视图差异必须可表达

MUST 同一专业在不同地区或不同业务视图下，必须允许呈现不同名称、编码或集合关系。

#### Scenario: 查看地区化专业集合

- **GIVEN** 系统存在不同地区的专业集合
- **WHEN** 用户切换业务视图或地区
- **THEN** 专业集合应允许按地区和视图差异化表达

## Implementation Notes

以下内容是当前仓库实现现状的观察，不属于规范要求本身：

- 当前仓库已有 [profession-model.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/profession-model.md) 作为专业模型专题基线。
- 现有数据模型设计已预留 `discipline_type` 和 `standard_set` 方向。

这些现状说明专业模型已经有明确专题基础，后续可继续细分到 XML 与 SQLite 的映射专题。
