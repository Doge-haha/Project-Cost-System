# 新点 SaaS 造价系统设计收口 Review

> 本文档基于 `Superpowers` 的 review 思路整理，目标不是重复文档内容，而是确认当前设计体系是否已经闭环，以及还有哪些残余风险需要在开工前被看见。

## 1. Review 范围

本次 review 覆盖以下 4 层：

- 产品与业务设计层
- 架构与规则层
- 实施与排期层
- 派工、导入与启动层

重点检查 5 类问题：

- 文档之间是否口径一致
- `I5` 的 AI 原生扩展是否真正回写到执行层
- 后端骨架是否有明确边界
- `MCP / Knowledge / Memory` 是否只停留在概念层
- Sprint 启动材料是否会误导团队按旧口径开工

## 2. 本轮发现

### Finding 1：`Iteration 5` 在不同层文档中存在口径漂移

问题表现：

- 任务拆分文档已经纳入 `MCP / Knowledge / Memory` 预留
- 但 Jira 卡、CSV、导入前检查、总排期、团队启动说明里仍有部分旧口径

影响：

- 如果直接导入项目管理工具，`I5` 会漏掉 AI 原生底座相关卡
- 团队会误以为 `I5` 只有推荐与预警，没有长期增智底座

处理结果：

- 已修复
- 已补 `I5-EPIC-7`
- 已补 `I5-21 ~ I5-23`
- 已同步到 CSV、导入检查清单、总排期和团队说明

### Finding 2：技术架构层已补齐，但工程骨架层之前缺少正式落地文档

问题表现：

- 之前已经有技术选型、部署架构、流程引擎、清单表格、AI 原生设计
- 但缺少一份明确说明“仓库怎么搭、后端怎么拆、模块怎么落位”的工程骨架文档

影响：

- 真正开工时容易出现目录随手搭、模块边界混乱、`worker / mcp-gateway` 后补返工

处理结果：

- 已修复
- 已新增 [backend-project-skeleton-design.md](/Users/huahaha/Documents/New%20project/docs/architecture/backend-project-skeleton-design.md)

### Finding 3：Sprint 1 启动材料原本没有把 AI 原生边界作为早期架构约束说清

问题表现：

- Sprint 1 本身不做 AI 功能
- 但如果启动会不强调 AI 原生扩展点，团队很可能把上下文聚合、知识沉淀能力直接写死进业务接口

影响：

- 后面加 `MCP`、知识、记忆时，会出现架构返工

处理结果：

- 已修复
- 已在 [sprint-1-launch-checklist.md](/Users/huahaha/Documents/New%20project/docs/architecture/sprint-1-launch-checklist.md) 中加入：
  - 技术选型基线
  - AI 原生扩展基线
  - Sprint 1 也必须预留 `MCP / Knowledge / Memory` 边界的说明

## 3. 当前结论

本轮 review 后，可以给出一个明确判断：

当前这套文档已经从“设计稿集合”收敛成了“可直接进入工程实施”的完整设计基线。

这句话成立的前提是：

- 业务设计有统一主文档
- 架构规则有数据模型、状态机、权限和 API 契约
- 技术实现有技术选型、部署、流程引擎、清单表格、后端骨架
- AI 原生扩展已经正式进入数据模型、实施计划、任务拆分和导入层
- Sprint 启动材料已经和总架构保持一致

## 4. 当前无阻塞项

以当前文档完整度看，本轮 review 没有发现阻止开工的 `P0` 设计缺陷。

也就是说：

- 没有发现必须重构整套方案的架构错误
- 没有发现主链依赖顺序错误
- 没有发现 `MCP / Knowledge / Memory` 与主业务链根本冲突

## 5. 残余风险

虽然没有阻塞项，但仍有 3 个需要在开工时持续盯住的风险：

1. `backend / worker / mcp-gateway` 如果后续被不同人自由发挥，仍然可能重新耦合在一起。  
建议：第一批脚手架必须严格按 [backend-project-skeleton-design.md](/Users/huahaha/Documents/New%20project/docs/architecture/backend-project-skeleton-design.md) 建目录。

2. `I5` 虽然已经补了 AI 原生底座预留，但如果研发排期压缩，团队很容易只做推荐接口，不做知识/记忆预留。  
建议：把 `I5-21 ~ I5-23` 明确标成“不可省略的 P1”。

3. Flowable、AI、MCP 都是扩展点，如果开工后缺少统一 owner，边界容易漂移。  
建议：尽早明确一名后端 owner 负责平台能力边界。

## 6. 推荐动作

本轮 design closure 完成后，最推荐的下一步不是继续扩写大文档，而是：

1. 以 [backend-project-skeleton-design.md](/Users/huahaha/Documents/New%20project/docs/architecture/backend-project-skeleton-design.md) 为基线创建工程目录
2. 按 `Sprint 1` 清单启动第一批底座卡
3. 优先完成 `backend` 的迁移、权限、项目、专业配置骨架
4. 再让前端和 `worker / mcp-gateway` 逐步接入

## 7. 一句话结论

当前设计工作可以视为已经闭环，接下来最有价值的动作是把文档转换成第一批真实代码，而不是继续扩写概念层材料。
