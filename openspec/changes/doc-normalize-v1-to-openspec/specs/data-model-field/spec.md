# Spec: 数据模型字段规范

## 概述

本 spec 定义新点 SaaS 造价系统的数据模型字段规范，用于统一根对象归属、版本头与明细行模式、状态字段口径、源系统兼容字段保留和关键唯一约束。

本 spec 主要整理自以下文档：

- [data-model.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/data-model.md)
- [source-field-mapping.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/source-field-mapping.md)

## ADDED Requirements

### Requirement: 项目必须作为业务根对象

所有核心业务数据必须归属到某个项目，不得出现脱离项目根对象的正式业务记录。

#### Scenario: 创建正式业务记录

- **GIVEN** 系统要创建某条正式业务记录
- **WHEN** 该记录进入持久化层
- **THEN** 其必须能够追溯到所属项目

### Requirement: 阶段配置必须独立建模

阶段配置必须作为独立对象建模，不得简单把全部阶段状态塞回项目主表。

#### Scenario: 管理项目阶段

- **GIVEN** 某项目启用了多个阶段
- **WHEN** 系统保存阶段配置
- **THEN** 每个启用阶段应有独立配置记录

### Requirement: 清单必须采用版本头加明细行模式

清单主链必须采用“版本头 + 明细行 + 从属明细”的建模方式，以支持引用、分叉、锁定和追溯。

#### Scenario: 保存清单版本

- **GIVEN** 某项目产生新的清单成果
- **WHEN** 系统落库
- **THEN** 应存在版本头记录
- **AND** 其下应挂载清单明细行和从属数据

### Requirement: 定额明细必须挂载在清单上下文之下

项目内定额明细必须挂载在清单项或等价业务上下文之下，不应作为脱离业务上下文的独立项目根数据任意存在。

#### Scenario: 保存定额行

- **GIVEN** 用户为某清单项配置定额
- **WHEN** 系统保存该定额行
- **THEN** 该定额行应能追溯到所属清单项

### Requirement: 过程单据必须独立建模

变更单、签证单、进度款和结算记录必须作为独立业务对象建模，不能以直接改写基线的方式替代。

#### Scenario: 发生施工过程调整

- **GIVEN** 某项过程调整需要记录
- **WHEN** 系统建模该事项
- **THEN** 应建立独立过程单据记录

### Requirement: 审计日志必须采用多态资源关联

审计日志必须支持多态资源关联，以覆盖项目、阶段、版本、清单项、过程单据、AI 结果和任务等关键对象。

#### Scenario: 写入审计日志

- **GIVEN** 某关键对象发生操作
- **WHEN** 系统写审计记录
- **THEN** 审计日志应保留资源类型和资源标识

### Requirement: AI结果必须与正式业务数据隔离存储

AI 推荐、预警和类似辅助结果必须与正式业务数据隔离存储，不能直接覆盖正式业务表。

#### Scenario: 保存AI推荐

- **GIVEN** 系统生成一条 AI 推荐
- **WHEN** 持久化该结果
- **THEN** 应保存到独立的 AI 结果模型中

### Requirement: 源系统兼容字段必须在V1保留白名单中明确保留

对接源系统时，系统必须保留一批关键兼容字段，包括源主键、规范编码、定额集编码、层级字段等。

#### Scenario: 导入源系统清单项

- **GIVEN** 用户导入旧系统清单项
- **WHEN** 系统执行建模映射
- **THEN** 源主键和关键编码字段不得被默认丢弃

### Requirement: 关键业务对象必须具备稳定唯一约束

项目、阶段配置、版本头、角色范围和主数据对象必须具备稳定唯一约束，避免同一业务语义被重复写入。

#### Scenario: 创建项目专业配置

- **GIVEN** 某项目已经存在一条相同专业配置
- **WHEN** 用户再次创建同一配置
- **THEN** 系统应通过唯一约束或等价规则阻止重复

## Implementation Notes

以下内容是当前仓库实现现状的观察，不属于规范要求本身：

- 当前仓库已有 [data-model.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/data-model.md) 作为主要字段规范基线。
- `apps/api/src/infrastructure/database/schema.ts` 已落下部分业务表、知识表、记忆表和审计表结构。
- 代码实现中的部分字段命名和状态集合目前比设计文档更简化。

这些现状说明字段规范主线已形成，但完整字段体系仍以后续设计文档和迁移策略共同收口。
