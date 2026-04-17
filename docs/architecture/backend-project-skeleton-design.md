# 新点 SaaS 造价系统后端工程骨架设计

> 基于 [technical-architecture-and-platform-selection.md](/Users/huahaha/Documents/New%20project/docs/architecture/technical-architecture-and-platform-selection.md)、[data-model.md](/Users/huahaha/Documents/New%20project/docs/architecture/data-model.md)、[workflow-and-form-engine-design.md](/Users/huahaha/Documents/New%20project/docs/architecture/workflow-and-form-engine-design.md)、[mcp-capability-design.md](/Users/huahaha/Documents/New%20project/docs/architecture/mcp-capability-design.md) 与 [knowledge-and-memory-architecture.md](/Users/huahaha/Documents/New%20project/docs/architecture/knowledge-and-memory-architecture.md) 整理。

## 1. 文档目标

这份文档解决的不是“功能做什么”，而是“后端工程第一天应该怎么搭”。

它主要回答 6 个问题：

- 仓库采用什么目录组织方式
- 后端主应用、异步 Worker、MCP 能力层怎么拆
- Java 包结构怎么定
- 数据库迁移、配置、测试目录怎么定
- 流程引擎、知识层、记忆层放在哪
- 哪些边界必须现在就定死，避免后面返工

## 2. 总体结论

推荐采用：

- `单仓多目录`
- `apps/backend + apps/frontend + apps/worker + apps/mcp-gateway + docs + deploy`
- 后端内部采用 `模块化单体`
- 异步任务单独进程运行，但与后端共享领域模块和数据库模型
- `MCP` 不直接查库，而是通过聚合服务读取业务上下文

这意味着：

- `backend` 负责正式业务 API、权限、状态机、流程绑定和核心写操作
- `worker` 负责报表导出、AI 推荐任务、知识抽取等异步任务
- `mcp-gateway` 负责给 AI Agent 暴露高层资源、工具和上下文

## 3. 仓库目录建议

推荐从现在开始，把仓库整理成下面这个形态：

```text
New project/
├── apps/
│   ├── backend/
│   ├── worker/
│   ├── mcp-gateway/
│   └── frontend/
├── docs/
│   ├── api/
│   ├── architecture/
│   └── superpowers/
├── deploy/
│   ├── docker/
│   ├── k8s/
│   └── scripts/
├── .editorconfig
├── .gitignore
├── README.md
└── Makefile
```

### 3.1 每个顶层目录职责

- `apps/backend`
  正式业务后端，负责 REST API、流程绑定、权限校验、状态流转和正式写入。

- `apps/worker`
  异步任务进程，负责导出、重算、AI 推荐任务、知识/记忆抽取等。

- `apps/mcp-gateway`
  面向 AI Agent 的能力入口，负责资源聚合、工具封装、上下文裁剪。

- `apps/frontend`
  React 前端应用。

- `docs`
  保留当前全部设计、架构、计划和导入文档。

- `deploy`
  部署清单、Compose、K8s 和初始化脚本。

## 4. 后端应用拆分建议

## 4.1 backend

`backend` 是系统事实来源，必须拥有：

- 项目、阶段、成员、权限
- 清单、版本链、工作内容
- 定额、价目、取费、计价引擎
- 审核、汇总、报表任务提交
- 流程绑定与表单提交
- 知识、记忆、技能定义的正式存储接口

不建议把这些主链拆成多个服务。

## 4.2 worker

`worker` 负责：

- 报表异步导出
- 批量重算
- AI 推荐任务执行
- 偏差预警重算
- 复盘结论抽取
- 驳回原因标签化
- 记忆写入异步任务

`worker` 应复用 `backend` 的领域对象和仓储接口，不应自建第二套模型。

## 4.3 mcp-gateway

`mcp-gateway` 负责：

- `get_project_context`
- `get_stage_context`
- `get_bill_version_context`
- `get_bill_item_context`
- `search_knowledge_entries`
- `search_historical_cases`
- `list_pending_work_items`

它的原则必须写死：

- 不直接访问数据库表
- 不绕过业务权限
- 不直接承接正式写操作

V1 只做读和上下文聚合预留。

## 5. backend 内部目录建议

推荐 `Spring Boot 3 + Java 21` 下，按“平台能力 + 领域模块”组织：

```text
apps/backend/
├── build.gradle.kts
├── settings.gradle.kts
├── src/
│   ├── main/
│   │   ├── java/com/xindian/saaspricing/
│   │   │   ├── bootstrap/
│   │   │   ├── common/
│   │   │   ├── auth/
│   │   │   ├── project/
│   │   │   ├── discipline/
│   │   │   ├── bill/
│   │   │   ├── quota/
│   │   │   ├── pricing/
│   │   │   ├── review/
│   │   │   ├── report/
│   │   │   ├── workflow/
│   │   │   ├── ai/
│   │   │   ├── knowledge/
│   │   │   ├── memory/
│   │   │   ├── audit/
│   │   │   ├── mcpcontext/
│   │   │   └── infrastructure/
│   │   └── resources/
│   │       ├── application.yml
│   │       ├── application-dev.yml
│   │       ├── application-test.yml
│   │       ├── application-prod.yml
│   │       ├── db/migration/
│   │       └── flowable/
│   └── test/
│       ├── java/com/xindian/saaspricing/
│       └── resources/
└── README.md
```

## 6. Java 包职责建议

## 6.1 平台能力包

- `bootstrap`
  Spring Boot 启动类、全局配置装配。

- `common`
  通用响应结构、异常基类、时间工具、基础枚举。

- `infrastructure`
  MyBatis/JPA 配置、Redis、对象存储、外部 Provider 适配器。

- `auth`
  JWT、鉴权过滤器、项目成员权限守卫、角色判断。

- `audit`
  审计日志写入、审计动作枚举、审计上下文。

- `mcpcontext`
  给 `mcp-gateway` 复用的上下文聚合服务，不直接暴露 HTTP 接口。

## 6.2 业务领域包

- `project`
  项目、阶段、成员、阶段工作台。

- `discipline`
  专业、定额集、项目专业配置、源系统专业映射。

- `bill`
  清单版本、清单项、工作内容、版本来源链、锁定规则。

- `quota`
  定额明细、定额选择器、价目版本、取费模板。

- `pricing`
  计价引擎、批量重算、人工调价、偏差分析基础。

- `review`
  审核流、提交、通过、驳回、撤回、状态联动。

- `report`
  汇总查询、导出任务、报表文件记录。

- `workflow`
  Flowable 流程绑定、表单定义、表单提交、任务回调。

- `ai`
  AI 推荐、偏差预警、Provider 适配、推荐状态机。

- `knowledge`
  `knowledge_entry`、`knowledge_relation`、知识搜索和知识写入。

- `memory`
  `memory_entry`、用户/项目/组织偏好、反馈记忆。

## 7. 单模块内部结构建议

每个业务模块尽量保持统一结构：

```text
project/
├── controller/
├── service/
├── domain/
├── repository/
├── dto/
├── entity/
├── mapper/
└── enums/
```

边界约束建议固定为：

- `controller`
  只做参数接收、权限注解和响应组装。

- `service`
  只编排用例，不直接写 SQL。

- `domain`
  放状态流转、业务规则、验证逻辑。

- `repository / mapper`
  放数据访问。

- `dto`
  放请求响应对象。

- `entity`
  放表映射对象。

如果模块很小，可以先不拆 `domain`，但 `service` 和 `repository` 不要混。

## 8. 数据库迁移组织建议

迁移建议统一采用：

- `Flyway`
- 所有正式表迁移只放在 `apps/backend/src/main/resources/db/migration`

目录建议：

```text
db/migration/
├── V1__init_project_and_auth.sql
├── V2__init_discipline_and_standard_set.sql
├── V3__init_bill_and_work_item.sql
├── V4__init_quota_price_fee.sql
├── V5__init_review_report_audit.sql
├── V6__init_ai_and_recommendation.sql
└── V7__init_knowledge_memory_and_skill.sql
```

原则：

- 一个迁移文件对齐一个阶段性主题
- 不要一个表一个文件，太碎
- 也不要把几十张表挤进一个文件，太重

## 9. 配置与环境建议

配置建议这样分：

- `application.yml`
  放统一默认值。

- `application-dev.yml`
  本地开发配置。

- `application-test.yml`
  集成测试和 CI 配置。

- `application-prod.yml`
  生产环境配置。

环境变量前缀建议统一：

- `DB_*`
- `REDIS_*`
- `S3_*`
- `JWT_*`
- `AI_*`
- `FLOWABLE_*`
- `MCP_*`

## 10. worker 工程骨架建议

`apps/worker` 建议仍然使用 `Spring Boot`，但只加载异步任务必需模块。

推荐目录：

```text
apps/worker/
├── src/main/java/com/xindian/saaspricing/worker/
│   ├── bootstrap/
│   ├── jobs/
│   ├── ai/
│   ├── report/
│   ├── knowledge/
│   └── infrastructure/
└── src/main/resources/
```

任务类型建议至少预留：

- `report_export_job`
- `pricing_recalculate_job`
- `ai_bill_recommendation_job`
- `ai_quota_recommendation_job`
- `variance_warning_job`
- `knowledge_extract_job`
- `memory_update_job`

## 11. mcp-gateway 工程骨架建议

`apps/mcp-gateway` 可以先做一个轻量 Spring Boot 应用，后续再视需要独立部署。

推荐目录：

```text
apps/mcp-gateway/
├── src/main/java/com/xindian/saaspricing/mcp/
│   ├── bootstrap/
│   ├── resources/
│   ├── tools/
│   ├── service/
│   ├── dto/
│   └── security/
└── src/main/resources/
```

建议按 `resource` 和 `tool` 分目录，而不是按业务模块分。

原因是：

- MCP 面向的是 AI 使用方式
- REST 面向的是业务系统使用方式
- 两者组织方式不应该强行完全一致

## 12. 流程与表单引擎接入位置

Flowable 不建议单独先拆服务。

V1 推荐：

- Flowable 集成在 `backend`
- 流程定义文件放在 `resources/flowable`
- `workflow` 模块负责业务绑定
- 表单 schema 保存在数据库里

职责边界：

- Flowable 管流程状态和任务流转
- `workflow` 模块负责把流程实例映射到业务资源
- 业务模块负责最终正式数据写入

## 13. AI 原生扩展落位建议

这一块必须现在就预留，不然后续一定返工。

## 13.1 backend

在 `backend` 内预留：

- `knowledge`
- `memory`
- `mcpcontext`
- `ai`

## 13.2 worker

在 `worker` 内预留：

- 知识抽取任务
- 记忆更新任务
- AI 推荐任务

## 13.3 mcp-gateway

在 `mcp-gateway` 内预留：

- 项目上下文资源
- 阶段上下文资源
- 清单版本上下文资源
- 知识搜索工具
- 待办查询工具

## 14. 测试目录建议

推荐测试分成三层：

- `unit`
  领域规则、状态机、校验逻辑。

- `integration`
  Controller + Service + Repository + DB。

- `contract`
  OpenAPI 契约和错误码回归。

如果首版人力不足，最少也要保证：

- 状态机单测
- 权限集成测试
- 主链接口集成测试

## 15. 启动时最先创建的文件

如果准备真正搭工程，建议第一批先创建这些文件：

- `apps/backend/build.gradle.kts`
- `apps/backend/src/main/java/com/xindian/saaspricing/bootstrap/SaasPricingApplication.java`
- `apps/backend/src/main/resources/application.yml`
- `apps/backend/src/main/resources/db/migration/V1__init_project_and_auth.sql`
- `apps/worker/build.gradle.kts`
- `apps/mcp-gateway/build.gradle.kts`
- `apps/frontend/package.json`
- `deploy/docker/docker-compose.dev.yml`
- `README.md`
- `Makefile`

## 16. 当前不建议做的事

- 一上来拆微服务
- 为每个业务模块单独建独立仓库
- 让 `MCP` 层直接写正式业务表
- 让 `worker` 自己维护第二套数据库模型
- 先上图数据库再做知识条目表
- 先做通用 skill runtime 再做业务主链

## 17. 一句话结论

当前最稳的工程落地方式，是以 `apps/backend` 为事实主链，以 `apps/worker` 承接异步任务，以 `apps/mcp-gateway` 预留 AI 能力出口，在单仓多目录下把业务主链和 AI 原生扩展一起铺好骨架。
