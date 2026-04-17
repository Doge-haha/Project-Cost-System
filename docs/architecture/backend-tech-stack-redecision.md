# 新点 SaaS 造价系统后端技术栈重新论证

> 目标：在“AI 原生能力优先”的前提下，重新审视后端技术栈，不把既有 `Java 21 + Spring Boot 3` 视为既成事实。

## 1. 为什么要重做这次决策

此前文档体系中，后端技术栈是在 [technical-architecture-and-platform-selection.md](/Users/huahaha/Documents/New%20project/docs/architecture/technical-architecture-and-platform-selection.md) 里收敛为：

- `Java 21`
- `Spring Boot 3`

当时的推理核心是：

- 强事务业务多
- 审核和锁定状态机复杂
- BPMN / 工作流平台化预期较强
- 企业级权限与报表导向明显

这个结论对“传统企业后台系统”是成立的，但它默认优化的是：

`企业级事务系统开发舒适度`

而不是：

`AI 原生能力、MCP 亲和力、skills 生态、memory / knowledge 演进能力`

如果本项目未来的核心竞争力是：

- 可被 AI Agent 深度调用
- 能持续沉淀知识和系统记忆
- 能将业务能力包装成 skills / tools / MCP resources
- 能让 AI 成为长期增强引擎，而不只是外挂推荐

那么技术栈就必须按 `AI-first` 重新论证。

## 2. 这次决策的评价标准

本次不以“团队过去最熟什么语言”为第一标准，而以以下 6 项为准：

1. `AI 生态成熟度`
2. `MCP / Agent / Tooling 亲和力`
3. `知识库 / 记忆 / 检索 / 向量能力落地效率`
4. `强事务业务和复杂权限的可控性`
5. `前后端协作与迭代速度`
6. `未来 2-3 年架构演进的可持续性`

## 3. 必须面对的系统定位

这个系统不是纯 AI 应用，也不是纯传统 ERP。

它至少同时具备四种属性：

- 强事务业务系统
- 高密度表格与规则引擎系统
- 流程驱动系统
- AI 原生业务平台

因此最关键的问题不是“Java 行不行”或“Node 行不行”，而是：

`哪种技术栈更适合把这四种属性同时长期承接住。`

## 4. 当前外部生态事实

### 4.1 MCP SDK 成熟度

根据官方 MCP SDK 页面：

- TypeScript SDK：`Tier 1`
- Python SDK：`Tier 1`
- Go SDK：`Tier 1`
- Java SDK：`Tier 2`

来源：
- [Model Context Protocol SDKs](https://modelcontextprotocol.io/docs/sdk)

这意味着：

- Java 可以做 MCP，但不是最成熟主线
- 若项目把 MCP 视为核心能力层，Java 并不是最优起点

### 4.2 OpenAI Agents SDK 官方主线

OpenAI 官方 Agents SDK 当前面向：

- Python
- TypeScript

并没有 Java 主线 SDK。

来源：
- [Agents SDK | OpenAI API](https://platform.openai.com/docs/guides/agents-sdk/)
- [OpenAI Agents SDK for TypeScript](https://openai.github.io/openai-agents-js/)
- [OpenAI Agents SDK for Python](https://openai.github.io/openai-agents-python/agents/)

这意味着：

- 如果后续要把 AI runtime 做成系统一等能力
- 用 Python / TypeScript 会更自然
- Java 更像“接入层”而不是“AI 主运行层”

### 4.3 Agent 编排与长期记忆生态

LangGraph / LangChain 的主线生态仍然明显偏向：

- Python
- JavaScript / TypeScript

来源：
- [LangGraph.js Reference](https://reference.langchain.com/javascript/langchain-langgraph)
- [LangChain / LangGraph 1.0 alpha releases](https://blog.langchain.com/langchain-langchain-1-0-alpha-releases/)

这意味着：

- 若未来要做复杂 agent orchestration、durable execution、long-term memory
- TypeScript / Python 的演进成本明显更低

### 4.4 Java 在 AI / MCP 上不是没有能力

Spring AI 已经提供：

- MCP Java SDK 集成
- MCP 注解模型
- OpenAI Java SDK 集成

来源：
- [Spring AI MCP Annotations](https://docs.spring.io/spring-ai/reference/api/mcp/mcp-annotations-overview.html)
- [Spring AI Getting Started with MCP](https://docs.spring.io/spring-ai/reference/guides/getting-started-mcp.html)
- [Spring AI MCP Java SDK](https://docs.spring.io/spring-ai-mcp/reference/mcp.html)
- [Spring AI OpenAI SDK Chat](https://docs.spring.io/spring-ai/reference/1.1-SNAPSHOT/api/chat/openai-sdk-chat.html)

但需要明确：

- Spring AI / MCP Security 仍有一部分在快速演进中
- MCP Security 文档明确标注部分内容 still work in progress

来源：
- [Spring AI MCP Security](https://docs.spring.io/spring-ai/reference/api/mcp/mcp-security.html)

这说明 Java 不是不能做 AI-first，但不是最顺手的主战场。

## 5. 三条候选路线

## 5.1 方案 A：继续 `Java + Spring Boot` 做主后端

### 优点

- 强事务、复杂权限、流程状态机表达稳定
- Spring 生态成熟
- 对传统企业交付友好
- 未来接 BPMN/Flowable 更顺

### 缺点

- MCP 和 agent runtime 不在最强生态位
- AI 能力更容易被做成“外挂模块”
- skills / tools / knowledge / memory 的演进速度通常不如 Python / TypeScript
- 业务主后端和 AI 平台层容易产生语言割裂

### 适用前提

只有在以下条件同时成立时，Java 才是更优主后端：

- 审批流和 BPMN 是 V1 核心刚需
- 团队已有成熟 Java 工程能力
- AI 在 V1-V2 主要还是辅助功能，而不是平台主引擎

### 判断

如果本项目的第一性目标是“企业事务系统优先”，方案 A 合理。  
如果第一性目标是“AI 原生平台优先”，方案 A 不再是默认推荐。

## 5.2 方案 B：`TypeScript` 单后端

推荐形态：

- `TypeScript`
- `NestJS` 或 `Fastify + Zod + Prisma/Drizzle`

### 优点

- 与前端同语言，认知负担低
- MCP、tool calling、agent gateway、skills 封装非常顺
- OpenAI Agents SDK TypeScript 主线直接可用
- 事件驱动接口、上下文聚合、资源打包、SSE/streaming 更自然
- 中后台产品迭代速度快

### 缺点

- 流程/BPMN 生态不如 Java
- 复杂事务和高规则密度业务需要更强工程 discipline
- 如果后续引入大量企业流程平台能力，可能要自己补很多基建

### 适用前提

方案 B 适合：

- AI 原生能力是主战略
- 不执着于 V1 就引入 BPMN 引擎
- 审批流可先用轻量自研状态机 + 表单配置承接
- 团队更看重交付速度和产品演进弹性

### 判断

如果系统主目标是“AI 原生业务平台”，方案 B 比纯 Java 更有竞争力。

## 5.3 方案 C：`TypeScript 主后端 + Python AI 子系统`

推荐形态：

- 主业务 API：`TypeScript`
- AI Runtime / Knowledge / Memory / Retrieval：`Python`

### 优点

- 业务主后端与前端同语言，交付速度快
- AI 子系统使用最强生态
- MCP gateway、skills、tool packaging 可放在 TypeScript 层
- knowledge extraction、embedding、RAG、graph enrichment 放在 Python 层最顺
- 能同时兼顾“业务系统可控性”和“AI 平台能力”

### 缺点

- 需要跨语言边界
- 需要额外的事件总线 / queue / internal API
- DevOps 和 observability 复杂度高于单语言

### 适用前提

方案 C 适合：

- 明确把 AI 当成系统主能力之一
- 允许 V1-V2 接受适度架构复杂度
- 愿意把 AI 和主业务进行服务边界切分

### 判断

这是最符合“AI-first + 业务可控”平衡点的方案。

## 6. 为什么我不再推荐“默认 Java”

如果只看事务、权限、流程，Java 当然是合理推荐。  
但这个项目现在新增了一个更高权重的目标：

`让系统成为可被 AI 深度利用、并能持续反哺 AI 的业务平台`

在这个目标下，Java 的问题不是“做不到”，而是：

- 它不是 MCP / agents / skills / memory 生态的最优主线
- 它容易把 AI 做成附属模块
- 它更像传统企业系统的最优解，而不是 AI 原生平台的最优解

因此，Java 从“默认推荐”降级为：

`特定条件下的可选方案`

而不应再被视为本项目的先验正确答案。

## 7. 推荐结论

### 最终推荐

推荐采用：

`方案 C：TypeScript 主后端 + Python AI 子系统`

### 原因

这是当前最平衡的方案：

- 主业务 API、权限、项目/阶段/清单/定额、导入导出、版本链，用 TypeScript 承接
- MCP gateway、agent-facing tools、context aggregation 与 API 同语言，天然顺滑
- Python 负责：
  - 知识抽取
  - 记忆归档
  - embedding / retrieval
  - RAG / agent runtime
  - 知识图谱 enrichment

这个组合的好处是：

- 不会让 AI 变成外挂
- 也不把整个主业务系统强行做成 Python
- 保持前后端协作速度
- 未来演进到 MCP / Skills / Knowledge / Memory 时不会逆风

## 8. 如果只允许单后端语言

若团队明确要求：

`V1 只允许一个主后端语言`

那我会推荐：

`TypeScript`

而不是 Java。

原因不是 Java 不好，而是：

- TypeScript 与当前 AI 生态主线更近
- MCP / tool / agent 接入更轻
- 与前端共语言的协作收益真实存在
- 未来要拆 Python AI 子系统时，也比从 Java 迁移更平滑

## 9. 对当前代码状态的影响

当前 `apps/backend` 已经基于 Java + Spring Boot 落了第一批骨架和业务链。

这意味着现在不是“有没有做技术决策”，而是：

`是否接受已有 Java 代码作为试验性落地，还是将其视为需要回滚的验证分支。`

我建议把当前状态定性为：

- 已完成一轮基于 Java 的快速验证
- 但不自动等于最终主干技术栈

如果团队接受本次 AI-first 重论证，那么后续应做二选一：

1. 停止继续扩大 Java 面积，将其冻结为原型分支
2. 启动 TypeScript 主后端骨架重建，并把已有领域规则迁移过去

## 10. 建议的决策动作

建议按下面顺序执行：

1. 正式确认：本项目第一优先级是否为 `AI 原生能力`
2. 若答案是“是”，则撤销“Java 为默认主后端”的状态
3. 以 `TypeScript 主后端 + Python AI 子系统` 作为新的目标技术方案
4. 将当前 Java 代码视为领域规则验证样本，而不是最终主线
5. 补一份新的工程骨架文档，按新技术栈重写目录与模块边界

## 11. 一句话结论

如果这个系统的核心目标是“AI 原生业务平台”，  
那么纯 `Java + Spring Boot` 不再是最优默认方案。

更合理的终局应该是：

`TypeScript 负责业务主后端与 MCP 接入层，Python 负责 AI Runtime、Knowledge、Memory 和 Retrieval。`
