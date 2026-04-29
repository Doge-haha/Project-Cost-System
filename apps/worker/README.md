# Worker

当前目录承载 TypeScript 异步任务进程。

职责：

- 接收后台任务契约
- 执行报表导出、批量重算等任务处理器
- 调用 `ai-runtime`
- 落 AI 推荐和知识抽取任务状态
- 后续对接队列、重试、死信和调度

当前阶段已落最小任务执行层和测试，后续再接真实队列适配器。

当前已经具备：

- 共享后台任务契约
- `job-runner` 任务分发
- `background-job-executor` 单任务执行器
- `background-job-queue` 队列抽象
- `queue-backed-worker` 单次 drain 入口
- `report_export` payload 透传 `reportTemplateId` 与 `outputFormat`
- 可独立回归的 worker 测试

本地启动：

```bash
API_BASE_URL=http://localhost:3000 \
WORKER_TOKEN=dev-worker-token \
POLL_INTERVAL_MS=1000 \
npm --workspace @saas-pricing/worker run start
```

可选环境变量：

- `MAX_ITERATIONS`：限制轮询次数，适合本地 smoke
- `AI_RUNTIME_PYTHON`：覆盖 Python 可执行文件
- `AI_RUNTIME_CLI_PATH`：覆盖 `apps/ai-runtime/app/cli.py` 路径
- `LLM_API_KEY`：AI Runtime 调用真实 OpenAI-compatible LLM Provider 的密钥
- `LLM_MODEL`：AI Runtime 调用的模型名称
- `LLM_BASE_URL`：AI Runtime Provider 地址，默认 `https://api.openai.com/v1`
- `LLM_PROVIDER`：Provider 标识，默认 `openai_compatible`
