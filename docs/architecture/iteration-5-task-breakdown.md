# 新点 SaaS 造价系统 Iteration 5 任务拆分

> 基于 [2026-04-16-saas-pricing-v1-implementation.md](/Users/huahaha/Documents/New%20project/docs/superpowers/plans/2026-04-16-saas-pricing-v1-implementation.md)、[data-model.md](/Users/huahaha/Documents/New%20project/docs/architecture/data-model.md)、[state-machines.md](/Users/huahaha/Documents/New%20project/docs/architecture/state-machines.md)、[permission-matrix.md](/Users/huahaha/Documents/New%20project/docs/architecture/permission-matrix.md) 与 [openapi-v1.yaml](/Users/huahaha/Documents/New%20project/docs/api/openapi-v1.yaml) 整理。

## 1. 迭代目标

Iteration 5 的目标，是把 AI 能力以“辅助推荐和预警”的方式接入主流程，而不是让 AI 直接改写正式业务数据。

本迭代重点覆盖：

- `ai_recommendation`
- AI 清单推荐
- AI 定额推荐
- AI 偏差预警
- 推荐接受/忽略/失效
- AI 结果缓存
- 人工确认与落库机制
- MCP 上下文能力预留
- 知识条目与系统记忆基础预留

本迭代明确不做：

- AI 自动执行正式写操作
- AI 自动生成合同基线
- AI 自动审批
- 自然语言造价问答
- 完整图数据库平台
- 通用技能运行时平台

## 2. 交付范围

### 2.1 后端交付

- `ai_recommendation`
- `knowledge_entry`
- `memory_entry`
- `skill_definition`
- `knowledge_relation`
- AI 推荐服务适配层
- AI 推荐缓存与状态管理
- AI 结果确认服务
- 偏差预警服务
- MCP 上下文聚合服务预留
- 知识与记忆抽取服务预留

### 2.2 前端交付

- AI 清单推荐面板
- AI 定额推荐面板
- 偏差预警提示区
- AI 推荐确认弹层
- 推荐历史查看区

### 2.3 测试交付

- AI 推荐状态机测试
- 推荐失效测试
- 人工确认落库测试
- 偏差预警阈值测试
- AI 失败降级测试
- 知识条目基础写入测试
- 项目记忆基础写入测试
- MCP 上下文读取抽样测试

## 3. 任务拆分

## 3.1 数据库与迁移

### 3.1.1 建表任务

- [ ] 创建 `ai_recommendation`
- [ ] 创建 `knowledge_entry`
- [ ] 创建 `memory_entry`
- [ ] 创建 `skill_definition`
- [ ] 创建 `knowledge_relation`

### 3.1.2 字段补齐

- [ ] `ai_recommendation` 加入 `project_id`
- [ ] `ai_recommendation` 加入 `resource_type`
- [ ] `ai_recommendation` 加入 `resource_id`
- [ ] `ai_recommendation` 加入 `recommendation_type`
- [ ] `ai_recommendation` 加入 `input_payload`
- [ ] `ai_recommendation` 加入 `output_payload`
- [ ] `ai_recommendation` 加入 `status`
- [ ] `ai_recommendation` 加入 `created_by`
- [ ] `ai_recommendation` 加入 `created_at`

### 3.1.3 索引与约束

- [ ] 为 `ai_recommendation(project_id, resource_type, resource_id)` 建索引
- [ ] 为 `ai_recommendation(status, created_at desc)` 建索引
- [ ] 为 `ai_recommendation(recommendation_type, created_at desc)` 建索引
- [ ] 为 `knowledge_entry(knowledge_type, status, created_at desc)` 建索引
- [ ] 为 `memory_entry(memory_scope, scope_id, memory_type)` 建索引
- [ ] 为 `knowledge_relation(from_type, from_id)` 与 `knowledge_relation(to_type, to_id)` 建索引

验收标准：

- AI 推荐结果可独立存储
- 可按项目、资源和类型快速查询推荐记录
- 知识条目与系统记忆具备基础存储能力

## 3.2 枚举与常量

- [ ] 固化推荐类型枚举：`bill_recommendation`, `quota_recommendation`, `variance_warning`
- [ ] 固化推荐状态枚举：`generated`, `accepted`, `ignored`, `expired`
- [ ] 固化 AI 任务失败错误码分类
- [ ] 固化 AI 来源标识与模型标识字段约定
- [ ] 固化知识类型枚举
- [ ] 固化记忆作用域枚举

验收标准：

- 枚举值与 [state-machines.md](/Users/huahaha/Documents/New%20project/docs/architecture/state-machines.md) 和 [data-model.md](/Users/huahaha/Documents/New%20project/docs/architecture/data-model.md) 保持一致

## 3.3 AI 服务适配层

### 3.3.1 基础能力

- [ ] 封装 AI Provider 调用适配层
- [ ] 统一请求超时、重试和错误处理
- [ ] 统一记录请求上下文
- [ ] 统一记录响应摘要
- [ ] 统一预留 `ai_assist_trace_id`

### 3.3.2 输入准备

- [ ] 生成清单推荐输入上下文
- [ ] 生成定额推荐输入上下文
- [ ] 生成偏差预警输入上下文

验收标准：

- AI 服务异常不会阻断主业务流程
- AI 输入上下文可追溯

## 3.4 AI 清单推荐

### 3.4.1 场景

- [ ] 针对新建清单版本生成推荐清单项
- [ ] 针对上游引用版本补充候选清单项
- [ ] 针对缺失项做建议提示

### 3.4.2 接口建议

- [ ] 增加 `POST /api/v1/ai/bill-recommendations`
- [ ] 增加 `GET /api/v1/projects/{id}/ai/bill-recommendations`

### 3.4.3 落库规则

- [ ] 生成推荐后写入 `ai_recommendation`
- [ ] 推荐结果默认进入 `generated`
- [ ] 不直接写入正式 `bill_item`

验收标准：

- 可生成清单推荐结果
- 用户确认前不会改写正式清单

## 3.5 AI 定额推荐

### 3.5.1 场景

- [ ] 针对清单项推荐候选定额
- [ ] 针对已有定额补充替代方案
- [ ] 针对缺失定额做提示
- [x] 接入只读参考定额知识库，补充地区定额、工作内容和资源组成依据
- [x] 候选定额返回来源库、地区、匹配说明、工作内容摘要和资源组成摘要

### 3.5.2 接口建议

- [ ] 增加 `POST /api/v1/ai/quota-recommendations`
- [ ] 增加 `GET /api/v1/projects/{id}/ai/quota-recommendations`

### 3.5.3 落库规则

- [ ] 推荐结果写入 `ai_recommendation`
- [ ] 结果按资源关联到 `bill_item` 或 `quota_line`
- [ ] 不直接写入正式 `quota_line`

验收标准：

- 可对清单项生成定额推荐
- 用户确认前不会改写正式定额
- 候选定额具备可解释来源和费用组成摘要

### 3.5.4 参考定额知识库切片

- [x] 候选定额 API 合同预留 `sourceDataset`、`sourceRegion`、`workContentSummary`、`resourceCompositionSummary`、`matchReason`、`matchScore`
- [x] 清单页定额选择器展示候选来源、匹配说明和费用组成
- [x] 增加 `reference_quota` 只读参考定额表、仓储和数据库迁移
- [x] 将 `/Users/huahaha/WorkSpace/OpenConstructionEstimate-DDC-CWICR/data/ZH_SHANGHAI.csv` 离线清洗为只读参考定额表导入 SQL
- [x] 将参考库候选与现有关键字候选合并排序
- [x] 将 embeddings snapshot 挂接到 AI Runtime 语义召回适配层
- [x] 将语义召回结果纳入候选合并排序接口契约
- [x] 部署 Qdrant collection 后切换为真实向量近邻查询

## 3.6 偏差预警

### 3.6.1 场景

- [ ] 系统值与最终值偏差超阈值预警
- [ ] 当前版本与上游版本偏差超阈值预警
- [ ] 专业级偏差超阈值预警
- [ ] 单体级偏差超阈值预警

### 3.6.2 接口建议

- [ ] 增加 `POST /api/v1/ai/variance-warnings`
- [ ] 增加 `GET /api/v1/projects/{id}/ai/variance-warnings`

### 3.6.3 规则

- [ ] 支持项目级阈值配置
- [ ] 支持阶段级阈值配置
- [ ] 预警结果写入 `ai_recommendation`
- [ ] 汇总页展示高优先级预警

验收标准：

- 可在汇总页查看偏差预警
- 阈值变化后可重新生成预警

## 3.7 人工确认机制

### 3.7.1 状态流转

- [ ] `generated -> accepted`
- [ ] `generated -> ignored`
- [ ] `generated -> expired`

### 3.7.2 接口建议

- [ ] 增加 `POST /api/v1/ai/recommendations/{id}/accept`
- [ ] 增加 `POST /api/v1/ai/recommendations/{id}/ignore`

### 3.7.3 落库规则

- [ ] 接受清单推荐时由人工确认后写入正式 `bill_item`
- [ ] 接受定额推荐时由人工确认后写入正式 `quota_line`
- [ ] 忽略推荐时仅更新 AI 记录状态
- [ ] 接受动作写审计日志

验收标准：

- 用户可接受或忽略推荐
- 接受动作会落正式数据并留下审计记录

## 3.8 推荐失效机制

- [ ] 上游清单版本变化时，旧清单推荐进入 `expired`
- [ ] 定额上下文变化时，旧定额推荐进入 `expired`
- [ ] 价目版本变化时，相关偏差预警可重算
- [ ] 阶段切换后，非当前阶段旧推荐可标记失效

验收标准：

- 旧推荐不会持续误导用户
- 推荐失效可被查询和展示

## 3.9 权限与页面控制

- [ ] 实现 AI 推荐查看权限
- [ ] 实现 AI 推荐接受权限
- [ ] 实现 AI 推荐忽略权限
- [ ] 实现偏差预警查看权限
- [ ] 实现推荐面板按钮显隐规则

验收标准：

- `cost_engineer` 可查看并处理推荐
- `reviewer` 可查看推荐结果但不能直接接受写入
- 无 AI 权限用户不展示推荐入口

## 3.10 审计与追溯

- [ ] AI 推荐生成写审计日志
- [ ] AI 推荐接受写审计日志
- [ ] AI 推荐忽略写审计日志
- [ ] AI 推荐失效写审计日志
- [ ] 保留 AI 输入输出摘要
- [ ] 为知识条目生成写审计日志预留动作
- [ ] 为记忆更新写审计日志预留动作

验收标准：

- 任意一条推荐都可追溯到来源、状态和处理结果

## 3.11 MCP 能力预留

### 3.11.1 资源上下文

- [ ] 预留 `get_project_context`
- [ ] 预留 `get_stage_context`
- [ ] 预留 `get_bill_version_context`
- [ ] 预留 `search_knowledge_entries`

### 3.11.2 聚合能力

- [ ] 项目级上下文聚合项目、阶段、专业、风险摘要
- [ ] 阶段级上下文聚合当前主清单版本和待审摘要
- [ ] 推荐上下文可挂接知识提示与记忆提示

验收标准：

- MCP 上下文能力不绕过业务服务直接查库
- 返回结果继续受项目权限、阶段权限和资源权限裁剪

## 3.12 知识与记忆预留

### 3.12.1 知识沉淀

- [ ] 为项目复盘结论写入 `knowledge_entry` 预留服务
- [ ] 为审核驳回原因标签化预留存储结构
- [ ] 为推荐反馈结果预留知识沉淀入口

### 3.12.2 记忆沉淀

- [ ] 为项目偏好写入 `memory_entry` 预留服务
- [ ] 为组织偏好写入 `memory_entry` 预留服务
- [ ] 为 AI 运行反馈写入 `memory_entry` 预留服务

验收标准：

- 至少一类复盘结论可落知识条目
- 至少一类项目或组织偏好可落记忆条目

当前进度：

- [x] AI Runtime 已新增 OpenAI-compatible LLM Provider 适配器
- [x] Worker Client 已支持 `llm_chat` 与 `reference_quota_semantic_search` 两类 AI Runtime 任务
- [x] LLM Provider 支持环境变量与任务入参两种配置方式
- [x] LLM Provider、Qdrant 语义检索和 CLI 任务路由已补充测试

## 3.13 前端联动建议

- [x] 推荐面板按资源类型分区展示
- [ ] 偏差预警在汇总页顶部高亮
- [x] 推荐卡片展示“来源、理由、建议内容、状态”
- [x] 接受前弹出确认框
- [x] 已失效推荐显示明显状态标记

前端最少展示字段：

- `recommendationType`
- `resourceType`
- `resourceId`
- `status`
- `createdAt`
- `createdBy`
- `outputPayload`

## 4. 建议排期

### Day 1-2

- 建表迁移
- AI 服务适配层
- 推荐状态管理
- 知识与记忆基础表预留

### Day 3-4

- 清单推荐
- 定额推荐
- MCP 上下文聚合预留

### Day 5-6

- 偏差预警
- 人工确认机制
- 推荐失效机制
- 复盘知识沉淀预留
- 项目记忆写入预留

### Day 7

- 权限联调
- 集成测试
- 文档回写

## 5. 联调顺序

建议按下面顺序联调：

1. 生成清单推荐
2. 生成定额推荐
3. 查看偏差预警
4. 接受推荐
5. 忽略推荐
6. 修改上下文触发推荐失效
7. 读取项目级 MCP 上下文
8. 验证知识条目与记忆条目基础写入

## 6. 风险点

- 如果 AI 推荐直接写正式表，很容易破坏主业务可追溯性
- 如果没有推荐失效机制，旧版本上下文下的建议会长期污染页面
- 如果 AI 失败直接抛错给主流程，会影响正常业务操作
- 如果接受推荐不写审计日志，后面很难解释“这条数据是谁加的”
- 如果 Iteration 5 完全不预留知识与记忆层，后面 AI 能力很难形成长期闭环
- 如果 MCP 上下文仍停留在 REST API 粒度，AI 工具接入成本会持续偏高

## 7. 完成标准

Iteration 5 完成时，至少满足以下结果：

- 可生成 AI 清单推荐
- 可生成 AI 定额推荐
- 可生成偏差预警
- 用户可接受、忽略、查看推荐
- 推荐上下文变化后可自动失效
- AI 结果始终不会直接覆盖正式业务数据
- 知识条目与系统记忆具备基础落库能力
- MCP 至少具备项目级上下文和知识搜索预留能力
