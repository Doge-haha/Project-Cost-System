# 新点 SaaS 造价系统项目启动说明

> 面向研发、测试、产品和业务验收团队的统一启动材料。

## 1. 这是什么项目

这是一个面向造价业务全流程的 SaaS 系统，目标是把项目从立项、招标、投标、合同、施工过程到结算与复盘这条链路统一到同一套系统里。

系统不是只做一个“计价工具”，而是要解决 3 件事：

- 让造价数据在不同阶段之间可以连续流转
- 让项目成员、专业和阶段协作有明确权限边界
- 在正式业务数据不被破坏的前提下，引入 AI 辅助推荐和预警能力

一句话讲，这个项目做的是：

`一个面向全过程造价管理的阶段化、可追溯、可协作的 SaaS 系统。`

## 2. 这个项目已经做到哪一步

这个项目已经不再是“需求讨论中”的状态了，目前已经完成了从设计到研发准备的完整一轮落地。

当前已经具备：

- 业务设计主文档
- 数据模型、状态机、权限矩阵
- OpenAPI 契约
- 源系统专业模型和字段映射
- 5 个研发迭代拆分
- Jira/Tapd 任务卡
- Jira/Tapd 导入 CSV
- Sprint 1 启动清单

也就是说，当前项目已经进入：

`可以正式开始研发执行`

而不是继续停留在大范围讨论需求阶段。

## 3. 系统怎么拆

当前系统按照 5 个迭代推进：

### Iteration 1

项目、阶段、成员、专业、工作台底座。

### Iteration 2

清单版本链、清单树、工作内容、初始导入。

### Iteration 3

定额、价目、取费、计价引擎、人工调价、批量重算。

### Iteration 4

审核流、状态联动、汇总、偏差分析、报表、审计日志。

### Iteration 5

AI 清单推荐、AI 定额推荐、偏差预警、人工确认、AI 审计，以及 MCP / 知识 / 记忆底座预留。

整体推进顺序固定为：

`I1 -> I2 -> I3 -> I4 -> I5`

## 4. 为什么要按这个顺序做

因为这个系统是强依赖主链的，不是所有模块都能随便并行。

核心依赖关系是：

- 没有 `I1`，后面没有项目、阶段、权限和专业基础
- 没有 `I2`，后面没有正式业务数据主链
- 没有 `I3`，后面汇总、审核和偏差分析没有稳定数据口径
- 没有 `I4`，系统还不能变成真正可审核、可交付的业务系统
- `I5` 属于效率增强能力，不能反向阻塞主业务上线

所以这个项目不是“先上 AI”，而是：

`先把正式业务链做稳，再加 AI 辅助。`

## 5. 当前最关键的 Sprint 是什么

当前最关键的是：

`Sprint 1`

Sprint 1 不是做清单、做计价、做审核，而是先把项目级配置底座跑通。

Sprint 1 完成后，系统至少要做到：

- 可创建项目
- 可配置阶段
- 可维护项目成员和权限范围
- 可配置项目专业与默认定额集
- 可进入阶段工作台

如果这一层没做稳，后面清单和计价会不断返工。

## 6. Sprint 1 先做什么

Sprint 1 建议先拉起三批卡。

### 第一批

技术地基：

- `I1-01`
- `I1-02`
- `I1-08`
- `I1-12`
- `I1-18`

### 第二批

核心业务接口：

- `I1-03`
- `I1-04`
- `I1-05`
- `I1-09`
- `I1-10`
- `I1-13`
- `I1-14`
- `I1-16`

### 第三批

前端与回归：

- `I1-06`
- `I1-07`
- `I1-11`
- `I1-15`
- `I1-17`
- `I1-19`
- `I1-20`

## 7. 团队现在最应该对齐什么

如果团队要顺利开跑，最需要统一的不是“想法”，而是下面 4 类口径：

### 7.1 业务口径

统一以 [设计文档_v1.0_优化中.md](/Users/huahaha/Documents/New%20project/设计文档_v1.0_优化中.md) 为准。

### 7.2 数据和状态口径

统一以：

- [data-model.md](/Users/huahaha/Documents/New%20project/docs/architecture/data-model.md)
- [state-machines.md](/Users/huahaha/Documents/New%20project/docs/architecture/state-machines.md)

为准。

### 7.3 权限口径

统一以 [permission-matrix.md](/Users/huahaha/Documents/New%20project/docs/architecture/permission-matrix.md) 为准。

### 7.4 接口口径

统一以当前 `/v1` 生成契约 [openapi-v1.yaml](/Users/huahaha/Documents/New%20project/docs/api/openapi-v1.yaml) 为准。

## 8. 现在团队怎么用这些文档

建议团队按下面方式使用：

### 产品/业务

主要看：

- [设计文档_v1.0_优化中.md](/Users/huahaha/Documents/New%20project/设计文档_v1.0_优化中.md)
- [master-delivery-roadmap.md](/Users/huahaha/Documents/New%20project/docs/architecture/master-delivery-roadmap.md)

### 后端

主要看：

- [data-model.md](/Users/huahaha/Documents/New%20project/docs/architecture/data-model.md)
- [state-machines.md](/Users/huahaha/Documents/New%20project/docs/architecture/state-machines.md)
- [permission-matrix.md](/Users/huahaha/Documents/New%20project/docs/architecture/permission-matrix.md)
- [openapi-v1.yaml](/Users/huahaha/Documents/New%20project/docs/api/openapi-v1.yaml)
- [backend-implementation-checklist.md](/Users/huahaha/Documents/New%20project/docs/architecture/backend-implementation-checklist.md)

### 前端

主要看：

- [设计文档_v1.0_优化中.md](/Users/huahaha/Documents/New%20project/设计文档_v1.0_优化中.md)
- [openapi-v1.yaml](/Users/huahaha/Documents/New%20project/docs/api/openapi-v1.yaml)
- [iteration-1-jira-cards.md](/Users/huahaha/Documents/New%20project/docs/architecture/iteration-1-jira-cards.md)

### 测试

主要看：

- [state-machines.md](/Users/huahaha/Documents/New%20project/docs/architecture/state-machines.md)
- [permission-matrix.md](/Users/huahaha/Documents/New%20project/docs/architecture/permission-matrix.md)
- [iteration-1-task-breakdown.md](/Users/huahaha/Documents/New%20project/docs/architecture/iteration-1-task-breakdown.md)
- [sprint-1-launch-checklist.md](/Users/huahaha/Documents/New%20project/docs/architecture/sprint-1-launch-checklist.md)

## 9. 当前项目风险点

虽然文档已经比较完整，但现在仍然有几类风险需要团队有意识地控制：

### 9.1 范围膨胀

如果 Sprint 1 提前开始碰清单、计价、审核，会稀释项目底座质量。

### 9.2 口径漂移

如果开发过程中绕开数据模型、状态机和权限矩阵，各模块会很快前后不一致。

### 9.3 先做 AI 的冲动

AI 在这个系统里是增强项，不是主链项。主链未稳之前，不建议抢跑。

### 9.4 源系统兼容被遗忘

如果后面建表和接口时忘了 [profession-model.md](/Users/huahaha/Documents/New%20project/docs/architecture/profession-model.md) 和 [source-field-mapping.md](/Users/huahaha/Documents/New%20project/docs/architecture/source-field-mapping.md)，后续导入和兼容成本会很高。

## 10. 现在最推荐的动作

现在最推荐的动作很明确：

1. 按 [jira-import-preflight-checklist.md](/Users/huahaha/Documents/New%20project/docs/architecture/jira-import-preflight-checklist.md) 完成项目管理工具准备
2. 导入 [jira-import-i1-i2.csv](/Users/huahaha/Documents/New%20project/docs/architecture/jira-import-i1-i2.csv)
3. 给 Sprint 1 核心卡补 `Assignee`
4. 按 [sprint-1-launch-checklist.md](/Users/huahaha/Documents/New%20project/docs/architecture/sprint-1-launch-checklist.md) 开启动会
5. 先从 `I1-01 ~ I1-05` 和 `I1-08 ~ I1-14` 推进

## 11. 一句话对团队的要求

这个项目现在最重要的不是“做很多”，而是：

`先把项目级底座做稳，再沿主链逐步把清单、计价、审核和 AI 接上。`
