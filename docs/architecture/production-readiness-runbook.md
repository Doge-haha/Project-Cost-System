# 新点 SaaS 造价系统试运行运维手册

## 1. 发布准入

每个发布候选进入试运行前必须通过：

```bash
npm run typecheck
npm run test
npm run docs:api
npm run docs:openspec
npm run dev:smoke:live-db
```

`npm run dev:smoke:live-db` 依赖 Docker daemon、PostgreSQL 和 Redis。若 Docker 未启动，失败属于本地环境阻塞，不按代码回归处理。

## 2. 关键环境变量

### API

| 变量 | 用途 |
|------|------|
| `APP_STORAGE_MODE` | `database` 或 `memory`，试运行使用 `database` |
| `DATABASE_URL` | PostgreSQL 连接串 |
| `JWT_SECRET` | API JWT 签名密钥 |
| `API_HOST` | API 监听地址 |
| `API_PORT` | API 监听端口 |

### Worker

| 变量 | 用途 |
|------|------|
| `API_BASE_URL` | API 地址 |
| `WORKER_TOKEN` | Worker 调用平台接口的系统 token |
| `AI_RUNTIME_PYTHON` | AI Runtime Python 可执行文件 |
| `AI_RUNTIME_CLI_PATH` | AI Runtime CLI 路径 |
| `POLL_INTERVAL_MS` | 轮询间隔 |
| `MAX_ITERATIONS` | 本地 smoke 时限制轮询次数 |

### AI Provider

| 变量 | 用途 |
|------|------|
| `LLM_API_KEY` | OpenAI-compatible Provider key |
| `LLM_MODEL` | 模型名称 |
| `LLM_BASE_URL` | Provider base URL |
| `LLM_TIMEOUT_SECONDS` | Provider 调用超时 |
| `LLM_MAX_RETRIES` | Provider 重试次数 |

### MCP Gateway

| 变量 | 用途 |
|------|------|
| `JWT_SECRET` | 与 API 保持一致的 JWT 签名密钥 |
| `API_BASE_URL` | API 地址 |
| `MCP_GATEWAY_HOST` | MCP Gateway 监听地址 |
| `MCP_GATEWAY_PORT` | MCP Gateway 监听端口 |

## 3. 启停顺序

本地试运行推荐顺序：

```bash
npm run dev:deps:up

APP_STORAGE_MODE=database \
DATABASE_URL=postgres://postgres:postgres@localhost:5432/saas_pricing \
JWT_SECRET=1234567890abcdef \
API_PORT=3000 \
npm --workspace @saas-pricing/api run start

API_BASE_URL=http://localhost:3000 \
WORKER_TOKEN=dev-worker-token \
npm --workspace @saas-pricing/worker run start

JWT_SECRET=1234567890abcdef \
API_BASE_URL=http://localhost:3000 \
MCP_GATEWAY_PORT=3100 \
npm --workspace @saas-pricing/mcp-gateway run start
```

停止依赖服务：

```bash
npm run dev:deps:down
```

## 4. 健康检查

| 组件 | 检查入口 | 说明 |
|------|----------|------|
| API | `GET /health` | API 进程状态 |
| AI Provider | `GET /v1/ai/provider-health` | Provider 配置和连通性 |
| Provider telemetry | `GET /v1/projects/:projectId/ai/provider-telemetry` | Provider job 失败、延迟、重试告警 |
| Worker | `GET /v1/jobs?projectId=...` | 通过任务状态和 job type 统计观察 Worker 执行 |
| MCP Gateway | `GET /health` | Gateway 进程状态 |
| Runtime diagnostics | `GET /v1/resources/runtime-diagnostics?projectId=...` | MCP 聚合 API、Worker job、Provider 和 Gateway 状态 |

## 5. 常见故障

| 现象 | 判断方式 | 处理 |
|------|----------|------|
| Docker 未启动 | `Cannot connect to the Docker daemon` | 启动 Docker 后复跑 `npm run dev:smoke:live-db` |
| 数据库连接失败 | API 启动或 live smoke 报 `DATABASE_URL`/连接错误 | 检查 `DATABASE_URL`、Postgres 容器健康状态和端口 |
| Provider 未配置 | `/v1/ai/provider-health` 返回 `configured: false` | 配置 `LLM_API_KEY`、`LLM_MODEL`、`LLM_BASE_URL` |
| Provider 调用失败 | AI recommendation job failed，telemetry consecutive failure 增长 | 检查 Provider 网络、鉴权、限流和超时 |
| Provider 返回非法 | 错误码 `AI_PROVIDER_RESPONSE_INVALID` | 检查模型输出 JSON 和推荐 schema |
| OpenAPI 未同步 | `npm run test:workspace` 里 OpenAPI/route 文档测试失败 | 运行 `npm run docs:api` 后复测 |
| 报表导出失败 | report export task `failed` 且 job `failed` | 查看 `/v1/reports/export/:taskId`、`/v1/jobs/:jobId` 和审计日志 |

## 6. 迁移审查

迁移发布前检查：

1. `apps/api/drizzle/*.sql` 与 `apps/api/drizzle/meta/*_snapshot.json` 成对更新。
2. 新表需要主键、`created_at`/`updated_at` 或明确原因。
3. 高频筛选字段需要索引。
4. 核心业务表不使用危险级联删除。
5. 发布前先在测试库跑 `npm run dev:smoke:live-db`。

当前迁移不提供自动回滚脚本。若试运行迁移失败，优先恢复数据库备份或回滚到迁移前快照，再重新执行修正后的迁移。
