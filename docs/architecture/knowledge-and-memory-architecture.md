# 新点 SaaS 造价系统知识库与系统记忆架构设计

> 基于 [ai-native-architecture-review.md](/Users/huahaha/Documents/New%20project/docs/architecture/ai-native-architecture-review.md)、[mcp-capability-design.md](/Users/huahaha/Documents/New%20project/docs/architecture/mcp-capability-design.md)、[data-model.md](/Users/huahaha/Documents/New%20project/docs/architecture/data-model.md) 与 [workflow-and-form-engine-design.md](/Users/huahaha/Documents/New%20project/docs/architecture/workflow-and-form-engine-design.md) 展开。

## 1. 文档目标

这份文档用于把“知识沉淀层 + 系统记忆层”正式设计出来。

它重点回答：

- 哪些业务数据应该沉淀成知识
- 哪些行为与偏好应该沉淀成记忆
- 知识和记忆的边界是什么
- 如何从审计、审核、复盘、AI 推荐结果中抽取知识
- 如何让 MCP 和 skills 使用这些沉淀
- V1 最低应该落到什么程度

## 2. 总体定位

这个系统未来不应该只是：

- 有项目数据
- 有清单数据
- 有 AI 推荐

而应该逐步形成一套：

`业务数据库 + 审计链 + 知识库 + 记忆层 + MCP/Skills 调用层`

换句话说：

- 业务库回答“现在项目发生了什么”
- 审计链回答“当时是谁怎么做的”
- 知识库回答“历史上总结出了什么规律”
- 记忆层回答“当前用户/项目/组织习惯了什么”

## 3. 知识与记忆的边界

## 3.1 什么是知识

知识是：

- 可复用
- 可迁移
- 跨项目仍有价值
- 相对稳定

例如：

- 某类项目常见高偏差原因
- 某专业清单常用定额映射经验
- 某类变更单审核关注点
- 某地区常见取费处理规则
- 某类结算争议的判断依据

## 3.2 什么是记忆

记忆是：

- 与特定用户/项目/组织/流程强相关
- 会变化
- 未必对所有项目通用

例如：

- 某项目习惯先看施工过程差异
- 某审核员更关注税率与取费
- 某组织更偏好保守定额推荐
- 某用户常用某几个专业筛选方式

## 3.3 为什么要分开

如果把知识和记忆混在一起，会出现两个问题：

- 通用经验被局部偏好污染
- AI 无法区分“这是普适规律”还是“这是当前项目习惯”

所以必须明确：

- `knowledge = 稳定可迁移经验`
- `memory = 当前上下文下的偏好与历史痕迹`

## 4. 知识沉淀来源设计

建议把知识来源分成 5 类。

## 4.1 项目复盘来源

来源内容：

- 偏差分析结论
- 关键争议点
- 成本偏差原因
- 成功经验
- 失败经验

这是最重要的知识来源之一。

## 4.2 审核与驳回来源

来源内容：

- 驳回意见
- 审核说明
- 驳回原因标签
- 审核通过时的判断依据

这些内容很适合沉淀成：

- 审核知识条目
- 异常识别模式

## 4.3 AI 推荐结果来源

来源内容：

- 推荐是否被接受
- 推荐被忽略的原因
- 推荐失效的上下文
- 高命中率推荐模式

这些不是直接业务知识，但非常适合沉淀成：

- 技能优化知识
- 推荐偏好记忆

## 4.4 审计日志来源

来源内容：

- 高频修改模式
- 高频锁定/解锁原因
- 高风险阶段切换模式
- 重复出现的人工调整行为

适合沉淀成：

- 行为模式知识
- 项目记忆

## 4.5 基础规则来源

来源内容：

- 企业规则
- 标准指引
- 组织内部审核规范
- 定额适用说明

这是“文档型知识库”的重要来源。

## 5. 知识分层设计

建议把知识库分成两层。

## 5.1 文档型知识库

适合存：

- 复盘报告
- 审核规则说明
- 业务指引
- 导入说明
- 专业经验总结

特点：

- 更偏文本
- 更适合检索增强
- 更适合 AI 摘要与引用

## 5.2 结构化知识库

适合存：

- 偏差原因分类
- 驳回原因分类
- 典型案例标签
- 定额推荐规则模式
- 取费处理模式
- 清单异常模式

特点：

- 更偏结构化
- 更适合规则、搜索、统计和推理

## 6. 记忆分层设计

建议记忆至少分成 4 层。

## 6.1 用户记忆

记录：

- 常用专业
- 常用视图
- 常用筛选和列配置
- 常接受的 AI 推荐风格

作用：

- 提升个人体验
- 让 AI 回答更贴合该用户习惯

## 6.2 项目记忆

记录：

- 项目历史异常点
- 项目高频差异类型
- 常见驳回原因
- 项目已确认的处理口径

作用：

- 让 AI 不用每次重新理解项目背景

## 6.3 组织记忆

记录：

- 组织审核偏好
- 常用定额处理方式
- 常见审批标准
- 企业内部造价方法论

作用：

- 让 AI 输出更符合组织风格

## 6.4 AI 运行记忆

记录：

- 某类推荐的接受率
- 某类输入的错误率
- 某技能在哪些场景效果好
- 某知识条目最近命中频率

作用：

- 帮助 AI 服务自我优化

## 7. 数据模型建议

在现有模型基础上，建议未来补 4 类实体。

## 7.1 `knowledge_entry`

用于承接正式知识条目。

建议字段：

- `id`
- `knowledge_type`
- `title`
- `summary`
- `content_markdown`
- `content_json`
- `source_type`
- `source_id`
- `project_id`
- `stage_code`
- `discipline_code`
- `tags`
- `confidence_score`
- `status`
- `created_by`
- `created_at`
- `updated_at`

### `knowledge_type` 推荐值

- `retrospective_finding`
- `audit_rule`
- `variance_pattern`
- `quota_mapping_pattern`
- `pricing_rule`
- `review_guideline`

## 7.2 `memory_entry`

用于承接上下文记忆。

建议字段：

- `id`
- `memory_scope`
- `scope_id`
- `memory_type`
- `summary`
- `payload_json`
- `importance_score`
- `freshness_score`
- `last_used_at`
- `created_at`
- `updated_at`

### `memory_scope` 推荐值

- `user`
- `project`
- `organization`
- `ai_runtime`

## 7.3 `skill_definition`

用于登记系统内可复用业务技能。

建议字段：

- `id`
- `skill_code`
- `skill_name`
- `description`
- `input_schema`
- `output_schema`
- `prompt_template`
- `resource_dependencies_json`
- `default_knowledge_filters_json`
- `status`

## 7.4 `knowledge_relation`

用于表达轻量知识图谱关系。

建议字段：

- `id`
- `from_type`
- `from_id`
- `relation_type`
- `to_type`
- `to_id`
- `weight`
- `created_at`

### `relation_type` 例子

- `causes`
- `supports`
- `similar_to`
- `derived_from`
- `used_in`
- `approved_by_pattern`

## 8. 抽取与沉淀流程设计

## 8.1 复盘抽取 Pipeline

建议流程：

1. 项目进入复盘阶段
2. 系统聚合偏差、审计、审核、推荐结果
3. 生成复盘结构化摘要
4. 人工确认复盘结论
5. 生成 `knowledge_entry`
6. 更新相关 `memory_entry`

## 8.2 审核意见抽取 Pipeline

建议流程：

1. 收集审核意见与驳回意见
2. 做原因标签化
3. 聚合同类驳回模式
4. 生成审核知识条目

## 8.3 AI 推荐反馈抽取 Pipeline

建议流程：

1. 记录推荐生成
2. 记录接受/忽略/失效
3. 聚合接受率和失效原因
4. 更新运行记忆
5. 为 skills 优化提供输入

## 8.4 审计行为抽取 Pipeline

建议流程：

1. 聚合高频修改动作
2. 识别常见人工纠错路径
3. 识别高风险阶段和对象
4. 写入项目记忆或组织记忆

## 9. 检索与使用方式

## 9.1 MCP 如何使用知识与记忆

MCP 层建议提供：

- `search_knowledge_entries`
- `get_relevant_memory`
- `get_retrospective_context`

也就是说：

- 知识是可搜索的
- 记忆是按上下文召回的

## 9.2 Skills 如何使用知识与记忆

skills 执行时建议按顺序拿上下文：

1. 当前资源上下文
2. 项目记忆
3. 组织记忆
4. 相关知识条目
5. 历史案例

### 原则

- 先上下文
- 再记忆
- 再知识
- 最后才交给模型推理

## 9.3 前端如何使用知识与记忆

前端不一定直接展示所有知识条目，但可以展示：

- 相关经验提示
- 历史类似案例提示
- 当前项目记忆摘要
- 推荐解释来源

## 10. 轻量知识图谱建议

## 10.1 为什么 V1 不必直接上图数据库

虽然这个系统天然适合图谱，但 V1 直接上图数据库会增加：

- 存储复杂度
- 运维复杂度
- 同步复杂度

所以 V1 建议先采用：

- 关系库存图关系
- 需要时再投影为图

## 10.2 建议先表达的关系

至少先表达这些：

- 项目 -> 复盘结论
- 复盘结论 -> 偏差类型
- 偏差类型 -> 审核规则
- 清单项 -> 定额模式
- 审核意见 -> 驳回原因标签
- AI 推荐 -> 接受/忽略结果

## 11. V1 与 V1.1 边界

## 11.1 V1 建议必须落地

- `knowledge_entry`
- `memory_entry`
- 驳回原因标签化
- 复盘结论结构化
- MCP 可查询知识条目
- MCP 可按项目召回记忆

## 11.2 V1.1 再增强

- `knowledge_relation`
- `skill_definition`
- 接受率驱动的推荐优化
- 图谱推理
- RAG/Embedding 正式上线

## 12. 推荐实施顺序

建议按下面顺序推进：

1. 在数据模型中预留 `knowledge_entry`、`memory_entry`
2. 先接复盘结论结构化
3. 再接审核意见标签化
4. 再接 AI 推荐反馈沉淀
5. 最后把知识与记忆挂给 MCP 和 skills

## 13. 一句话结论

这个系统的知识库与系统记忆层，应该被设计成：

`把复盘、审核、审计和 AI 推荐结果持续抽取成可搜索的知识条目与可召回的上下文记忆，再通过 MCP 和 skills 反哺后续任务执行，让系统形成真正可持续增智的业务闭环。`

