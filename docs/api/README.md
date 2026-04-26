# API 契约文档

当前以代码注册的 `/v1` 路由为准。

## 当前文件

- `implemented-v1-routes.md`
  - 当前已实现 `/v1` 路由清单
  - 由 `npm run docs:api-routes` 生成
- `openapi-v1.yaml`
  - 当前 `/v1` 最小 OpenAPI 契约
  - 由 `npm run docs:openapi-current` 生成
- `openapi-v1-current.yaml`
  - 当前 `/v1` 最小 OpenAPI 契约兼容副本
  - 由 `npm run docs:openapi-current` 同步生成
- `openapi-v1-legacy.yaml`
  - 历史 `/api/v1` 草案
  - 仅归档，不作为当前实现依据

## 常用命令

```bash
npm run docs:api
npm run test:workspace
```

## 质量门

`tests/api-routes-doc.test.mjs` 会校验：

- 已注册 Fastify `/v1` routes 与 `implemented-v1-routes.md` 一致
- `implemented-v1-routes.md` 由脚本生成且无漂移
- `openapi-v1.yaml` 由脚本生成且路径与代码一致
- `openapi-v1-current.yaml` 与 `openapi-v1.yaml` 保持一致
- `openapi-v1.yaml` 的 method 与代码注册路由一致
- `openapi-v1.yaml` 的 path 参数与代码注册路由一致
- 当前 OpenAPI 包含 tags、operationId、query 参数、响应码、错误 schema、下载 content-type
- 历史 `openapi-v1-legacy.yaml` 未混入当前 `/v1` 路径
