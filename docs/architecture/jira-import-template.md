# 新点 SaaS 造价系统 Jira 导入字段模板

> 基于 [iteration-1-jira-cards.md](/Users/huahaha/Documents/New%20project/docs/architecture/iteration-1-jira-cards.md)、[iteration-2-jira-cards.md](/Users/huahaha/Documents/New%20project/docs/architecture/iteration-2-jira-cards.md)、[iteration-3-jira-cards.md](/Users/huahaha/Documents/New%20project/docs/architecture/iteration-3-jira-cards.md)、[iteration-4-jira-cards.md](/Users/huahaha/Documents/New%20project/docs/architecture/iteration-4-jira-cards.md) 与 [iteration-5-jira-cards.md](/Users/huahaha/Documents/New%20project/docs/architecture/iteration-5-jira-cards.md) 整理。

## 1. 文档目标

本文档用于把已经整理好的 Jira/Tapd 风格任务卡，进一步压成可导入 Jira、Tapd 或 Excel 的字段模板。

你可以把这份文档当成：

- Jira CSV 导入字段说明
- Tapd 批量导入字段参考
- 团队排期表的统一列模板

## 2. 推荐导入列

建议至少保留下面这些列：

| 列名 | 是否必填 | 用途 |
|------|---------|------|
| `Issue Key` | 否 | 如果系统支持自定义编号可填，否则留空 |
| `Summary` | 是 | 任务标题 |
| `Issue Type` | 是 | Epic / Story / Task / Test |
| `Priority` | 是 | P0 / P1 / P2 |
| `Epic Link` | 否 | 所属 Epic |
| `Sprint` | 否 | 所属 Sprint |
| `Assignee` | 否 | 负责人 |
| `Component` | 否 | Backend / Frontend / QA / Architecture |
| `Labels` | 否 | 迭代标签、模块标签 |
| `Depends On` | 否 | 前置依赖任务编号 |
| `Description` | 是 | 任务描述 |
| `Acceptance Criteria` | 是 | 验收标准 |
| `Iteration` | 是 | I1 / I2 / I3 / I4 / I5 |
| `Epic Name` | 否 | 如果这一行是 Epic，可填 Epic 展示名 |
| `Sprint Goal` | 否 | 建议仅在 Epic 或 Sprint 汇总行里使用 |

## 3. 字段填写规则

## 3.1 Summary

直接使用任务卡中的 `Title`。

例如：

- `创建项目基础表迁移`
- `实现清单版本服务`
- `实现单项计价接口`

## 3.2 Issue Type

统一映射如下：

- `Epic`
- `Story`
- `Task`
- `Test`

说明：

- 每个迭代下建议先导入 Epic
- 再导入 Story / Task / Test

## 3.3 Priority

建议统一保留 `P0 / P1 / P2` 口径，不要在导入前改成别的命名。

如果 Jira 项目里只能用默认优先级，可这样映射：

| 文档优先级 | Jira 建议映射 |
|-----------|--------------|
| `P0` | Highest |
| `P1` | High |
| `P2` | Medium |

## 3.4 Epic Link

任务行填所属 Epic 编号。

例如：

- `I1-01` -> `I1-EPIC-1`
- `I2-14` -> `I2-EPIC-4`
- `I5-15` -> `I5-EPIC-5`

## 3.5 Component

建议统一映射：

| Owner | Component |
|------|-----------|
| Backend | Backend |
| Frontend | Frontend |
| QA | QA |
| Architecture/Init | Architecture |
| Architecture/Import | Architecture |
| Architecture/Pricing | Architecture |
| Architecture/ReviewReport | Architecture |
| Architecture/AI | Architecture |

## 3.6 Labels

建议每条任务至少打 2 类标签：

### 迭代标签

- `iteration-1`
- `iteration-2`
- `iteration-3`
- `iteration-4`
- `iteration-5`

### 模块标签

例如：

- `project`
- `stage`
- `permission`
- `bill`
- `version-chain`
- `import`
- `quota`
- `pricing-engine`
- `review`
- `report`
- `audit-log`
- `ai`

推荐组合：

- `I1-03` -> `iteration-1,project`
- `I2-14` -> `iteration-2,bill,import`
- `I3-11` -> `iteration-3,pricing-engine`
- `I4-09` -> `iteration-4,report`
- `I5-15` -> `iteration-5,ai`

## 3.7 Depends On

这一列可以直接保留任务编号，哪怕 Jira 不能直接识别，也方便后续手工建立依赖。

建议写成逗号分隔：

- `I1-01,I1-02`
- `I2-13,I2-08,I2-10,I2-06`

## 3.8 Description

直接使用任务卡中的 `Description`。

建议保持一句话到两句话，不要再展开成长文。

## 3.9 Acceptance Criteria

建议用换行或分号分隔。

例如：

`可创建空白清单版本；可按项目和阶段查询版本`

或者：

```text
可创建空白清单版本
可按项目和阶段查询版本
```

## 4. 推荐导入顺序

建议按下面顺序导入：

1. 先导入所有 Epic
2. 再导入 `I1` 全部任务
3. 再导入 `I2` 全部任务
4. 再导入 `I3` 全部任务
5. 再导入 `I4` 全部任务
6. 最后导入 `I5` 全部任务

原因：

- 这样最符合主依赖链
- Epic Link 不容易挂错
- 项目工具里看板层次也更清楚

## 5. Excel/CSV 列模板

你如果要自己整理成 Excel，建议第一行列名就是：

```csv
Issue Key,Summary,Issue Type,Priority,Epic Link,Sprint,Assignee,Component,Labels,Depends On,Description,Acceptance Criteria,Iteration,Epic Name,Sprint Goal
```

## 6. 示例行

下面给你 3 条可以直接参考的示例：

```csv
I1-03,实现项目创建接口,Story,P0,I1-EPIC-1,Sprint 1,,Backend,"iteration-1,project","I1-01,I1-02","实现 POST /api/v1/projects，支持创建项目、展开默认阶段模板、写入负责人。","创建后可返回项目详情；自动生成默认阶段配置；项目负责人自动成为项目成员",I1,,
I2-14,实现导入字段映射与落库,Story,P0,I2-EPIC-4,Sprint 2,,Backend,"iteration-2,bill,import","I2-13,I2-08,I2-10,I2-06","按映射规则创建 bill_version、bill_item、bill_item_work_item。","可导入一版完整初始清单；导入后可看到树结构和工作内容",I2,,
I3-11,实现单项计价接口,Story,P0,I3-EPIC-4,Sprint 3,,Backend,"iteration-3,pricing-engine","I3-04,I3-08,I3-09","实现 POST /api/v1/engine/calculate，根据定额、价目和取费计算系统值。","可计算 system_unit_price；可计算 system_amount",I3,,
```

## 7. Epic 导入示例

Epic 行可以这样写：

```csv
I1-EPIC-1,项目与阶段底座,Epic,P0,,Sprint 1,,Architecture,"iteration-1,epic",,"Iteration 1 下负责项目、阶段与基础配置底座。","完成后系统可创建项目、配置阶段并进入工作台",I1,项目与阶段底座,完成项目、阶段、成员、专业和工作台底座，让系统具备进入正式业务流程前的项目级配置能力。
```

## 8. Sprint 建议映射

如果你打算直接按迭代建 Sprint，可以这样映射：

| Iteration | Sprint 建议 |
|----------|------------|
| `I1` | `Sprint 1` |
| `I2` | `Sprint 2` |
| `I3` | `Sprint 3` |
| `I4` | `Sprint 4` |
| `I5` | `Sprint 5` |

如果团队人数少、周期更长，也可以这样映射：

| Iteration | Sprint 建议 |
|----------|------------|
| `I1` | `Sprint 1-2` |
| `I2` | `Sprint 3` |
| `I3` | `Sprint 4` |
| `I4` | `Sprint 5` |
| `I5` | `Sprint 6` |

## 9. 最建议你现在怎么用

最实用的用法是：

1. 先在 Jira/Tapd 建 5 个 Epic 大类
2. 再按这份模板先导入 `I1` 和 `I2`
3. `I3-I5` 先导入到 Backlog
4. 先跑通 `Sprint 1`

这样团队不会一上来就被 100 多条任务压住，但路线已经完整了。

