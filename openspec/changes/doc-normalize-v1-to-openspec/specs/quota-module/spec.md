# Spec: 定额模块专题

## 概述

本 spec 定义新点 SaaS 造价系统中的定额模块专题规则，用于统一定额套用页、定额选择器、价目同步、含量调整、套用校验和人工确认边界。

本 spec 主要整理自以下文档：

- [设计文档_v1.0_优化中.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/设计文档_v1.0_优化中.md)
- [profession-model.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/profession-model.md)
- [iteration-3-jira-cards.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/iteration-3-jira-cards.md)

## ADDED Requirements

### Requirement: 定额模块必须在清单上下文中工作

定额模块必须围绕当前清单项工作，不能脱离清单上下文孤立进行正式定额处理。

#### Scenario: 打开定额页

- **GIVEN** 用户进入定额套用页
- **WHEN** 页面加载数据
- **THEN** 页面应明确当前清单项和当前版本上下文

### Requirement: 定额页面必须展示价目版本和来源方式

定额页面必须能够展示当前定额所使用的价目版本、所属地区和来源方式。

#### Scenario: 查看定额明细

- **GIVEN** 用户查看定额列表
- **WHEN** 页面展示明细字段
- **THEN** 应能看到价目版本、地区和来源方式

### Requirement: 定额选择器必须支持按专业、定额集和地区查询

定额选择器必须支持至少按专业、定额集、地区和关键字查询候选定额。

#### Scenario: 查询候选定额

- **GIVEN** 用户在选择器中查找定额
- **WHEN** 用户切换定额集或地区
- **THEN** 系统应按当前上下文重新过滤候选结果

### Requirement: 套用校验必须覆盖缺定额、单位不一致和异常含量

定额模块必须至少校验缺定额、单位不一致、异常含量、负数费用以及过程单据绑定等核心问题。

#### Scenario: 执行套用校验

- **GIVEN** 用户完成定额套用
- **WHEN** 系统执行校验
- **THEN** 应检查缺定额、单位不一致和异常含量等问题

### Requirement: AI定额推荐必须经过人工确认

AI 生成的定额候选只能作为推荐结果，必须经过人工筛选和确认后才能成为正式定额套用结果。

#### Scenario: 接受AI定额推荐

- **GIVEN** 系统生成定额推荐
- **WHEN** 用户决定采用其中部分结果
- **THEN** 该结果必须经过人工确认后才可保存为正式定额结果

### Requirement: 参考定额知识库必须作为只读候选来源

外部定额数据资产、向量索引和历史套用样本可以补充定额候选召回，但必须以只读参考库接入，不得绕过人工确认直接写入正式 `quota_line`。

#### Scenario: 从参考库召回候选定额

- **GIVEN** 系统已接入地区定额、资源组成或向量检索资产
- **WHEN** 用户在定额选择器或 AI 定额推荐中查询候选
- **THEN** 候选结果应携带来源库、地区、匹配说明、工作内容摘要和资源组成摘要
- **AND** 用户确认前不得生成正式定额行

### Requirement: 定额候选必须保留可解释匹配信息

定额候选结果必须说明命中方式和关键依据，至少覆盖关键字命中、默认定额集候选、历史引用或语义召回等来源说明。

#### Scenario: 查看候选定额解释

- **GIVEN** 用户查看候选定额列表
- **WHEN** 系统展示候选结果
- **THEN** 用户应能看到候选来源、匹配理由和费用组成摘要
- **AND** 这些解释信息不得替代人工审核结论

## Implementation Notes

以下内容是当前仓库实现现状的观察，不属于规范要求本身：

- 当前仓库已有 `quota_line` 仓储与服务骨架，并已接入部分可编辑状态校验。
- 当前文档和迭代卡片已明确“定额管理与选择器”是独立模块专题。
- 当前候选定额接口已开始返回来源库、费用组成和匹配说明。
- 当前仓库已新增 `reference_quota` 只读参考定额表、仓储、数据库迁移和 DDC-CWICR CSV 离线转换脚本。
- 当前 AI Runtime 已能识别 Qdrant embeddings snapshot 的向量配置和 payload schema，并提供参考定额语义召回适配层；传入 Qdrant 地址、collection 和 query vector 时走真实向量近邻查询，未部署 Qdrant collection 时使用文本回退排序。

这些现状说明定额模块主线已具备专题化基础，但完整选择器和校验体验仍属于后续实现工作。
