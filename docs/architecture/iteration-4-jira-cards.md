# 新点 SaaS 造价系统 Iteration 4 Jira/Tapd 任务卡

> 基于 [iteration-4-task-breakdown.md](/Users/huahaha/Documents/New%20project/docs/architecture/iteration-4-task-breakdown.md) 与 [master-delivery-roadmap.md](/Users/huahaha/Documents/New%20project/docs/architecture/master-delivery-roadmap.md) 整理。

## 1. 使用说明

这份文档把 `Iteration 4` 转成更像 Jira/Tapd 的任务卡格式，适合直接抄进项目管理工具。

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

建议把 `Iteration 4` 拆成 6 个 Epic：

- `I4-EPIC-1` 审核与审计基础表
- `I4-EPIC-2` 审核流与状态联动
- `I4-EPIC-3` 汇总与偏差分析
- `I4-EPIC-4` 报表导出任务
- `I4-EPIC-5` 权限与审计接入
- `I4-EPIC-6` 前端审核与汇总主链

## 3. 任务卡

### I4-EPIC-1 审核与审计基础表

#### I4-01

- `Key`: `I4-01`
- `Title`: 创建审核记录与审计日志表迁移
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I3-01`, `I3-03`
- `Description`: 创建 `review_submission`、`audit_log` 两张基础表，并补齐索引和约束。
- `Acceptance`:
  - 两张表可完成迁移
  - `review_submission` 支持按资源状态查询
  - `audit_log(resource_type, resource_id, created_at desc)` 可索引查询

#### I4-02

- `Key`: `I4-02`
- `Title`: 固化审核、导出与审计动作枚举
- `Type`: Task
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I4-01`
- `Description`: 固化审核状态、提交类型、报表任务状态与审计动作枚举。
- `Acceptance`:
  - 枚举值与状态机文档一致
  - 代码侧统一使用

### I4-EPIC-2 审核流与状态联动

#### I4-03

- `Key`: `I4-03`
- `Title`: 实现审核提交流程接口
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I4-01`, `I4-02`, `I3-16`
- `Description`: 实现 `POST /api/v1/projects/{id}/review-submissions`，支持提交审核并校验资源可提交态。
- `Acceptance`:
  - 可提交审核
  - 同一资源存在 `pending` 时不可重复提交

#### I4-04

- `Key`: `I4-04`
- `Title`: 实现审核通过、驳回、撤回接口
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I4-03`
- `Description`: 增加 `approve`、`reject`、`cancel` 接口。
- `Acceptance`:
  - 可通过、驳回、撤回
  - 审核人与提交人不能为同一人

#### I4-05

- `Key`: `I4-05`
- `Title`: 实现阶段、项目与版本状态联动
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I4-04`
- `Description`: 联动清单版本、阶段和项目状态，支持驳回回退和锁定申请流。
- `Acceptance`:
  - 审核通过后进入正确下游状态
  - 审核驳回后资源回到可编辑状态
  - 锁定申请可进入审核流

### I4-EPIC-3 汇总与偏差分析

#### I4-06

- `Key`: `I4-06`
- `Title`: 实现汇总查询接口
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I3-11`, `I3-12`, `I4-02`
- `Description`: 实现 `GET /api/v1/reports/summary`，支持按项目、阶段、专业、单体查询。
- `Acceptance`:
  - 可按 4 个维度汇总
  - 可区分系统值和最终值

#### I4-07

- `Key`: `I4-07`
- `Title`: 实现偏差分析服务
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I4-06`
- `Description`: 支持上游版本对比、系统值对比最终值、专业和单体维度偏差分析。
- `Acceptance`:
  - 可输出偏差金额和偏差比例
  - 可筛出高偏差清单项

#### I4-08

- `Key`: `I4-08`
- `Title`: 汇总页与偏差分析页前端实现
- `Type`: Story
- `Priority`: P1
- `Owner`: Frontend
- `Depends On`: `I4-06`, `I4-07`
- `Description`: 实现汇总页、多维筛选和偏差分析高亮展示。
- `Acceptance`:
  - 可筛选查看汇总
  - 可查看偏差金额、偏差率和异常项

### I4-EPIC-4 报表导出任务

#### I4-09

- `Key`: `I4-09`
- `Title`: 实现报表导出任务接口
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I4-06`
- `Description`: 实现 `POST /api/v1/reports/export`，并支持异步任务状态流转。
- `Acceptance`:
  - 导出接口返回 `202`
  - 任务进入 `queued`

#### I4-10

- `Key`: `I4-10`
- `Title`: 实现导出任务查询与下载接口
- `Type`: Story
- `Priority`: P1
- `Owner`: Backend
- `Depends On`: `I4-09`
- `Description`: 实现任务状态查询和下载接口。
- `Acceptance`:
  - 可查询 `queued / processing / completed / failed`
  - 任务完成后可下载

#### I4-11

- `Key`: `I4-11`
- `Title`: 报表中心前端实现
- `Type`: Story
- `Priority`: P1
- `Owner`: Frontend
- `Depends On`: `I4-09`, `I4-10`
- `Description`: 实现报表任务创建、状态展示和下载入口。
- `Acceptance`:
  - 可发起导出任务
  - 可查看任务状态与下载入口

### I4-EPIC-5 权限与审计接入

#### I4-12

- `Key`: `I4-12`
- `Title`: 接入审核、汇总、导出和审计权限
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I1-09`, `I4-03`, `I4-06`, `I4-09`
- `Description`: 接入 `review`、`summary:view`、`report:export`、`audit_log:view` 权限控制。
- `Acceptance`:
  - `reviewer` 可审核不能直接改业务数据
  - 无导出权限用户不可创建报表任务

#### I4-13

- `Key`: `I4-13`
- `Title`: 接入审核、导出和状态切换审计日志
- `Type`: Story
- `Priority`: P1
- `Owner`: Backend
- `Depends On`: `I4-04`, `I4-05`, `I4-09`
- `Description`: 为审核处理、状态联动和导出任务写审计日志。
- `Acceptance`:
  - 关键状态切换都有日志
  - `before_payload` / `after_payload` 覆盖核心字段

### I4-EPIC-6 前端审核与汇总主链

#### I4-14

- `Key`: `I4-14`
- `Title`: 审核弹层与审核处理页前端实现
- `Type`: Story
- `Priority`: P1
- `Owner`: Frontend
- `Depends On`: `I4-03`, `I4-04`
- `Description`: 实现提交审核弹层、审核处理页和通过/驳回/撤回操作。
- `Acceptance`:
  - 可提交审核
  - 可在前端执行通过/驳回/撤回

#### I4-15

- `Key`: `I4-15`
- `Title`: 审计日志页前端实现
- `Type`: Story
- `Priority`: P1
- `Owner`: Frontend
- `Depends On`: `I4-13`
- `Description`: 实现按资源和时间过滤的审计日志页面。
- `Acceptance`:
  - 可按资源查看日志
  - 可按时间筛选

#### I4-16

- `Key`: `I4-16`
- `Title`: Iteration 4 集成测试与回归
- `Type`: Test
- `Priority`: P0
- `Owner`: QA
- `Depends On`: `I4-04`, `I4-05`, `I4-06`, `I4-07`, `I4-09`, `I4-12`
- `Description`: 对审核流、状态联动、汇总、偏差分析、导出和审计日志做联调回归。
- `Acceptance`:
  - 审核主流程通过
  - 汇总与偏差分析主流程通过
  - 导出与审计主流程通过

## 4. 建议泳道

如果你要直接导入 Jira/Tapd，建议按下面 4 个泳道建：

- `Backend`
- `Frontend`
- `QA`
- `Architecture/ReviewReport`

## 5. 建议优先级执行顺序

推荐按下面顺序拉开发：

1. `I4-01`
2. `I4-02`
3. `I4-03`
4. `I4-04`
5. `I4-05`
6. `I4-06`
7. `I4-07`
8. `I4-09`
9. `I4-12`
10. `I4-13`
11. 前端相关卡并行接入
12. `I4-16`

## 6. 建议作为 Sprint Goal 的一句话

完成审核、汇总、报表和审计主链，让系统具备可审核、可导出、可追溯的正式交付能力。

