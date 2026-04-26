# 新点 SaaS 造价系统 Sprint 1 启动清单

> 配合 [project-document-index.md](/Users/huahaha/Documents/New%20project/docs/architecture/project-document-index.md)、[iteration-1-task-breakdown.md](/Users/huahaha/Documents/New%20project/docs/architecture/iteration-1-task-breakdown.md) 与 [iteration-1-jira-cards.md](/Users/huahaha/Documents/New%20project/docs/architecture/iteration-1-jira-cards.md) 使用。

## 1. 文档目标

这份清单不是再描述 Sprint 1 要做什么，而是把 `Sprint 1` 真正启动时要完成的准备、会议、拉卡和执行顺序整理出来。

它主要解决 4 个问题：

- 第一次启动会怎么开
- Sprint 1 先拉哪些卡
- 后端、前端、测试第一周分别先干什么
- 怎么判断 Sprint 1 已经真正启动成功

## 2. Sprint 1 目标

Sprint 1 的目标不是把业务链做完，而是先把项目级配置底座跑通。

本轮 Sprint Goal 建议固定为：

`完成项目、阶段、成员、专业和工作台底座，让系统具备进入正式业务流程前的项目级配置能力。`

本轮结束后，系统至少要达到：

- 可创建项目
- 可展开并保存阶段配置
- 可维护项目成员与权限范围
- 可配置项目专业与默认定额集
- 可进入阶段工作台查看摘要信息

## 3. 启动前 1 天检查

Sprint 1 启动前，先确认下面这些条件已经满足：

### 3.1 文档准备

- [设计文档_v1.0_优化中.md](/Users/huahaha/Documents/New%20project/设计文档_v1.0_优化中.md) 已作为业务基线
- [technical-architecture-and-platform-selection.md](/Users/huahaha/Documents/New%20project/docs/architecture/technical-architecture-and-platform-selection.md) 已作为技术选型基线
- [ai-native-architecture-review.md](/Users/huahaha/Documents/New%20project/docs/architecture/ai-native-architecture-review.md) 已作为 AI 原生扩展基线
- [data-model.md](/Users/huahaha/Documents/New%20project/docs/architecture/data-model.md) 已作为建表基线
- [state-machines.md](/Users/huahaha/Documents/New%20project/docs/architecture/state-machines.md) 已作为状态口径基线
- [permission-matrix.md](/Users/huahaha/Documents/New%20project/docs/architecture/permission-matrix.md) 已作为权限口径基线
- [openapi-v1.yaml](/Users/huahaha/Documents/New%20project/docs/api/openapi-v1.yaml) 已作为当前 `/v1` 接口基线

### 3.2 项目工具准备

- Jira/Tapd 已创建项目
- `Sprint 1` 已创建
- `I1` Epic 已存在
- `I1` 的卡已导入或已手工建好
- `Assignee` 至少已填核心 P0 卡

### 3.3 环境准备

- 代码仓库已初始化或主仓已可用
- 数据库环境可用
- 迁移方式已确定
- 本地联调环境可启动
- 团队已经明确接口文档和表结构的唯一来源

## 4. 启动会怎么开

第一次 Sprint 启动会建议控制在 `30-45 分钟`。

推荐按下面顺序进行：

1. 先对齐 Sprint Goal
2. 再对齐本轮交付范围
3. 再确认本轮不做什么
4. 再分配核心卡负责人
5. 最后确认第一周执行顺序

### 4.1 必须在会上说清的 5 件事

1. `Sprint 1` 只做项目级配置底座，不碰清单正式编制和计价引擎
2. 权限口径以 [permission-matrix.md](/Users/huahaha/Documents/New%20project/docs/architecture/permission-matrix.md) 为准
3. 建表和枚举口径以 [data-model.md](/Users/huahaha/Documents/New%20project/docs/architecture/data-model.md) 与 [state-machines.md](/Users/huahaha/Documents/New%20project/docs/architecture/state-machines.md) 为准
4. 接口口径以当前 `/v1` 生成契约 [openapi-v1.yaml](/Users/huahaha/Documents/New%20project/docs/api/openapi-v1.yaml) 为准
5. 前端先做骨架和配置页，不要抢跑后续业务模块
6. 即使 Sprint 1 不直接做 AI 功能，后端模块边界也要为后续 `MCP / Knowledge / Memory` 预留扩展点，避免把上下文聚合和知识沉淀能力写死在业务接口里

## 5. Sprint 1 先拉哪些卡

Sprint 1 不建议一上来把 `I1` 全部卡都拖进进行中，建议先分三层。

### 5.1 第一批必须立即开工的 P0 卡

- `I1-01` 创建项目基础表迁移
- `I1-02` 初始化标准阶段主数据
- `I1-08` 创建项目成员与权限范围表迁移
- `I1-12` 创建专业与定额集主数据表迁移
- `I1-18` 固化 Iteration 1 枚举与常量

这一批是 Sprint 1 的技术地基，没有它们，后面接口很难稳定推进。

### 5.2 第二批核心业务卡

- `I1-03` 实现项目创建接口
- `I1-04` 实现项目详情接口
- `I1-05` 实现阶段配置读写接口
- `I1-09` 实现 JWT 与项目成员鉴权中间件
- `I1-10` 实现项目成员读写接口
- `I1-13` 初始化专业与定额集样本数据
- `I1-14` 实现项目专业配置接口
- `I1-16` 设计并实现阶段工作台聚合接口

### 5.3 第三批前端与回归卡

- `I1-06` 项目列表页与创建页前端骨架
- `I1-07` 阶段配置页前端实现
- `I1-11` 成员与权限配置页前端实现
- `I1-15` 项目专业配置页前端实现
- `I1-17` 阶段工作台前端页实现
- `I1-19` 预留导入任务与 import 权限基础能力
- `I1-20` Iteration 1 集成测试与回归

## 6. 建议负责人分工

如果你是小团队，推荐按下面方式分。

### 6.1 后端 A

负责：

- `I1-01`
- `I1-02`
- `I1-03`
- `I1-04`
- `I1-05`
- `I1-16`

定位：

- 项目、阶段、工作台主链负责人

### 6.2 后端 B

负责：

- `I1-08`
- `I1-09`
- `I1-10`
- `I1-12`
- `I1-13`
- `I1-14`
- `I1-18`
- `I1-19`

定位：

- 权限、成员、专业、定额集、枚举主链负责人

### 6.3 前端

负责：

- `I1-06`
- `I1-07`
- `I1-11`
- `I1-15`
- `I1-17`

定位：

- 项目配置与工作台前端负责人

### 6.4 测试

负责：

- 提前介入 `I1-03`、`I1-05`、`I1-10`、`I1-14`、`I1-16`
- 输出 Sprint 1 核心验证清单
- 最后承接 `I1-20`

## 7. 第一周建议执行顺序

最推荐的实际推进顺序如下：

### Day 1

- 完成 Sprint 启动会
- 后端启动 `I1-01`、`I1-08`、`I1-12`
- 同步开始 `I1-02`、`I1-18`
- 前端开始项目列表页和创建页骨架

### Day 2

- 建表迁移完成并落库验证
- 阶段主数据、专业主数据、定额集样本开始初始化
- 后端开始 `I1-03`、`I1-09`
- 前端继续项目创建页和详情入口

### Day 3

- 后端推进 `I1-04`、`I1-05`
- 权限中间件接入
- 后端推进 `I1-10`、`I1-14`
- 前端接阶段配置页

### Day 4

- 后端推进 `I1-16`
- 前端推进成员权限页、专业配置页
- 测试开始按接口联调准备验证场景

### Day 5

- 前端推进工作台页
- 后端补 `I1-19`
- 测试执行 `I1-20`
- 做一次 Sprint 1 周末回顾，确认下周是否能稳定收尾

## 8. Sprint 1 会上最好直接确认的口径

为了避免开发过程中反复扯皮，建议启动会当场确认下面这些口径：

### 8.1 项目创建时默认动作

- 是否自动展开 `9 个标准阶段`
- 是否必须立即指定项目负责人
- 是否在创建时允许不填默认价目版本和默认取费模板

建议答案：

- 自动展开 `9 个标准阶段`
- 必须指定项目负责人
- 价目版本和取费模板允许暂空

### 8.2 项目专业配置口径

- 一个项目允许启用多个专业
- 每个专业绑定一个默认定额集
- 非法定额集绑定直接返回 `422`

### 8.3 权限口径

- 非项目成员不可访问项目详情
- `project_owner` 可编辑项目配置
- `reviewer` 在 Sprint 1 主要是查看角色，不参与后续审核流处理

## 9. Sprint 1 完成标准

如果 Sprint 1 结束时满足下面这些条件，就可以认为本轮启动成功且交付达标：

- 数据库迁移可在空库正常跑通
- 可创建一个新项目
- 新项目自动带出阶段配置
- 可调整阶段顺序和负责人
- 可维护项目成员和权限范围
- 可配置项目专业和默认定额集
- 可进入阶段工作台并看到摘要信息
- 非项目成员访问会被拦截

## 10. Sprint 1 结束后立刻接什么

Sprint 1 一旦稳定完成，下一步不要再回头扩写 I1 文档，而是直接进入：

1. `Iteration 2` 清单与版本链
2. 清单版本建表
3. 清单树与工作内容接口
4. 初始导入主链

也就是说，Sprint 1 的意义是把“项目级配置底座”固定下来，Sprint 2 就正式切入业务主数据。

## 11. 一句话总结

Sprint 1 最重要的不是做很多功能，而是把项目、阶段、权限、专业和工作台这条底座链做稳。
