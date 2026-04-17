# 新点 SaaS 造价系统 Iteration 2 Jira/Tapd 任务卡

> 基于 [iteration-2-task-breakdown.md](/Users/huahaha/Documents/New%20project/docs/architecture/iteration-2-task-breakdown.md) 与 [master-delivery-roadmap.md](/Users/huahaha/Documents/New%20project/docs/architecture/master-delivery-roadmap.md) 整理。

## 1. 使用说明

这份文档把 `Iteration 2` 转成更像 Jira/Tapd 的任务卡格式，适合直接抄进项目管理工具。

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

建议把 `Iteration 2` 拆成 6 个 Epic：

- `I2-EPIC-1` 清单版本与建表基础
- `I2-EPIC-2` 清单树与工作内容
- `I2-EPIC-3` 清单接口与版本链
- `I2-EPIC-4` 初始导入
- `I2-EPIC-5` 权限、锁定与审计
- `I2-EPIC-6` 前端清单主链

## 3. 任务卡

### I2-EPIC-1 清单版本与建表基础

#### I2-01

- `Key`: `I2-01`
- `Title`: 创建清单版本与清单项基础表迁移
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I1-01`, `I1-18`
- `Description`: 创建 `bill_version`、`bill_item`、`bill_item_work_item` 三张核心表，并补齐主键、时间字段、唯一索引和父子外键。
- `Acceptance`:
  - 三张表可完成迁移
  - `bill_version(project_id, stage_id, version_no)` 唯一
  - `bill_item_work_item(bill_item_id, sort_order)` 唯一

#### I2-02

- `Key`: `I2-02`
- `Title`: 固化清单版本与锁定枚举
- `Type`: Task
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I2-01`
- `Description`: 固化 `initial / reference_copy / contract_baseline / change / settlement`、`editable / submitted / approved / locked / rejected` 等枚举。
- `Acceptance`:
  - 枚举值与状态机文档一致
  - 代码侧统一引用

#### I2-03

- `Key`: `I2-03`
- `Title`: 补齐源系统兼容字段
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I2-01`
- `Description`: 给 `bill_version`、`bill_item`、`bill_item_work_item` 补齐 `source_spec_code`、`source_bill_id`、`source_level_code` 等兼容字段。
- `Acceptance`:
  - 源系统主键、层级和规范编码均可保留
  - 数据模型与源字段映射文档一致

### I2-EPIC-2 清单树与工作内容

#### I2-04

- `Key`: `I2-04`
- `Title`: 实现清单树数据层与仓储
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I2-01`
- `Description`: 完成 `bill_item` 仓储，支持父子关系查询、同级排序和版本级过滤。
- `Acceptance`:
  - 可按版本返回稳定树结构
  - 支持同级 `sort_order` 排序

#### I2-05

- `Key`: `I2-05`
- `Title`: 实现清单树规则校验
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I2-04`
- `Description`: 校验循环父子关系、跨版本挂载和锁定版本树结构修改。
- `Acceptance`:
  - 非法父子关系被拦截
  - 锁定版本不能修改树结构

#### I2-06

- `Key`: `I2-06`
- `Title`: 实现工作内容子表接口
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I2-01`, `I2-04`
- `Description`: 实现 `GET/POST/PUT /api/v1/projects/{id}/bill-items/{itemId}/work-items...`。
- `Acceptance`:
  - 每个清单项可维护多条工作内容
  - 工作内容按顺序稳定保存

#### I2-07

- `Key`: `I2-07`
- `Title`: 工作内容只读与锁定规则接入
- `Type`: Task
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I2-06`
- `Description`: 当版本或父清单项锁定时，工作内容进入只读。
- `Acceptance`:
  - 锁定版本下工作内容不可改
  - 写接口统一返回受限结果

### I2-EPIC-3 清单接口与版本链

#### I2-08

- `Key`: `I2-08`
- `Title`: 实现清单版本服务
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I2-01`, `I2-02`
- `Description`: 支持创建空白版本、按项目和阶段查询版本列表、按版本 ID 查询详情。
- `Acceptance`:
  - 可创建空白清单版本
  - 可按项目和阶段查询版本

#### I2-09

- `Key`: `I2-09`
- `Title`: 实现版本引用与来源链
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I2-08`
- `Description`: 支持从上游版本创建 `reference_copy`，记录 `source_stage_id`、`source_version_id` 和来源链。
- `Acceptance`:
  - 招标清单可生成投标报价版本
  - 任意版本可查看上游来源

#### I2-10

- `Key`: `I2-10`
- `Title`: 实现清单项读写接口
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I2-04`, `I2-08`
- `Description`: 实现 `GET/POST/PUT /api/v1/projects/{id}/bill-items...`，支持按版本、阶段、关键字查询。
- `Acceptance`:
  - 前端可按版本切换清单数据
  - 清单项新增和修改正常

#### I2-11

- `Key`: `I2-11`
- `Title`: 增补版本链接口
- `Type`: Story
- `Priority`: P1
- `Owner`: Backend
- `Depends On`: `I2-08`, `I2-09`
- `Description`: 增加版本列表、copy-from、source-chain 接口。
- `Acceptance`:
  - 可查看版本列表
  - 可执行 copy-from
  - 可查看来源链

#### I2-12

- `Key`: `I2-12`
- `Title`: 预留合同基线前置能力
- `Type`: Task
- `Priority`: P1
- `Owner`: Backend
- `Depends On`: `I2-08`, `I2-09`
- `Description`: 预留 `contract_baseline` 创建逻辑和锁定前状态校验。
- `Acceptance`:
  - 合同基线类型可被识别
  - 锁定前校验口径稳定

### I2-EPIC-4 初始导入

#### I2-13

- `Key`: `I2-13`
- `Title`: 实现源清单导入解析器
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I2-03`
- `Description`: 解析 `ZaoJia_Qd_QdList`、`ZaoJia_Qd_Qdxm`、`ZaoJia_Qd_Gznr` 三类源数据。
- `Acceptance`:
  - 能读取源样本
  - 能输出中间结构

#### I2-14

- `Key`: `I2-14`
- `Title`: 实现导入字段映射与落库
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I2-13`, `I2-08`, `I2-10`, `I2-06`
- `Description`: 按映射规则创建 `bill_version`、`bill_item`、`bill_item_work_item`。
- `Acceptance`:
  - 可导入一版完整初始清单
  - 导入后可看到树结构和工作内容

#### I2-15

- `Key`: `I2-15`
- `Title`: 实现导入摘要与错误明细
- `Type`: Story
- `Priority`: P1
- `Owner`: Backend
- `Depends On`: `I2-14`
- `Description`: 导入完成后生成摘要，失败时保留错误明细。
- `Acceptance`:
  - 可看到导入成功数量和失败数量
  - 失败记录可定位

### I2-EPIC-5 权限、锁定与审计

#### I2-16

- `Key`: `I2-16`
- `Title`: 接入清单与工作内容权限校验
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I1-09`, `I2-10`, `I2-06`
- `Description`: 接入 `bill:view`、`bill:edit`、`bill_work_item:view`、`bill_work_item:edit`、`bill:import`。
- `Acceptance`:
  - `reviewer` 只能查看
  - `cost_engineer` 可维护和导入

#### I2-17

- `Key`: `I2-17`
- `Title`: 接入清单锁定前置规则
- `Type`: Task
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I2-10`, `I2-16`
- `Description`: 锁定版本下所有清单和工作内容写接口统一返回受限结果。
- `Acceptance`:
  - 锁定版本写接口统一受限

#### I2-18

- `Key`: `I2-18`
- `Title`: 接入清单主链审计日志
- `Type`: Story
- `Priority`: P1
- `Owner`: Backend
- `Depends On`: `I2-08`, `I2-10`, `I2-06`, `I2-14`
- `Description`: 为版本创建、导入、清单项修改、工作内容修改和版本引用写审计日志。
- `Acceptance`:
  - 任意版本创建和改动可追溯

### I2-EPIC-6 前端清单主链

#### I2-19

- `Key`: `I2-19`
- `Title`: 清单树页面前端实现
- `Type`: Story
- `Priority`: P1
- `Owner`: Frontend
- `Depends On`: `I2-10`
- `Description`: 实现清单树列表、展开/折叠、版本切换和基础查询。
- `Acceptance`:
  - 可按版本查看清单树
  - 可展示层级结构

#### I2-20

- `Key`: `I2-20`
- `Title`: 清单详情侧栏与工作内容面板实现
- `Type`: Story
- `Priority`: P1
- `Owner`: Frontend
- `Depends On`: `I2-06`, `I2-10`
- `Description`: 实现详情侧栏、工作内容区和来源信息展示。
- `Acceptance`:
  - 可查看和维护工作内容
  - 可看到来源字段和来源链摘要

#### I2-21

- `Key`: `I2-21`
- `Title`: 初始导入入口与结果反馈实现
- `Type`: Story
- `Priority`: P1
- `Owner`: Frontend
- `Depends On`: `I2-14`, `I2-15`
- `Description`: 实现初始导入入口、导入结果反馈和错误明细展示。
- `Acceptance`:
  - 可触发导入
  - 可看到导入摘要和错误信息

#### I2-22

- `Key`: `I2-22`
- `Title`: Iteration 2 集成测试与回归
- `Type`: Test
- `Priority`: P0
- `Owner`: QA
- `Depends On`: `I2-09`, `I2-10`, `I2-06`, `I2-14`, `I2-16`, `I2-17`
- `Description`: 对版本链、清单树、工作内容、导入、权限和锁定规则做联调回归。
- `Acceptance`:
  - 版本链主流程通过
  - 清单树主流程通过
  - 导入主流程通过
  - 权限与锁定规则通过

## 4. 建议泳道

如果你要直接导入 Jira/Tapd，建议按下面 4 个泳道建：

- `Backend`
- `Frontend`
- `QA`
- `Architecture/Import`

## 5. 建议优先级执行顺序

推荐按下面顺序拉开发：

1. `I2-01`
2. `I2-02`
3. `I2-03`
4. `I2-04`
5. `I2-08`
6. `I2-05`
7. `I2-06`
8. `I2-10`
9. `I2-09`
10. `I2-13`
11. `I2-14`
12. `I2-16`
13. `I2-17`
14. `I2-18`
15. 前端相关卡并行接入
16. `I2-22`

## 6. 建议作为 Sprint Goal 的一句话

完成清单版本链、树形清单、工作内容和初始导入主链，让系统具备进入正式计价前的核心业务数据能力。

