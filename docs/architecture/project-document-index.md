# 新点 SaaS 造价系统项目文档总览

> 这份文档是当前项目的总入口，帮助你快速定位“当前上下文、业务设计、架构规则、实施排期、生产硬化”五类核心资料。

## 1. 当前项目文档体系

当前文档已经可以分成 5 层：

1. 当前上下文层
2. 产品与业务设计层
3. 架构与规则层
4. 实施与排期层
5. 生产硬化与试运行层

如果你是第一次进入项目，最推荐的阅读顺序是：

1. [current-working-context.md](../context/current-working-context.md)
2. [设计文档_v1.0_优化中.md](/Users/huahaha/Documents/New%20project/设计文档_v1.0_优化中.md)
3. [data-model.md](/Users/huahaha/Documents/New%20project/docs/architecture/data-model.md)
4. [state-machines.md](/Users/huahaha/Documents/New%20project/docs/architecture/state-machines.md)
5. [permission-matrix.md](/Users/huahaha/Documents/New%20project/docs/architecture/permission-matrix.md)
6. [openapi-v1.yaml](/Users/huahaha/Documents/New%20project/docs/api/openapi-v1.yaml)
7. [master-delivery-roadmap.md](/Users/huahaha/Documents/New%20project/docs/architecture/master-delivery-roadmap.md)
8. [iteration-6-production-hardening-plan.md](./iteration-6-production-hardening-plan.md)
9. [production-readiness-runbook.md](./production-readiness-runbook.md)

## 2. 产品与业务设计层

这一层回答的是：`系统要做什么，业务边界是什么`

### 核心主文档

- [设计文档_v1.0_优化中.md](/Users/huahaha/Documents/New%20project/设计文档_v1.0_优化中.md)

### 作用

- 定义产品定位和设计目标
- 统一 `9 个阶段` 的业务链路
- 明确“阶段 / 子工作 / 模块 / 业务对象”的边界
- 明确角色、权限、版本、数据引用、锁定和 AI 边界
- 作为后续技术设计和研发拆分的业务基线

## 3. 架构与规则层

这一层回答的是：`系统底层规则怎么定，前后端怎么对齐`

### 3.1 核心数据与状态

- [technical-architecture-and-platform-selection.md](/Users/huahaha/Documents/New%20project/docs/architecture/technical-architecture-and-platform-selection.md)
- [backend-tech-stack-redecision.md](/Users/huahaha/Documents/New%20project/docs/architecture/backend-tech-stack-redecision.md)
- [backend-architecture-redesign.md](/Users/huahaha/Documents/New%20project/docs/architecture/backend-architecture-redesign.md)
- [backend-project-skeleton-design.md](/Users/huahaha/Documents/New%20project/docs/architecture/backend-project-skeleton-design.md)
- [design-closure-review.md](/Users/huahaha/Documents/New%20project/docs/architecture/design-closure-review.md)
- [ai-native-architecture-review.md](/Users/huahaha/Documents/New%20project/docs/architecture/ai-native-architecture-review.md)
- [mcp-capability-design.md](/Users/huahaha/Documents/New%20project/docs/architecture/mcp-capability-design.md)
- [knowledge-and-memory-architecture.md](/Users/huahaha/Documents/New%20project/docs/architecture/knowledge-and-memory-architecture.md)
- [deployment-architecture.md](/Users/huahaha/Documents/New%20project/docs/architecture/deployment-architecture.md)
- [workflow-and-form-engine-design.md](/Users/huahaha/Documents/New%20project/docs/architecture/workflow-and-form-engine-design.md)
- [bill-grid-implementation-design.md](/Users/huahaha/Documents/New%20project/docs/architecture/bill-grid-implementation-design.md)
- [data-model.md](/Users/huahaha/Documents/New%20project/docs/architecture/data-model.md)
- [state-machines.md](/Users/huahaha/Documents/New%20project/docs/architecture/state-machines.md)
- [permission-matrix.md](/Users/huahaha/Documents/New%20project/docs/architecture/permission-matrix.md)
- [openapi-v1.yaml](/Users/huahaha/Documents/New%20project/docs/api/openapi-v1.yaml)

### 3.2 源系统兼容与映射

- [profession-model.md](/Users/huahaha/Documents/New%20project/docs/architecture/profession-model.md)
- [source-field-mapping.md](/Users/huahaha/Documents/New%20project/docs/architecture/source-field-mapping.md)

### 3.3 各文档作用

- `technical-architecture-and-platform-selection`
  定义系统整体技术架构、编程语言、数据库/存储选型、清单表格实现方式和流程低代码方案。

- `backend-tech-stack-redecision`
  从 AI-first 视角重新论证后端技术栈，明确 Java 不再作为默认主后端，推荐采用 `TypeScript 主后端 + Python AI 子系统`。

- `backend-architecture-redesign`
  基于新的技术栈决策，重写后端、AI runtime 和 MCP gateway 的服务边界、目录结构与迁移顺序。

- `backend-project-skeleton-design`
  定义单仓多目录下的后端、Worker、MCP Gateway 工程骨架，明确包结构、迁移目录、流程引擎接入点和 AI 原生扩展落位。

- `design-closure-review`
  对当前整套设计体系做收口 review，记录已修复问题、当前无阻塞项和残余风险。

- `ai-native-architecture-review`
  从 MCP、skills、系统记忆、知识库与知识图谱角度复盘当前方案，并给出 AI 原生补强建议。

- `mcp-capability-design`
  定义面向 AI Agent 的 MCP 资源、工具、上下文打包方式与权限裁剪模型。

- `knowledge-and-memory-architecture`
  定义知识条目、系统记忆、轻量知识图谱关系以及从复盘/审核/推荐中抽取沉淀的方式。

- `deployment-architecture`
  定义开发、测试、生产环境的部署拓扑、组件落位、监控、备份与安全边界。

- `workflow-and-form-engine-design`
  定义流程定义、表单 schema、节点权限、审批人规则、运行时实例和流程绑定方式。

- `bill-grid-implementation-design`
  定义清单树表格的列模型、编辑模型、批量 patch、锁定态、来源链和性能策略。

- `data-model`
  定义核心实体、字段、索引、唯一约束和源系统兼容字段。

- `state-machines`
  定义项目、阶段、清单版本、审核、锁定、报表任务和 AI 推荐的状态流转。

- `permission-matrix`
  定义系统角色、业务身份、资源操作权限和前端按钮显隐口径。

- `openapi-v1`
  定义前后端联调接口边界，是 API 契约基线。

- `profession-model`
  定义从新点江苏版软件中提取的“专业、定额集、业务视图”模型。

- `source-field-mapping`
  定义源系统字段如何映射到当前 SaaS 系统模型。

## 4. 实施与排期层

这一层回答的是：`V1 怎么落地，按什么顺序做`

### 4.1 总实施与总排期

- [2026-04-16-saas-pricing-v1-implementation.md](/Users/huahaha/Documents/New%20project/docs/superpowers/plans/2026-04-16-saas-pricing-v1-implementation.md)
- [backend-implementation-checklist.md](/Users/huahaha/Documents/New%20project/docs/architecture/backend-implementation-checklist.md)
- [master-delivery-roadmap.md](/Users/huahaha/Documents/New%20project/docs/architecture/master-delivery-roadmap.md)
- [iteration-6-production-hardening-plan.md](./iteration-6-production-hardening-plan.md)
- [production-readiness-runbook.md](./production-readiness-runbook.md)

### 4.2 六个迭代拆分

- [iteration-1-task-breakdown.md](/Users/huahaha/Documents/New%20project/docs/architecture/iteration-1-task-breakdown.md)
- [iteration-2-task-breakdown.md](/Users/huahaha/Documents/New%20project/docs/architecture/iteration-2-task-breakdown.md)
- [iteration-3-task-breakdown.md](/Users/huahaha/Documents/New%20project/docs/architecture/iteration-3-task-breakdown.md)
- [iteration-4-task-breakdown.md](/Users/huahaha/Documents/New%20project/docs/architecture/iteration-4-task-breakdown.md)
- [iteration-5-task-breakdown.md](/Users/huahaha/Documents/New%20project/docs/architecture/iteration-5-task-breakdown.md)
- [iteration-6-production-hardening-plan.md](./iteration-6-production-hardening-plan.md)

### 4.3 六个迭代的含义

- `I1`
  项目管理、阶段配置、成员权限、专业配置、阶段工作台。

- `I2`
  清单版本链、清单树、工作内容、初始导入。

- `I3`
  定额、价目、取费、计价引擎、人工调价、重算。

- `I4`
  审核流、状态联动、汇总、偏差分析、报表、审计日志。

- `I5`
  AI 清单推荐、AI 定额推荐、偏差预警、人工确认、AI 审计，以及 MCP / 知识 / 记忆底座预留。

- `I6`
  发布准入、数据库 smoke、后台任务压测、健康检查聚合、试运行运维文档。

## 5. 派工与导入落地层

这一层回答的是：`怎么把计划真正落到 Jira/Tapd`

### 5.1 Jira/Tapd 任务卡

- [iteration-1-jira-cards.md](/Users/huahaha/Documents/New%20project/docs/architecture/iteration-1-jira-cards.md)
- [iteration-2-jira-cards.md](/Users/huahaha/Documents/New%20project/docs/architecture/iteration-2-jira-cards.md)
- [iteration-3-jira-cards.md](/Users/huahaha/Documents/New%20project/docs/architecture/iteration-3-jira-cards.md)
- [iteration-4-jira-cards.md](/Users/huahaha/Documents/New%20project/docs/architecture/iteration-4-jira-cards.md)
- [iteration-5-jira-cards.md](/Users/huahaha/Documents/New%20project/docs/architecture/iteration-5-jira-cards.md)

### 5.2 导入模板与导入数据

- [jira-import-template.md](/Users/huahaha/Documents/New%20project/docs/architecture/jira-import-template.md)
- [jira-import-i1-i2.csv](/Users/huahaha/Documents/New%20project/docs/architecture/jira-import-i1-i2.csv)
- [jira-import-i3-i5.csv](/Users/huahaha/Documents/New%20project/docs/architecture/jira-import-i3-i5.csv)
- [jira-import-preflight-checklist.md](/Users/huahaha/Documents/New%20project/docs/architecture/jira-import-preflight-checklist.md)

### 5.3 这一层的作用

- 任务卡文档用于人读、评审和分工
- CSV 用于直接导入 Jira/Tapd
- 导入前检查清单用于避免字段、Epic、Sprint 映射出错

## 6. 现在最应该用哪几份

如果你当前要继续推进主线，最应该优先看的 6 份是：

1. [current-working-context.md](../context/current-working-context.md)
2. [iteration-6-production-hardening-plan.md](./iteration-6-production-hardening-plan.md)
3. [backend-implementation-checklist.md](/Users/huahaha/Documents/New%20project/docs/architecture/backend-implementation-checklist.md)
4. [master-delivery-roadmap.md](/Users/huahaha/Documents/New%20project/docs/architecture/master-delivery-roadmap.md)
5. [deployment-architecture.md](/Users/huahaha/Documents/New%20project/docs/architecture/deployment-architecture.md)
6. [mcp-capability-design.md](/Users/huahaha/Documents/New%20project/docs/architecture/mcp-capability-design.md)

## 7. 当前项目状态判断

截至 2026-05-04，这个项目已经不处在“需求讨论阶段”或“底座重建阶段”了，而是已经进入：

- 设计完成
- 架构约束完成
- I1-I5 主链代码闭环完成
- API / MCP / Worker / Frontend 基线可回归
- I6 生产硬化准备阶段

也就是说，当前最合理的动作不是继续扩写大文档，而是：

1. 固化整仓准入命令和回归矩阵
2. 复跑 database mode smoke
3. 做报表导出和后台任务压力样本
4. 聚合运行时健康检查
5. 补齐试运行运维文档

## 8. 推荐启动顺序

最推荐的启动顺序是：

1. 看 [current-working-context.md](../context/current-working-context.md)
2. 看 [iteration-6-production-hardening-plan.md](./iteration-6-production-hardening-plan.md)
3. 看 [production-readiness-runbook.md](./production-readiness-runbook.md)
4. 跑 `npm run typecheck`、`npm run test`、`npm run docs:api`、`npm run docs:openspec`
5. 复跑 `npm run dev:smoke:live-db`
6. 按 I6 顺序处理压测、健康检查和试运行文档

## 9. 一句话总结

这套文档已经从“产品方案”推进成“主链开发闭环完成、进入试运行硬化”的完整交付基线。

## 10. 工作日志

用于记录阶段性决策、已完成能力、验证结果和下次启动点。

- [work-log-2026-04-17.md](/Users/huahaha/Documents/New%20project/docs/architecture/work-log-2026-04-17.md)
