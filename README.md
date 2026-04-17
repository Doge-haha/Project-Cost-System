# 新点 SaaS 造价系统

当前仓库采用单仓多目录组织，承载：

- `apps/api`：TypeScript 主业务后端
- `apps/ai-runtime`：Python AI Runtime / Knowledge / Memory 子系统
- `apps/worker`：TypeScript 异步任务进程
- `apps/mcp-gateway`：TypeScript 面向 AI Agent 的 MCP 能力入口
- `apps/frontend`：前端应用
- `legacy/backend-java`：冻结归档的 Java 规则验证原型
- `docs`：设计、架构、实施、排期和导入文档
- `deploy`：部署相关脚本与配置

当前仓库已经完成 AI-first 技术栈重决策，正在按新的执行基线重建后端骨架。

优先参考文档：

- [项目文档总览](./docs/architecture/project-document-index.md)
- [后端技术栈重决策](./docs/architecture/backend-tech-stack-redecision.md)
- [后端重构方案](./docs/architecture/backend-architecture-redesign.md)
- [AI 原生架构复盘](./docs/architecture/ai-native-architecture-review.md)

推荐启动顺序：

1. 先看 [后端技术栈重决策](./docs/architecture/backend-tech-stack-redecision.md)
2. 再看 [后端重构方案](./docs/architecture/backend-architecture-redesign.md)
3. 在 `apps/api` 重建主业务后端
4. 在 `apps/ai-runtime` 落知识、记忆、检索和 agent runtime
5. 在 `apps/mcp-gateway` 对外暴露 MCP resource/tool/context
