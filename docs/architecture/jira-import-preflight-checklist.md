# 新点 SaaS 造价系统 Jira/Tapd 导入前检查清单

> 配合 [jira-import-template.md](/Users/huahaha/Documents/New%20project/docs/architecture/jira-import-template.md)、[jira-import-i1-i2.csv](/Users/huahaha/Documents/New%20project/docs/architecture/jira-import-i1-i2.csv) 与 [jira-import-i3-i5.csv](/Users/huahaha/Documents/New%20project/docs/architecture/jira-import-i3-i5.csv) 使用。

## 1. 文档目标

这份清单用于在正式导入 Jira 或 Tapd 之前，先把项目管理工具里的基础配置准备好。

它解决的是 4 类常见问题：

- 导入后 Epic 挂不上
- 自定义字段缺失，CSV 列无法映射
- Sprint、组件、标签口径不统一
- 导入顺序错误，导致任务层级混乱

## 2. 导入前先确认什么

正式导入前，先确认下面 3 件事：

1. 你是导入到 `Jira` 还是 `Tapd`
2. 当前项目是否已经启用了 `Epic`、`Sprint`、`Component`、`Labels`
3. 是否允许导入自定义字段，例如：
   - `Depends On`
   - `Acceptance Criteria`
   - `Iteration`
   - `Sprint Goal`

如果不能直接导入自定义字段，也没关系，可以先保留成备注字段或描述字段。

## 3. 项目配置预检查

建议在项目管理工具里先完成下面这些基础配置。

### 3.1 Issue Type

至少确认下面 4 种任务类型已经存在：

- `Epic`
- `Story`
- `Task`
- `Test`

如果团队当前没有 `Test` 类型，可以临时映射成：

- `Task`

但建议保留 `Test`，这样 QA 卡不会和研发卡混在一起。

### 3.2 优先级

建议先确认项目里能支持下面 3 档优先级：

- `P0`
- `P1`
- `P2`

如果 Jira 只能使用默认优先级，建议按下面映射：

- `P0 -> Highest`
- `P1 -> High`
- `P2 -> Medium`

### 3.3 Component

建议先创建下面这些组件：

- `Architecture`
- `Backend`
- `Frontend`
- `QA`

如果你想更细，也可以在后续再拆，不建议第一次导入前就建太多组件。

## 4. 自定义字段预检查

如果项目支持自定义字段，建议提前建立下面这些字段。

### 4.1 Depends On

- 字段名：`Depends On`
- 类型建议：`文本` 或 `多行文本`
- 用途：先承接我们文档里的依赖编号，后面可再人工转正式依赖关系

### 4.2 Acceptance Criteria

- 字段名：`Acceptance Criteria`
- 类型建议：`多行文本`
- 用途：存验收标准

### 4.3 Iteration

- 字段名：`Iteration`
- 类型建议：`单选`
- 推荐值：
  - `I1`
  - `I2`
  - `I3`
  - `I4`
  - `I5`

### 4.4 Sprint Goal

- 字段名：`Sprint Goal`
- 类型建议：`多行文本`
- 用途：建议仅 Epic 或 Sprint 汇总使用

如果项目不方便建这么多字段，建议最低保留：

- `Acceptance Criteria`
- `Iteration`

## 5. Labels 口径预检查

建议在团队内部先统一标签策略。

### 5.1 迭代标签

固定使用：

- `iteration-1`
- `iteration-2`
- `iteration-3`
- `iteration-4`
- `iteration-5`

### 5.2 模块标签

建议按这套口径使用：

- `project`
- `stage`
- `permission`
- `member`
- `discipline`
- `standard-set`
- `workspace`
- `bill`
- `work-item`
- `version-chain`
- `import`
- `quota`
- `price`
- `fee`
- `pricing-engine`
- `review`
- `summary`
- `report`
- `audit-log`
- `ai`

第一次导入时不建议临时改标签命名，否则前后两份 CSV 会不一致。

## 6. Epic 预建清单

建议先在 Jira/Tapd 里确认是否允许：

1. 直接导入 Epic 行
2. 或者先手工创建 Epic，再导入任务

如果系统支持 Epic 直接导入，优先按 CSV 导入即可。  
如果系统对 Epic 导入不稳定，建议先手工建 Epic，再导任务。

### 6.1 I1 Epic

- `I1-EPIC-1` 项目与阶段底座
- `I1-EPIC-2` 权限与成员体系
- `I1-EPIC-3` 专业与定额集配置
- `I1-EPIC-4` 阶段工作台
- `I1-EPIC-5` 数据初始化与导入前置准备

### 6.2 I2 Epic

- `I2-EPIC-1` 清单版本与建表基础
- `I2-EPIC-2` 清单树与工作内容
- `I2-EPIC-3` 清单接口与版本链
- `I2-EPIC-4` 初始导入
- `I2-EPIC-5` 权限、锁定与审计
- `I2-EPIC-6` 前端清单主链

### 6.3 I3 Epic

- `I3-EPIC-1` 定额与价目基础表
- `I3-EPIC-2` 定额管理与选择器
- `I3-EPIC-3` 价目版本与取费模板
- `I3-EPIC-4` 计价引擎与重算
- `I3-EPIC-5` 校验、权限与审计
- `I3-EPIC-6` 前端计价主链

### 6.4 I4 Epic

- `I4-EPIC-1` 审核与审计基础表
- `I4-EPIC-2` 审核流与状态联动
- `I4-EPIC-3` 汇总与偏差分析
- `I4-EPIC-4` 报表导出任务
- `I4-EPIC-5` 权限与审计接入
- `I4-EPIC-6` 前端审核与汇总主链

### 6.5 I5 Epic

- `I5-EPIC-1` AI 推荐基础表与适配层
- `I5-EPIC-2` AI 清单推荐
- `I5-EPIC-3` AI 定额推荐
- `I5-EPIC-4` 偏差预警与失效机制
- `I5-EPIC-5` 人工确认、权限与审计
- `I5-EPIC-6` 前端 AI 面板
- `I5-EPIC-7` AI 原生底座预留

## 7. Sprint 预建建议

建议至少先建下面这些 Sprint：

- `Sprint 1`
- `Sprint 2`
- `Sprint 3`
- `Sprint 4`
- `Sprint 5`

如果团队节奏更慢，也可以不严格按 1 个迭代对应 1 个 Sprint。  
但为了让 CSV 直接可用，建议先保留这 5 个 Sprint 名称。

## 8. 导入顺序检查

推荐按下面顺序导入：

1. 先导入或先建立所有 Epic
2. 导入 [jira-import-i1-i2.csv](/Users/huahaha/Documents/New%20project/docs/architecture/jira-import-i1-i2.csv)
3. 检查 `I1`、`I2` 的 Epic Link 是否挂对
4. 再导入 [jira-import-i3-i5.csv](/Users/huahaha/Documents/New%20project/docs/architecture/jira-import-i3-i5.csv)
5. 再检查 `I3`、`I4`、`I5` 的 Epic Link 和 Sprint

不要把所有 CSV 混成一次导入，第一次导入越大，回滚和修正越麻烦。

## 9. 导入后立即检查什么

每次导入完成后，立刻检查下面这些点：

### 9.1 层级关系

- Epic 是否创建成功
- 任务是否挂到了正确 Epic
- 是否有任务掉到了默认 Backlog

### 9.2 字段映射

- `Priority` 是否仍是 `P0 / P1 / P2` 或被正确映射
- `Component` 是否正确落到了 `Architecture / Backend / Frontend / QA`
- `Iteration` 是否保留
- `Acceptance Criteria` 是否没有丢

### 9.3 文本质量

- 描述字段里反引号是否能接受
- 中文是否正常
- 长文本是否被截断
- 逗号分隔字段是否没有错位

### 9.4 Sprint 归属

- `I1` 是否都落到 `Sprint 1`
- `I2` 是否都落到 `Sprint 2`
- `I3-I5` 是否都落到对应 Sprint

## 10. 最推荐的导入策略

如果你想最稳，我建议这样做：

1. 先手工建字段
2. 先手工建 Sprint
3. 先导入 `I1 + I2`
4. 抽样检查 10 条任务
5. 没问题后再导入 `I3 + I4 + I5`

这样即使中间发现字段映射问题，修复成本也会小很多。

## 11. 导入当天的操作顺序

最推荐的实际操作顺序是：

1. 打开项目配置页
2. 检查 Issue Type
3. 检查 Priority
4. 建 `Component`
5. 建自定义字段
6. 建 `Sprint 1-5`
7. 先导入 Epic
8. 导入 [jira-import-i1-i2.csv](/Users/huahaha/Documents/New%20project/docs/architecture/jira-import-i1-i2.csv)
9. 检查映射结果
10. 导入 [jira-import-i3-i5.csv](/Users/huahaha/Documents/New%20project/docs/architecture/jira-import-i3-i5.csv)
11. 设定 `Sprint 1` 的启动范围

## 12. 下一步建议

导入完成后，最值得马上做的不是继续整理文档，而是：

1. 从 `Sprint 1` 里挑出真实要开的卡
2. 给 `I1` 的卡补 `Assignee`
3. 确认 `I1-01 ~ I1-05` 是否作为第一批开发入口
4. 开一次 30 分钟启动会，把依赖和验收方式对齐
