# Spec: 清单模块专题

## 概述

本 spec 定义新点 SaaS 造价系统中的清单模块专题规则，用于统一清单页面结构、版本与来源展示、树形明细、导入引用和校验提交流程。

本 spec 主要整理自以下文档：

- [设计文档_v1.0_优化中.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/设计文档_v1.0_优化中.md)
- [data-model.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/data-model.md)

## ADDED Requirements

### Requirement: MUST 清单模块必须以版本为核心上下文

MUST 清单模块的所有读取、编辑、引用和提交动作都必须围绕清单版本上下文进行，不应脱离版本直接修改清单树。

#### Scenario: 打开清单页

- **GIVEN** 用户进入清单管理页
- **WHEN** 页面加载当前数据
- **THEN** 页面必须明确当前清单版本上下文

### Requirement: MUST 清单页面必须显式展示版本和来源

MUST 清单页面必须显式展示当前阶段、当前版本号、来源版本、锁定状态、创建人和变更原因。

#### Scenario: 查看清单版本头信息

- **GIVEN** 用户打开清单页
- **WHEN** 页面渲染头部信息
- **THEN** 用户应能直接看到版本与来源关系

### Requirement: MUST 清单树必须支持层级、排序和来源追溯

MUST 清单明细必须支持树形层级、同级排序和来源追溯，不能仅以平铺列表表达正式业务结构。

#### Scenario: 查看清单树

- **GIVEN** 某清单版本存在章、节、清单项层级
- **WHEN** 系统展示该版本
- **THEN** 应按树结构展示并可追溯来源

### Requirement: MUST 导入、引用和结算生成必须形成不同来源语义

MUST 清单版本应能区分导入生成、上游引用、合同基线生成、过程变更和竣工结算生成等不同来源语义。

#### Scenario: 从上游引用生成版本

- **GIVEN** 用户执行引用上游版本
- **WHEN** 新版本生成
- **THEN** 系统应保留其来源语义和链路关系

### Requirement: MUST 清单提交前必须执行核心校验

MUST 清单提交前至少必须校验编号唯一性、核心字段完整性、特征或计算规则完整性、价格来源依据和过程单据绑定关系。

#### Scenario: 提交施工过程清单

- **GIVEN** 用户提交施工过程清单
- **WHEN** 系统执行校验
- **THEN** 若存在未绑定过程单据的调整项应阻止提交

## Implementation Notes

以下内容是当前仓库实现现状的观察，不属于规范要求本身：

- 当前仓库已有 `BillVersionService`、`BillItemService`、`bill-item-repository` 等清单主链骨架。
- `apps/frontend` 当前已具备清单页和版本选择器基础骨架。

这些现状说明清单模块主线已经具备较强落地基础，但完整交互和规则实现仍在持续完善中。
