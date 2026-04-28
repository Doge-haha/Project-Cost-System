# 新点 SaaS 造价系统

当前仓库采用单仓多目录组织，承载：

- `apps/api`：TypeScript 主业务后端
- `apps/ai-runtime`：Python AI Runtime / Knowledge / Memory 子系统
- `apps/worker`：TypeScript 异步任务进程
- `apps/mcp-gateway`：TypeScript 面向 AI Agent 的 MCP 能力入口
- `apps/frontend`：React + Vite 前端工作台
- `docs`：设计、架构、实施、排期和导入文档
- `deploy`：部署相关脚本与配置

当前仓库已经完成 AI-first 技术栈重决策，正在按新的执行基线重建后端骨架。

优先参考文档：

- [项目文档总览](./docs/architecture/project-document-index.md)
- [后端技术栈重决策](./docs/architecture/backend-tech-stack-redecision.md)
- [后端重构方案](./docs/architecture/backend-architecture-redesign.md)
- [AI 原生架构复盘](./docs/architecture/ai-native-architecture-review.md)
- [API 契约文档](./docs/api/README.md)
- [OpenSpec 规范化索引](./openspec/changes/doc-normalize-v1-to-openspec/index.md)

推荐启动顺序：

1. 先看 [后端技术栈重决策](./docs/architecture/backend-tech-stack-redecision.md)
2. 再看 [后端重构方案](./docs/architecture/backend-architecture-redesign.md)
3. 在 `apps/api` 重建主业务后端
4. 在 `apps/ai-runtime` 落知识、记忆、检索和 agent runtime
5. 在 `apps/mcp-gateway` 对外暴露 MCP resource/tool/context

## 当前仓库状态

- `apps/api` 是当前主业务后端主线，接口和测试最完整
- `apps/worker` 已具备轮询执行后台任务和调用 `apps/ai-runtime` CLI 的能力
- `apps/mcp-gateway` 承担面向 AI Agent 的 resource/tool/context 聚合
- `apps/frontend` 已具备项目列表、项目详情、清单、汇总、审核、过程单据、任务状态和工作台待办页面
- 当前仓库已完成 Sprint 1 底座、API 契约生成、MCP Gateway 主能力联调和后台 worker 基础闭环，本地开发建议优先走 `database mode`

## 本地环境

建议先准备以下运行时：

- Node.js 22+ 与 npm 11+
- Python 3.11+
- Docker / Docker Compose

开发依赖服务可以用下面的命令启动：

```bash
docker compose -f deploy/docker/docker-compose.dev.yml up -d --wait
npm run dev:deps:up
make dev-deps-up
```

当前会拉起：

- PostgreSQL 16：`localhost:5432`
- Redis 7：`localhost:6379`

## 常用命令

安装 Node workspace 依赖：

```bash
npm install
```

运行整仓测试：

```bash
npm test
```

运行整仓类型检查：

```bash
npm run typecheck
```

更新当前已实现 API 路由清单：

```bash
npm run docs:api
npm run docs:api-routes
npm run docs:openapi-current
```

API 持久化脚手架命令：

```bash
npm --workspace @saas-pricing/api run db:generate
npm --workspace @saas-pricing/api run db:migrate
npm --workspace @saas-pricing/api run db:push
npm --workspace @saas-pricing/api run test:live-db
npm run api:test:live-db
npm run dev:smoke:live-db
make api-live-db
```

推荐的本地数据库连接串：

```bash
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/saas_pricing
```

推荐的本地开发环境变量：

```bash
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/saas_pricing
export JWT_SECRET=1234567890abcdef
export API_BASE_URL=http://localhost:3000
export WORKER_TOKEN=dev-worker-token
export LLM_API_KEY=your-provider-key
export LLM_MODEL=your-model-name
export LLM_BASE_URL=https://api.openai.com/v1
```

只跑某个 workspace 的测试：

```bash
npm --workspace @saas-pricing/api test
npm --workspace @saas-pricing/mcp-gateway test
npm --workspace @saas-pricing/worker test
pytest apps/ai-runtime/tests
```

推荐的 API 开发服务启动方式（默认走 database mode）：

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/saas_pricing \
JWT_SECRET=1234567890abcdef \
API_PORT=3000 \
npm --workspace @saas-pricing/api run start
```

显式声明 database mode：

```bash
APP_STORAGE_MODE=database \
DATABASE_URL=postgres://postgres:postgres@localhost:5432/saas_pricing \
JWT_SECRET=1234567890abcdef \
API_PORT=3000 \
npm --workspace @saas-pricing/api run start
```

只在需要纯内存 smoke 时才显式切回 memory mode：

```bash
APP_STORAGE_MODE=memory \
JWT_SECRET=1234567890abcdef \
API_PORT=3000 \
npm --workspace @saas-pricing/api run start
```

运行 MCP Gateway：

```bash
JWT_SECRET=1234567890abcdef \
API_BASE_URL=http://localhost:3000 \
MCP_GATEWAY_PORT=3100 \
npm --workspace @saas-pricing/mcp-gateway run start
```

运行 worker CLI：

```bash
API_BASE_URL=http://localhost:3000 \
WORKER_TOKEN=dev-worker-token \
POLL_INTERVAL_MS=1000 \
npm --workspace @saas-pricing/worker run start
```

运行 frontend 工作台：

```bash
VITE_API_BASE_URL=http://localhost:3000 \
VITE_API_BEARER_TOKEN="<your bearer token>" \
npm --workspace saas-pricing-frontend run dev
```

说明：

- `VITE_API_BASE_URL` 和 `VITE_API_BEARER_TOKEN` 仍然可作为默认值传入
- frontend 侧边栏现在提供了开发连接面板，可把 API 地址和 Bearer Token 保存到浏览器本地存储，减少反复重启和手工拼环境变量

推荐的本地联调启动顺序：

1. `docker compose -f deploy/docker/docker-compose.dev.yml up -d --wait`
2. `DATABASE_URL=... JWT_SECRET=... npm --workspace @saas-pricing/api run start`
3. `JWT_SECRET=... API_BASE_URL=http://localhost:3000 npm --workspace @saas-pricing/mcp-gateway run start`
4. `API_BASE_URL=http://localhost:3000 WORKER_TOKEN=... npm --workspace @saas-pricing/worker run start`
5. `VITE_API_BASE_URL=http://localhost:3000 VITE_API_BEARER_TOKEN=... npm --workspace saas-pricing-frontend run dev`

真实 Postgres smoke：

```bash
docker compose -f deploy/docker/docker-compose.dev.yml up -d --wait
DATABASE_URL=postgres://postgres:postgres@localhost:5432/saas_pricing \
npm --workspace @saas-pricing/api run test:live-db
```

更短的等价命令：

```bash
npm run dev:smoke:live-db
make dev-deps-up
make api-live-db
```

说明：

- `apps/api` 现在提供了最小 `start` 脚本；配置 `DATABASE_URL` 后会自动进入 `database mode`
- 可用 `APP_STORAGE_MODE=memory|database` 显式选择运行模式；当指定 `database` 时必须同时提供 `DATABASE_URL`
- `database mode` 现在要求完整的数据库仓储与事务装配，不再允许静默回退到 `InMemory*Repository`
- `apps/mcp-gateway` 现在也提供了最小 `start` 脚本，依赖 `API_BASE_URL` 指向业务 API
- `apps/frontend` 现在提供了最小 React + Vite 工作台骨架，首版页面覆盖项目列表、项目详情、清单页和汇总页
- frontend 当前直接请求 `apps/api`，可通过 `VITE_API_BEARER_TOKEN` 或侧边栏开发连接面板提供 Bearer Token
- `apps/ai-runtime` 当前通过 [apps/ai-runtime/app/cli.py](./apps/ai-runtime/app/cli.py) 提供结构化输入输出能力
- 旧 Java 原型代码已从仓库移除，历史结论保留在架构文档中；当前主线只维护 TypeScript/Python 工作区
