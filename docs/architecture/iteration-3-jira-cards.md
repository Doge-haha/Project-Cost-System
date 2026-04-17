# 新点 SaaS 造价系统 Iteration 3 Jira/Tapd 任务卡

> 基于 [iteration-3-task-breakdown.md](/Users/huahaha/Documents/New%20project/docs/architecture/iteration-3-task-breakdown.md) 与 [master-delivery-roadmap.md](/Users/huahaha/Documents/New%20project/docs/architecture/master-delivery-roadmap.md) 整理。

## 1. 使用说明

这份文档把 `Iteration 3` 转成更像 Jira/Tapd 的任务卡格式，适合直接抄进项目管理工具。

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

建议把 `Iteration 3` 拆成 6 个 Epic：

- `I3-EPIC-1` 定额与价目基础表
- `I3-EPIC-2` 定额管理与选择器
- `I3-EPIC-3` 价目版本与取费模板
- `I3-EPIC-4` 计价引擎与重算
- `I3-EPIC-5` 校验、权限与审计
- `I3-EPIC-6` 前端计价主链

## 3. 任务卡

### I3-EPIC-1 定额与价目基础表

#### I3-01

- `Key`: `I3-01`
- `Title`: 创建定额、价目与取费基础表迁移
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I2-01`, `I2-02`
- `Description`: 创建 `quota_line`、`price_version`、`price_item`、`fee_template`、`fee_rule` 五张核心表，并补齐索引和约束。
- `Acceptance`:
  - 五张表可完成迁移
  - `price_version.version_code` 唯一
  - `price_item(price_version_id, quota_code)` 唯一

#### I3-02

- `Key`: `I3-02`
- `Title`: 补齐定额与价目源字段
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I3-01`
- `Description`: 给 `quota_line` 补齐 `source_standard_set_code`、`source_quota_id`、`chapter_code` 等字段，给 `price_item` 补齐人工/材料/机械单价字段。
- `Acceptance`:
  - 定额来源字段完整保留
  - 价目明细支持分项单价

#### I3-03

- `Key`: `I3-03`
- `Title`: 固化 Iteration 3 枚举与计价字段口径
- `Type`: Task
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I3-01`
- `Description`: 固化 `manual / ai / history_reference`、价目状态、取费模板状态和 `system_* / manual_* / final_*` 三套价格口径。
- `Acceptance`:
  - 枚举与文档一致
  - 代码侧统一使用

### I3-EPIC-2 定额管理与选择器

#### I3-04

- `Key`: `I3-04`
- `Title`: 实现定额明细读写接口
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I3-01`, `I2-10`
- `Description`: 实现 `GET/POST/PUT /api/v1/projects/{id}/quota-lines...`。
- `Acceptance`:
  - 清单项下可新增多条定额
  - 可编辑数量、含量系数和来源方式

#### I3-05

- `Key`: `I3-05`
- `Title`: 实现定额批量创建与校验接口
- `Type`: Story
- `Priority`: P1
- `Owner`: Backend
- `Depends On`: `I3-04`
- `Description`: 增加定额批量创建、套用校验和来源链查询接口。
- `Acceptance`:
  - 支持批量添加定额
  - 支持单独触发校验

#### I3-06

- `Key`: `I3-06`
- `Title`: 实现定额选择器查询能力
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I3-01`, `I1-14`
- `Description`: 支持按 `standardSetCode`、`disciplineCode`、关键字和章节号查询候选定额。
- `Acceptance`:
  - 可按项目默认专业定额集查询
  - 支持关键字筛选

#### I3-07

- `Key`: `I3-07`
- `Title`: 定额选择器前端实现
- `Type`: Story
- `Priority`: P1
- `Owner`: Frontend
- `Depends On`: `I3-06`, `I3-04`
- `Description`: 实现定额选择器、批量添加和定额列表展示。
- `Acceptance`:
  - 可按专业和定额集切换查询
  - 可批量添加到清单项

### I3-EPIC-3 价目版本与取费模板

#### I3-08

- `Key`: `I3-08`
- `Title`: 实现价目版本查询与绑定
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I3-01`, `I1-03`
- `Description`: 支持按地区和版本查询价目版本，并支持项目绑定默认价目版本。
- `Acceptance`:
  - 可查询不同地区、不同版本的价目
  - 项目可绑定默认价目版本

#### I3-09

- `Key`: `I3-09`
- `Title`: 实现取费模板查询与绑定
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I3-01`, `I1-03`
- `Description`: 支持按地区、项目类型、阶段查询取费模板，并支持项目绑定默认模板。
- `Acceptance`:
  - 项目可绑定默认取费模板
  - 不同专业可命中不同规则

#### I3-10

- `Key`: `I3-10`
- `Title`: 价目与取费绑定前端实现
- `Type`: Story
- `Priority`: P1
- `Owner`: Frontend
- `Depends On`: `I3-08`, `I3-09`
- `Description`: 实现价目版本切换入口、取费模板切换入口和基础展示。
- `Acceptance`:
  - 可切换价目版本
  - 可切换取费模板

### I3-EPIC-4 计价引擎与重算

#### I3-11

- `Key`: `I3-11`
- `Title`: 实现单项计价接口
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I3-04`, `I3-08`, `I3-09`
- `Description`: 实现 `POST /api/v1/engine/calculate`，根据定额、价目和取费计算系统值。
- `Acceptance`:
  - 可计算 `system_unit_price`
  - 可计算 `system_amount`

#### I3-12

- `Key`: `I3-12`
- `Title`: 实现人工调价与最终值计算
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I3-11`
- `Description`: 支持写入 `manual_unit_price`，并计算 `final_unit_price` 和 `final_amount`。
- `Acceptance`:
  - 人工调价不覆盖系统值
  - 最终值可独立计算

#### I3-13

- `Key`: `I3-13`
- `Title`: 实现批量重算服务
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I3-11`, `I3-12`
- `Description`: 支持按清单项、专业、单体和项目级触发重算。
- `Acceptance`:
  - 支持多粒度重算
  - 记录重算触发原因

#### I3-14

- `Key`: `I3-14`
- `Title`: 计价结果前端展示与人工调价实现
- `Type`: Story
- `Priority`: P1
- `Owner`: Frontend
- `Depends On`: `I3-11`, `I3-12`
- `Description`: 在前端展示系统值、人工值、最终值，并支持人工调价入口。
- `Acceptance`:
  - 可查看三套价格口径
  - 可发起人工调价

### I3-EPIC-5 校验、权限与审计

#### I3-15

- `Key`: `I3-15`
- `Title`: 接入定额校验规则
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I3-04`, `I3-11`
- `Description`: 接入缺定额、缺价目、缺取费模板、单位不一致等校验规则，并落到 `validation_status`。
- `Acceptance`:
  - 重大错误不会静默吞掉
  - 校验结果可持久化

#### I3-16

- `Key`: `I3-16`
- `Title`: 接入定额、价目和调价权限校验
- `Type`: Story
- `Priority`: P0
- `Owner`: Backend
- `Depends On`: `I1-09`, `I3-04`, `I3-12`
- `Description`: 接入 `quota:view`、`quota:edit`、价目只读、取费只读和锁定版本写拦截。
- `Acceptance`:
  - `reviewer` 只能查看
  - 锁定版本写接口返回 `423`

#### I3-17

- `Key`: `I3-17`
- `Title`: 接入计价主链审计日志
- `Type`: Story
- `Priority`: P1
- `Owner`: Backend
- `Depends On`: `I3-08`, `I3-09`, `I3-11`, `I3-12`, `I3-13`
- `Description`: 为定额修改、价目切换、取费模板切换、人工调价和批量重算写审计日志。
- `Acceptance`:
  - 任意价格变化可追溯到操作人和原因

### I3-EPIC-6 前端计价主链

#### I3-18

- `Key`: `I3-18`
- `Title`: 定额管理页前端实现
- `Type`: Story
- `Priority`: P1
- `Owner`: Frontend
- `Depends On`: `I3-04`, `I3-07`
- `Description`: 实现定额列表、右侧详情和批量添加后的展示。
- `Acceptance`:
  - 可查看和维护定额明细
  - 可查看来源方式和校验状态

#### I3-19

- `Key`: `I3-19`
- `Title`: 价目与取费配置前端联动
- `Type`: Story
- `Priority`: P1
- `Owner`: Frontend
- `Depends On`: `I3-10`, `I3-14`
- `Description`: 打通价目、取费和计价结果联动展示。
- `Acceptance`:
  - 切换价目/取费后可刷新计价结果

#### I3-20

- `Key`: `I3-20`
- `Title`: Iteration 3 集成测试与回归
- `Type`: Test
- `Priority`: P0
- `Owner`: QA
- `Depends On`: `I3-04`, `I3-08`, `I3-09`, `I3-11`, `I3-12`, `I3-13`, `I3-16`
- `Description`: 对定额管理、价目绑定、取费绑定、计价引擎、人工调价和锁定规则做联调回归。
- `Acceptance`:
  - 定额主流程通过
  - 计价主流程通过
  - 调价与重算主流程通过
  - 权限与锁定规则通过

## 4. 建议泳道

如果你要直接导入 Jira/Tapd，建议按下面 4 个泳道建：

- `Backend`
- `Frontend`
- `QA`
- `Architecture/Pricing`

## 5. 建议优先级执行顺序

推荐按下面顺序拉开发：

1. `I3-01`
2. `I3-02`
3. `I3-03`
4. `I3-04`
5. `I3-06`
6. `I3-08`
7. `I3-09`
8. `I3-11`
9. `I3-12`
10. `I3-15`
11. `I3-16`
12. `I3-13`
13. `I3-17`
14. 前端相关卡并行接入
15. `I3-20`

## 6. 建议作为 Sprint Goal 的一句话

完成定额、价目、取费和计价引擎主链，让系统具备形成正式造价结果的核心计价能力。

