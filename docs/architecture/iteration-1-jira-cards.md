# 新点 SaaS 造价系统 Iteration 1 Jira/Tapd 任务卡

> 基于 [iteration-1-task-breakdown.md](/Users/huahaha/Documents/New%20project/docs/architecture/iteration-1-task-breakdown.md) 与 [master-delivery-roadmap.md](/Users/huahaha/Documents/New%20project/docs/architecture/master-delivery-roadmap.md) 整理。

## 1. 使用说明

这份文档把 `Iteration 1` 转成更像 Jira/Tapd 的任务卡格式，适合直接抄进项目管理工具。

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

建议把 `Iteration 1` 拆成 5 个 Epic：

- `I1-EPIC-1` 项目与阶段底座
- `I1-EPIC-2` 权限与成员体系
- `I1-EPIC-3` 专业与定额集配置
- `I1-EPIC-4` 阶段工作台
- `I1-EPIC-5` 数据初始化与导入前置准备

## 3. 任务卡

### I1-EPIC-1 项目与阶段底座

#### I1-01

- `Key`: `I1-01`
- `Title`: 创建项目基础表迁移
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: 无
- `Description`: 创建 `project`、`project_stage` 两张核心表，并补齐主键、时间字段、唯一索引。
- `Acceptance`:
  - 可完成数据库迁移
  - `project.project_code` 唯一
  - `project_stage(project_id, stage_code)` 唯一

#### I1-02

- `Key`: `I1-02`
- `Title`: 初始化标准阶段主数据
- `Type`: Task
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I1-01`
- `Description`: 初始化 9 个标准阶段编码和默认顺序，供项目创建时展开模板。
- `Acceptance`:
  - 可查询 9 个标准阶段
  - 阶段编码与文档一致

#### I1-03

- `Key`: `I1-03`
- `Title`: 实现项目创建接口
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I1-01`, `I1-02`
- `Description`: 实现 `POST /api/v1/projects`，支持创建项目、展开默认阶段模板、写入负责人。
- `Acceptance`:
  - 创建后可返回项目详情
  - 自动生成默认阶段配置
  - 项目负责人自动成为项目成员

#### I1-04

- `Key`: `I1-04`
- `Title`: 实现项目详情接口
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I1-03`
- `Description`: 实现 `GET /api/v1/projects/{id}`，返回项目基础信息和默认配置引用。
- `Acceptance`:
  - 可按项目 ID 查询详情
  - 非项目成员不可访问

#### I1-05

- `Key`: `I1-05`
- `Title`: 实现阶段配置读写接口
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I1-03`
- `Description`: 实现 `GET/PUT /api/v1/projects/{id}/stages`，支持启停、排序、负责人和审核人配置。
- `Acceptance`:
  - 阶段编码不可重复
  - 阶段顺序不可重复
  - 可启停阶段并保存负责人、审核人

#### I1-06

- `Key`: `I1-06`
- `Title`: 项目列表页与创建页前端骨架
- `Type`: Story
- `Priority`: P1
- `Owner`: Frontend
- `Depends On`: `I1-03`, `I1-04`
- `Description`: 实现项目列表页、创建页和详情入口。
- `Acceptance`:
  - 可创建项目
  - 创建后可跳转详情页

#### I1-07

- `Key`: `I1-07`
- `Title`: 阶段配置页前端实现
- `Type`: Story
- `Priority`: P1
- `Owner`: Frontend
- `Depends On`: `I1-05`
- `Description`: 实现阶段启停、排序和负责人配置页面。
- `Acceptance`:
  - 可调整阶段顺序
  - 可编辑负责人和审核人

### I1-EPIC-2 权限与成员体系

#### I1-08

- `Key`: `I1-08`
- `Title`: 创建项目成员与权限范围表迁移
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I1-01`
- `Description`: 创建 `project_member`、`project_role_scope`，补齐唯一约束和范围字段。
- `Acceptance`:
  - `project_member(project_id, user_id)` 唯一
  - 可存角色、业务身份、阶段/专业/单体范围

#### I1-09

- `Key`: `I1-09`
- `Title`: 实现 JWT 与项目成员鉴权中间件
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I1-08`
- `Description`: 实现 JWT、项目成员校验、平台角色校验和基础资源权限校验。
- `Acceptance`:
  - 非项目成员不能访问项目详情
  - 项目成员能根据角色拿到不同能力

#### I1-10

- `Key`: `I1-10`
- `Title`: 实现项目成员读写接口
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I1-08`, `I1-09`
- `Description`: 实现 `GET/PUT /api/v1/projects/{id}/members`，支持角色、业务身份、范围配置。
- `Acceptance`:
  - 可新增和失活成员
  - 可配置业务身份
  - 可配置阶段与专业范围

#### I1-11

- `Key`: `I1-11`
- `Title`: 成员与权限配置页前端实现
- `Type`: Story
- `Priority`: P1
- `Owner`: Frontend
- `Depends On`: `I1-10`
- `Description`: 实现项目成员列表、角色编辑、业务身份与权限范围配置界面。
- `Acceptance`:
  - 可新增成员
  - 可设置角色和范围
  - 审核人与编制人可独立配置

### I1-EPIC-3 专业与定额集配置

#### I1-12

- `Key`: `I1-12`
- `Title`: 创建专业与定额集主数据表迁移
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I1-01`
- `Description`: 创建 `discipline_type`、`standard_set`、`project_discipline`，补齐唯一索引和源字段。
- `Acceptance`:
  - `discipline_type.discipline_code` 唯一
  - `standard_set.standard_set_code` 唯一
  - `project_discipline(project_id, discipline_code)` 唯一

#### I1-13

- `Key`: `I1-13`
- `Title`: 初始化专业与定额集样本数据
- `Type`: Task
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I1-12`
- `Description`: 导入江苏版专业主数据和定额集样本，并保留 `source_field_code`、`source_markup`、`source_system`。
- `Acceptance`:
  - 可查询专业主数据
  - 可查询定额集主数据
  - 源系统字段保留完整

#### I1-14

- `Key`: `I1-14`
- `Title`: 实现项目专业配置接口
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I1-12`, `I1-13`, `I1-09`
- `Description`: 实现 `GET/PUT /api/v1/projects/{id}/disciplines` 和 `GET /api/v1/standard-sets`。
- `Acceptance`:
  - 可配置项目启用专业
  - 每个专业可绑定默认定额集
  - 绑定非法定额集返回 `422`

#### I1-15

- `Key`: `I1-15`
- `Title`: 项目专业配置页前端实现
- `Type`: Story
- `Priority`: P1
- `Owner`: Frontend
- `Depends On`: `I1-14`
- `Description`: 实现项目专业列表、启停、排序和默认定额集绑定界面。
- `Acceptance`:
  - 可启停项目专业
  - 可绑定默认定额集
  - 可展示源专业信息摘要

### I1-EPIC-4 阶段工作台

#### I1-16

- `Key`: `I1-16`
- `Title`: 设计并实现阶段工作台聚合接口
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I1-03`, `I1-05`, `I1-10`, `I1-14`
- `Description`: 实现 `GET /api/v1/projects/{id}/workspace`，聚合项目、阶段、专业、成员权限摘要。
- `Acceptance`:
  - 返回项目信息
  - 返回当前阶段和启用阶段摘要
  - 返回项目专业配置摘要
  - 返回成员权限摘要

#### I1-17

- `Key`: `I1-17`
- `Title`: 阶段工作台前端页实现
- `Type`: Story
- `Priority`: P1
- `Owner`: Frontend
- `Depends On`: `I1-16`
- `Description`: 实现阶段工作台首页，展示当前阶段、专业配置、成员权限和预留待办区域。
- `Acceptance`:
  - 可进入工作台
  - 可看到当前阶段、专业和权限摘要

### I1-EPIC-5 数据初始化与导入前置准备

#### I1-18

- `Key`: `I1-18`
- `Title`: 固化 Iteration 1 枚举与常量
- `Type`: Task
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I1-01`, `I1-08`, `I1-12`
- `Description`: 固化项目状态、阶段状态、平台角色、业务身份、资源类型和操作类型。
- `Acceptance`:
  - 枚举与文档一致
  - 后端代码统一引用枚举常量

#### I1-19

- `Key`: `I1-19`
- `Title`: 预留导入任务与 import 权限基础能力
- `Type`: Task
- `Priority`: P1
- `Owner`: Backend
- `Depends On`: `I1-09`, `I1-13`
- `Description`: 在权限和元数据层预留 `import` 动作、导入日志表设计和源系统标识。
- `Acceptance`:
  - 权限中间件能识别 `import`
  - 文档里已约定导入任务基础结构

#### I1-20

- `Key`: `I1-20`
- `Title`: Iteration 1 集成测试与回归
- `Type`: Test
- `Priority`: P0
- `Owner`: QA
- `Depends On`: `I1-03`, `I1-05`, `I1-10`, `I1-14`, `I1-16`
- `Description`: 对项目创建、阶段配置、成员权限、专业配置和工作台主流程做联调回归。
- `Acceptance`:
  - 项目创建主流程通过
  - 阶段配置主流程通过
  - 成员权限主流程通过
  - 专业配置主流程通过
  - 工作台可正常展示

## 4. 建议泳道

如果你要直接导入 Jira/Tapd，建议按下面 4 个泳道建：

- `Backend`
- `Frontend`
- `QA`
- `Architecture/Init`

## 5. 建议优先级执行顺序

推荐按下面顺序拉开发：

1. `I1-01`
2. `I1-08`
3. `I1-12`
4. `I1-02`
5. `I1-13`
6. `I1-18`
7. `I1-09`
8. `I1-03`
9. `I1-04`
10. `I1-05`
11. `I1-10`
12. `I1-14`
13. `I1-16`
14. 前端相关卡并行接入
15. `I1-20`

## 6. 建议作为 Sprint Goal 的一句话

完成项目、阶段、成员、专业和工作台底座，让系统具备进入正式业务流程前的项目级配置能力。

