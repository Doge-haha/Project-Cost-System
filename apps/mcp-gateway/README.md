# MCP Gateway

当前目录承载面向 AI Agent 的 TypeScript MCP 能力层。

职责：

- 暴露 `resource`
- 封装 `tool`
- 聚合 `project / stage / bill` 上下文
- 对 AI 会话做权限裁剪

当前阶段已接入业务 API，并覆盖主要 resource/tool 的注入式 e2e。

本地启动：

```bash
JWT_SECRET=1234567890abcdef \
API_BASE_URL=http://localhost:3000 \
MCP_GATEWAY_PORT=3100 \
npm --workspace @saas-pricing/mcp-gateway run start
```

依赖：

- 业务 API 需要先启动
- `API_BASE_URL` 需要指向可访问的 `apps/api`

验证：

```bash
npm --workspace @saas-pricing/mcp-gateway test
npm --workspace @saas-pricing/mcp-gateway run typecheck
```

已覆盖：

- `project-summary`
- `summary-details`
- `jobs-summary`
- `project-context`
- `job-status`
- `knowledge-extraction-history`
- `knowledge-extraction-result`
- `review-summary`
- `process-document-summary`
- `report-export-status`
- `import-failure-context`
- `recalculate-project`
- `export-summary-report`
- `extract-knowledge`
- `preview-knowledge-extraction`
- `extract-knowledge-from-audit`
- `retry-import-failure-scope`
- `decide-review`
- `update-process-document-status`
