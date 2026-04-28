# Spec: 导入映射规则

## 概述

本 spec 定义新点源系统数据导入到 SaaS 造价系统时的字段映射与保留原则，用于统一旧系统导入、兼容层设计、ETL 转换和导入后追溯能力。

本 spec 主要整理自以下文档：

- [source-field-mapping.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/source-field-mapping.md)
- [设计文档_v1.0_优化中.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/设计文档_v1.0_优化中.md)

本 spec 关注稳定导入口径，不直接规定具体脚本实现方式。

## ADDED Requirements

### Requirement: MUST 导入必须优先保留源系统主键和编码

MUST 系统在导入旧系统数据时，必须优先保留源系统主键、编码、版本字段和上下文标识，避免后续无法追溯来源。

#### Scenario: 导入源清单数据

- **GIVEN** 用户导入来自旧系统的清单数据
- **WHEN** 系统执行字段映射
- **THEN** 系统应保留源系统中的关键 ID、编码和规范版本字段
- **AND** 不应只保留展示值后丢失来源标识

### Requirement: MUST 不同语义的源字段不能被粗暴合并

MUST 系统不得把语义不同的源字段强行合并为同一个目标字段，除非该合并仅用于展示且不会破坏业务语义。

#### Scenario: 映射层级与来源字段

- **GIVEN** 源系统中同时存在层级编码、主键和顺序字段
- **WHEN** 系统设计 SaaS 目标字段
- **THEN** 系统应区分层级、主键和排序语义
- **AND** 不应仅用一个字段替代所有来源信息

### Requirement: MUST 无法完全映射的源字段必须有保留落点

MUST 当源字段暂时无法完全纳入 V1 业务模型时，系统必须为其提供保留落点，如预留字段或原始载荷字段，而不是直接丢弃。

#### Scenario: 处理暂不支持的源字段

- **GIVEN** 某个源字段当前没有稳定目标字段
- **WHEN** 导入流程执行
- **THEN** 系统应将其保留到兼容字段或原始数据载荷中

### Requirement: MUST 专业、定额集和清单规范版本必须分开建模

MUST 系统必须将专业、定额集和清单规范版本视为不同建模维度，不得混为单一编码概念。

#### Scenario: 映射专业与定额集

- **GIVEN** 导入数据同时包含专业编码和定额集编码
- **WHEN** 系统建立目标模型
- **THEN** 应分别落到对应维度
- **AND** 不应将二者混用为同一主键

### Requirement: MUST 清单导入必须保留版本与来源上下文

MUST 导入清单集合、清单项和工作内容时，系统必须保留清单规范版本、源清单 ID、源序号和来源层级等关键上下文。

#### Scenario: 导入清单项

- **GIVEN** 导入源系统清单项
- **WHEN** 系统映射到 `bill_version` 与 `bill_item`
- **THEN** 系统应保留版本级来源字段和清单项级来源字段
- **AND** 导入后仍应能追溯到原始清单结构

### Requirement: MUST 工作内容必须允许作为独立子表导入

MUST 若源系统将工作内容建模为独立子表，系统必须允许其以独立从属结构导入，而不是全部塞入单个文本字段。

#### Scenario: 导入工作内容

- **GIVEN** 源系统工作内容是独立明细结构
- **WHEN** 系统执行高保真导入
- **THEN** 系统应允许将工作内容作为独立从属记录保存

### Requirement: MUST 参考价格不能直接当作正式计价结果

MUST 源系统中的参考单价、标准价格或类似字段，只能作为参考来源，不得在导入时直接覆盖为正式业务价格。

#### Scenario: 导入参考价格

- **GIVEN** 源清单项包含参考价格
- **WHEN** 系统导入该字段
- **THEN** 系统应将其作为来源参考信息保存
- **AND** 不应直接视为正式综合单价

### Requirement: MUST 导入必须生成当前阶段的初始版本

MUST 当用户以 Excel、XML、GBQ 或其他源格式导入业务数据时，系统必须在当前阶段生成可追溯的初始版本。

#### Scenario: 导入生成版本

- **GIVEN** 用户在某项目阶段执行导入
- **WHEN** 导入成功
- **THEN** 系统应生成该阶段的初始版本
- **AND** 该版本应带有导入来源说明

### Requirement: MUST 导入动作必须受权限和审计控制

MUST 源数据导入必须受独立 `import` 权限约束，并保留导入人、导入时间和导入摘要等审计信息。

#### Scenario: 执行源数据导入

- **GIVEN** 用户发起导入
- **WHEN** 系统校验该动作
- **THEN** 系统应判断用户是否具备导入权限
- **AND** 导入成功或失败都应保留可追溯记录

## Implementation Notes

以下内容是当前仓库实现现状的观察，不属于规范要求本身：

- 当前仓库已有 [source-field-mapping.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/source-field-mapping.md) 作为主要映射基线。
- 当前代码与迭代拆分中已预留 `import` 权限和导入主链能力，但完整导入实现仍未全部落齐。
- 当前文档已经明确 `bill_version`、`bill_item`、`bill_item_work_item` 需要保留多类源字段。

这些现状说明导入口径已经明确，但完整实现仍属于后续工程工作。
