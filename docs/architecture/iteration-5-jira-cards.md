# 新点 SaaS 造价系统 Iteration 5 Jira/Tapd 任务卡

> 基于 [iteration-5-task-breakdown.md](/Users/huahaha/Documents/New%20project/docs/architecture/iteration-5-task-breakdown.md) 与 [master-delivery-roadmap.md](/Users/huahaha/Documents/New%20project/docs/architecture/master-delivery-roadmap.md) 整理。

## 1. 使用说明

这份文档把 `Iteration 5` 转成更像 Jira/Tapd 的任务卡格式，适合直接抄进项目管理工具。

每张卡包含：

- `Key`：建议任务编号
- `Title`：任务标题
- `Type`：任务类型
- `Priority`：优先级
- `Owner`：建议负责人类型
- `Depends On`：前置依赖
- `Description`：任务说明
- `Acceptance`：验收标准

## 2. Epic 结构

建议把 `Iteration 5` 拆成 7 个 Epic：

- `I5-EPIC-1` AI 推荐基础表与适配层
- `I5-EPIC-2` AI 清单推荐
- `I5-EPIC-3` AI 定额推荐
- `I5-EPIC-4` 偏差预警与失效机制
- `I5-EPIC-5` 人工确认、权限与审计
- `I5-EPIC-6` 前端 AI 面板
- `I5-EPIC-7` AI 原生底座预留

## 3. 任务卡

### I5-EPIC-1 AI 推荐基础表与适配层

#### I5-01

- `Key`: `I5-01`
- `Title`: 创建 AI 推荐表迁移
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I4-01`, `I4-02`
- `Description`: 创建 `ai_recommendation` 表，并补齐项目、资源、推荐类型、状态、输入输出字段与索引。
- `Acceptance`:
  - 表可完成迁移
  - 可按项目、资源和类型快速查询推荐记录

#### I5-02

- `Key`: `I5-02`
- `Title`: 固化 AI 推荐类型与状态枚举
- `Type`: Task
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I5-01`
- `Description`: 固化 `bill_recommendation`、`quota_recommendation`、`variance_warning` 和 `generated / accepted / ignored / expired`。
- `Acceptance`:
  - 枚举值与状态机文档一致
  - 代码侧统一使用

#### I5-03

- `Key`: `I5-03`
- `Title`: 实现 AI Provider 适配层
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I5-01`, `I5-02`
- `Description`: 封装 AI Provider 调用、超时、重试、错误处理和输入输出摘要记录。
- `Acceptance`:
  - AI 失败不会阻断主业务流程
  - AI 请求上下文可追溯

### I5-EPIC-2 AI 清单推荐

#### I5-04

- `Key`: `I5-04`
- `Title`: 实现清单推荐输入上下文生成
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I5-03`, `I2-09`, `I2-10`
- `Description`: 为新建清单版本、引用版本和缺失项场景生成 AI 清单推荐输入上下文。
- `Acceptance`:
  - 可生成清单推荐输入
  - 输入上下文可覆盖来源链和当前版本信息

#### I5-05

- `Key`: `I5-05`
- `Title`: 实现 AI 清单推荐接口
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I5-04`
- `Description`: 增加 `POST /api/v1/ai/bill-recommendations` 与推荐结果查询接口。
- `Acceptance`:
  - 可生成清单推荐结果
  - 推荐结果落到 `ai_recommendation`

#### I5-06

- `Key`: `I5-06`
- `Title`: 清单推荐前端面板实现
- `Type`: Story
- `Priority`: P1
- `Owner`: Frontend
- `Depends On`: `I5-05`
- `Description`: 实现 AI 清单推荐面板与推荐卡片展示。
- `Acceptance`:
  - 可查看推荐内容、来源和状态
  - 未接受前不改写正式清单

### I5-EPIC-3 AI 定额推荐

#### I5-07

- `Key`: `I5-07`
- `Title`: 实现定额推荐输入上下文生成
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I5-03`, `I3-04`, `I3-06`
- `Description`: 为清单项定额推荐和替代方案推荐生成上下文。
- `Acceptance`:
  - 可生成定额推荐输入
  - 输入上下文覆盖清单项和定额候选信息

#### I5-08

- `Key`: `I5-08`
- `Title`: 实现 AI 定额推荐接口
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I5-07`
- `Description`: 增加 `POST /api/v1/ai/quota-recommendations` 与推荐结果查询接口。
- `Acceptance`:
  - 可生成定额推荐结果
  - 推荐结果落到 `ai_recommendation`

#### I5-09

- `Key`: `I5-09`
- `Title`: 定额推荐前端面板实现
- `Type`: Story
- `Priority`: P1
- `Owner`: Frontend
- `Depends On`: `I5-08`
- `Description`: 实现 AI 定额推荐面板与候选方案展示。
- `Acceptance`:
  - 可查看定额推荐内容
  - 未接受前不改写正式定额

### I5-EPIC-4 偏差预警与失效机制

#### I5-10

- `Key`: `I5-10`
- `Title`: 实现偏差预警生成服务
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I4-06`, `I4-07`, `I5-03`
- `Description`: 按项目、阶段、专业、单体和系统值/最终值差异生成偏差预警。
- `Acceptance`:
  - 可生成偏差预警
  - 预警结果落到 `ai_recommendation`

#### I5-11

- `Key`: `I5-11`
- `Title`: 实现偏差预警接口与阈值配置
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I5-10`
- `Description`: 增加 `variance-warnings` 接口，并支持项目级、阶段级阈值配置。
- `Acceptance`:
  - 可按阈值生成预警
  - 阈值变化后可重新生成

#### I5-12

- `Key`: `I5-12`
- `Title`: 实现推荐失效机制
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I5-05`, `I5-08`, `I5-10`
- `Description`: 在版本、定额上下文或阶段变化时，将旧推荐自动置为 `expired`。
- `Acceptance`:
  - 旧推荐不会长期污染页面
  - 失效状态可查询

#### I5-13

- `Key`: `I5-13`
- `Title`: 偏差预警前端展示实现
- `Type`: Story
- `Priority`: P1
- `Owner`: Frontend
- `Depends On`: `I5-11`
- `Description`: 在汇总页高亮偏差预警并支持查看详情。
- `Acceptance`:
  - 汇总页可展示高优先级预警
  - 可查看预警详情

### I5-EPIC-5 人工确认、权限与审计

#### I5-14

- `Key`: `I5-14`
- `Title`: 实现推荐接受与忽略接口
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I5-05`, `I5-08`
- `Description`: 增加 `accept`、`ignore` 接口，支持推荐从 `generated` 进入 `accepted` 或 `ignored`。
- `Acceptance`:
  - 用户可接受或忽略推荐
  - 状态变化可正确保存

#### I5-15

- `Key`: `I5-15`
- `Title`: 实现人工确认落正式数据
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I5-14`, `I2-10`, `I3-04`
- `Description`: 接受清单推荐时写正式 `bill_item`，接受定额推荐时写正式 `quota_line`。
- `Acceptance`:
  - 接受动作可真正落库
  - AI 推荐不会自动直接写正式表

#### I5-16

- `Key`: `I5-16`
- `Title`: 接入 AI 权限与按钮控制
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I1-09`, `I5-14`
- `Description`: 接入 AI 推荐查看、接受、忽略和偏差预警查看权限。
- `Acceptance`:
  - `cost_engineer` 可处理推荐
  - `reviewer` 只能查看不能接受写入

#### I5-17

- `Key`: `I5-17`
- `Title`: 接入 AI 推荐审计日志
- `Type`: Story
- `Priority`: P1
- `Owner`: Backend
- `Depends On`: `I5-14`, `I5-15`, `I5-12`
- `Description`: 为推荐生成、接受、忽略、失效写审计日志。
- `Acceptance`:
  - 任意推荐处理动作都可追溯

### I5-EPIC-6 前端 AI 面板

#### I5-18

- `Key`: `I5-18`
- `Title`: 推荐确认弹层与推荐历史实现
- `Type`: Story
- `Priority`: P1
- `Owner`: Frontend
- `Depends On`: `I5-14`, `I5-15`
- `Description`: 实现接受确认弹层、忽略动作和推荐历史查看区。
- `Acceptance`:
  - 可接受和忽略推荐
  - 可查看历史推荐记录

#### I5-19

- `Key`: `I5-19`
- `Title`: AI 推荐面板统一整合
- `Type`: Story
- `Priority`: P1
- `Owner`: Frontend
- `Depends On`: `I5-06`, `I5-09`, `I5-13`, `I5-18`
- `Description`: 统一整合清单推荐、定额推荐和偏差预警面板。
- `Acceptance`:
  - 可按资源类型分区查看推荐
  - 已失效推荐有明显标记

#### I5-20

- `Key`: `I5-20`
- `Title`: Iteration 5 集成测试与回归
- `Type`: Test
- `Priority`: P0
- `Owner`: QA
- `Depends On`: `I5-05`, `I5-08`, `I5-11`, `I5-12`, `I5-15`, `I5-16`
- `Description`: 对清单推荐、定额推荐、偏差预警、接受/忽略、失效机制和 AI 权限做联调回归。
- `Acceptance`:
  - AI 推荐主流程通过
  - 推荐失效主流程通过
  - 接受/忽略主流程通过
  - AI 权限规则通过

### I5-EPIC-7 AI 原生底座预留

#### I5-21

- `Key`: `I5-21`
- `Title`: 创建知识与记忆基础表迁移
- `Type`: Story
- `Priority`: P1
- `Owner`: Backend
- `Depends On`: `I5-01`, `I4-02`
- `Description`: 创建 `knowledge_entry`、`memory_entry`、`skill_definition`、`knowledge_relation` 四张基础表，并补齐索引与基础约束，为知识沉淀、系统记忆和技能定义预留正式存储结构。
- `Acceptance`:
  - 四张表可完成迁移
  - 关键索引与基础约束创建完成
  - 至少支持知识条目和记忆条目的基础落库

#### I5-22

- `Key`: `I5-22`
- `Title`: 预留 MCP 上下文聚合能力
- `Type`: Story
- `Priority`: P1
- `Owner`: Backend
- `Depends On`: `I5-03`, `I5-21`
- `Description`: 预留 `get_project_context`、`get_stage_context`、`get_bill_version_context`、`search_knowledge_entries` 等 MCP 能力对应的上下文聚合服务，确保 AI 工具后续可通过高层上下文接入系统，而不是直接拼接底层 REST 请求。
- `Acceptance`:
  - 项目级和阶段级上下文具备聚合服务预留
  - 知识搜索具备统一入口预留
  - 上下文能力仍受项目、阶段和资源权限裁剪

#### I5-23

- `Key`: `I5-23`
- `Title`: 预留知识与记忆抽取入口
- `Type`: Story
- `Priority`: P1
- `Owner`: Backend
- `Depends On`: `I5-17`, `I5-21`
- `Description`: 为项目复盘结论、审核驳回原因、推荐反馈结果预留知识沉淀入口，并为项目偏好、组织偏好和 AI 运行反馈预留记忆写入入口，形成后续 AI 增智闭环的基础能力。
- `Acceptance`:
  - 至少一类复盘结论可写入 `knowledge_entry`
  - 至少一类项目或组织偏好可写入 `memory_entry`
  - 知识生成与记忆更新具备审计动作预留

## 4. 建议泳道

如果你要直接导入 Jira/Tapd，建议按下面 4 个泳道建：

- `Backend`
- `Frontend`
- `QA`
- `Architecture/AI`

## 5. 建议优先级执行顺序

推荐按下面顺序拉开发：

1. `I5-01`
2. `I5-02`
3. `I5-03`
4. `I5-04`
5. `I5-07`
6. `I5-05`
7. `I5-08`
8. `I5-10`
9. `I5-11`
10. `I5-12`
11. `I5-14`
12. `I5-15`
13. `I5-16`
14. `I5-17`
15. `I5-21`
16. `I5-22`
17. `I5-23`
18. 前端相关卡并行接入
19. `I5-20`

## 6. 建议作为 Sprint Goal 的一句话

完成 AI 推荐、偏差预警、人工确认和 AI 原生底座预留主链，让系统在不破坏正式数据的前提下具备 AI 辅助与长期增智扩展能力。
