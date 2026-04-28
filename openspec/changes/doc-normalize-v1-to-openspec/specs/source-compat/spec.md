# Spec: 源系统兼容专题

## 概述

本 spec 定义新点源系统兼容的稳定边界，用于统一专业主数据、定额集、清单字段格式和源系统关键编码在 SaaS 系统中的保留与解释方式。

本 spec 主要整理自以下文档：

- [profession-model.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/profession-model.md)
- [source-field-mapping.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/source-field-mapping.md)

## ADDED Requirements

### Requirement: MUST 源系统专业必须视为多层概念而非单一枚举

MUST 源系统中的“专业”必须视为至少包含标准专业主数据和业务视图专业两层概念，不能简单压平为单一名称字段。

#### Scenario: 解释源系统专业

- **GIVEN** 系统读取源系统专业定义
- **WHEN** 进行目标系统建模
- **THEN** 应区分标准专业和业务视图专业

### Requirement: MUST 专业与定额集必须分开兼容

MUST 兼容层必须将专业与定额集视为不同维度，不得因为源系统中存在映射关系就将其合并为一个概念。

#### Scenario: 导入定额集

- **GIVEN** 源系统提供专业和定额集映射
- **WHEN** 系统设计兼容模型
- **THEN** 专业和定额集应分别建模

### Requirement: MUST Markup等源编码必须保留但不应直接视为稳定主键

MUST 像 `Markup` 这类源系统编码必须保留用于兼容和追溯，但不应未经处理直接作为长期稳定主键。

#### Scenario: 保存源专业编码

- **GIVEN** 系统读取源专业定义中的 `Markup`
- **WHEN** 系统持久化该值
- **THEN** 应将其作为来源字段保留
- **AND** 不应直接等同于系统内部唯一主键

### Requirement: MUST 源系统清单字段必须保留层级和规范语义

MUST 源系统中的清单编号、层级码、规范版本码和源 ID 等字段必须保留，以维持高保真兼容与追溯能力。

#### Scenario: 解释清单字段

- **GIVEN** 系统读取源清单项目字段
- **WHEN** 执行兼容映射
- **THEN** 应保留清单编号、层级、规范版本和源记录标识

### Requirement: MUST 源系统工作内容必须允许独立表达

MUST 当源系统中工作内容是独立结构时，兼容层必须允许其在目标系统中独立表达，而不是只能退化为单一文本。

#### Scenario: 兼容工作内容子表

- **GIVEN** 源系统工作内容是多条子记录
- **WHEN** 系统执行兼容建模
- **THEN** 应允许将其作为独立从属结构保存

### Requirement: MUST 源系统兼容必须优先保留确定信息，避免过度推断

MUST 兼容专题文档和兼容实现都必须优先固化已确认信息，不应把尚未验证的字段语义过度推断为正式规则。

#### Scenario: 遇到未完全验证字段

- **GIVEN** 某源字段语义尚未完全确认
- **WHEN** 系统整理兼容文档
- **THEN** 应明确其未确认状态
- **AND** 不应过度推断为确定规则

## Implementation Notes

以下内容是当前仓库实现现状的观察，不属于规范要求本身：

- 当前仓库已有 [profession-model.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/profession-model.md) 和 [source-field-mapping.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/source-field-mapping.md) 两份兼容基线文档。
- 现有数据模型设计已为 `source_field_code`、`source_markup`、`source_system` 等字段预留兼容落点。

这些现状说明源系统兼容专题已经有较明确基线，后续可继续拆到更细的专业、定额和清单专题。
