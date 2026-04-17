# 新点 SaaS 造价系统 V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有详细设计文档基础上，收敛出可直接进入开发的 V1 范围、数据模型、状态机、权限边界、接口契约和迭代拆分，指导前后端并行实施。

**Architecture:** V1 采用“项目与阶段配置 + 清单版本链 + 定额/价目/取费计价引擎 + 汇总报表 + 审核流”的单体优先架构。业务主线以项目为根对象，阶段配置决定流程，清单和定额通过版本链串联，所有影响造价的数据变动都通过审计日志与过程单据追溯，并逐步为 MCP、skills、知识库与系统记忆预留 AI 原生扩展层。

**Tech Stack:** Web 前端、REST API、PostgreSQL、Redis、对象存储、异步任务队列、AI 推荐服务（V1 仅用于辅助推荐与预警），并预留 MCP 能力层、知识条目层与系统记忆层。

---

## 总体说明

当前设计文档覆盖多个可独立实施的子系统，不适合直接作为单条开发任务执行。V1 应先拆为以下 6 个可交付模块，每个模块单独可测试、可验收：

1. 项目管理与阶段配置
2. 清单与版本链
3. 定额、价目与计价引擎
4. 汇总、报表与审核流
5. AI 推荐与预警
6. AI 原生扩展底座（MCP / Knowledge / Memory 预留）

本实施文档先定义总范围和实施顺序，作为后续模块级开发计划的母文档。

## V1 范围

### 纳入 V1

- 项目创建、编辑、归档
- 阶段模板选择、自定义阶段启用、阶段顺序与负责人配置
- 项目成员、系统角色、业务身份、阶段权限配置
- 招标清单、投标报价、合同清单、施工过程变更清单、竣工结算清单
- 清单版本引用、版本分叉、来源追溯、合同锁定
- 定额套用、价目版本绑定、取费模板绑定
- 综合单价计算、费用分摊、批量重算
- 造价汇总、偏差分析、标准报表导出
- 提交审核、驳回、通过、操作日志
- AI 清单推荐、AI 定额推荐、AI 偏差预警
- 项目复盘结论结构化沉淀
- 驳回原因与审核意见标签化
- 知识条目与系统记忆的基础预留

### 不纳入 V1

- 市场价格自动采集
- AI 材料调差自动生成
- 自然语言造价问答
- ERP / 第三方系统正式对接
- 多租户复杂计费与商业化能力
- 完整可视化知识图谱平台
- 通用技能运行时平台

## 核心数据模型

### 主业务实体

| 实体 | 说明 | 核心关系 |
|------|------|---------|
| `project` | 项目主表 | 1:N `project_stage` / `project_member` / `bill_version` |
| `project_stage` | 项目阶段配置表 | N:1 `project` |
| `project_member` | 项目成员与权限表 | N:1 `project` |
| `project_role_scope` | 项目成员专业/单体/阶段范围 | N:1 `project_member` |
| `bill_version` | 清单版本表 | N:1 `project`, N:1 `project_stage` |
| `bill_item` | 清单明细表 | N:1 `bill_version` |
| `quota_line` | 定额明细表 | N:1 `bill_item` |
| `price_version` | 价目版本表 | 1:N `price_item` |
| `price_item` | 价目明细表 | N:1 `price_version` |
| `fee_template` | 取费模板表 | 1:N `fee_rule` |
| `fee_rule` | 取费规则明细 | N:1 `fee_template` |
| `review_submission` | 阶段提交审核记录 | N:1 `project_stage` |
| `change_order` | 设计变更单 | N:1 `project` / optional N:1 `bill_version` |
| `site_visa` | 现场签证单 | N:1 `project` |
| `progress_payment` | 进度款申报单 | N:1 `project` |
| `settlement_record` | 竣工结算记录 | N:1 `project` |
| `audit_log` | 审计日志 | 多态关联所有主业务对象 |
| `ai_recommendation` | AI 推荐结果缓存 | 多态关联清单/定额/汇总对象 |
| `knowledge_entry` | 知识条目 | 多态关联复盘、审核、规则、经验来源 |
| `memory_entry` | 系统记忆 | 关联用户/项目/组织/AI 运行作用域 |
| `skill_definition` | 业务技能定义 | 供 MCP / skills 层复用 |
| `knowledge_relation` | 轻量知识关系 | 连接知识条目与业务对象 |

### 必要字段建议

| 实体 | 最少字段 |
|------|---------|
| `project` | `id`, `project_code`, `project_name`, `project_type`, `template_name`, `status`, `owner_user_id`, `default_price_version_id`, `created_at`, `updated_at` |
| `project_stage` | `id`, `project_id`, `stage_code`, `stage_name`, `sequence`, `status`, `assignee_user_id`, `reviewer_user_id`, `ai_enabled`, `auto_flow_mode`, `started_at`, `completed_at` |
| `bill_version` | `id`, `project_id`, `stage_id`, `version_no`, `source_stage_id`, `source_version_id`, `version_type`, `is_locked`, `created_by`, `change_reason`, `created_at` |
| `bill_item` | `id`, `bill_version_id`, `parent_id`, `item_code`, `item_name`, `unit`, `quantity`, `system_unit_price`, `manual_unit_price`, `final_unit_price`, `tax_rate`, `source_version_label`, `validation_status`, `remark` |
| `quota_line` | `id`, `bill_item_id`, `quota_code`, `quota_name`, `unit`, `quantity`, `unit_price`, `labor_fee`, `material_fee`, `machine_fee`, `content_factor`, `price_version_id`, `source_mode`, `validation_status` |
| `review_submission` | `id`, `project_stage_id`, `submission_type`, `status`, `submitted_by`, `reviewed_by`, `submitted_at`, `reviewed_at`, `review_comment` |
| `audit_log` | `id`, `resource_type`, `resource_id`, `action`, `operator_id`, `before_payload`, `after_payload`, `created_at` |
| `knowledge_entry` | `id`, `knowledge_type`, `title`, `summary`, `source_type`, `source_id`, `project_id`, `stage_code`, `tags`, `status`, `created_at` |
| `memory_entry` | `id`, `memory_scope`, `scope_id`, `memory_type`, `summary`, `payload_json`, `importance_score`, `last_used_at`, `created_at` |

## 状态机

### 项目状态

```text
draft -> in_progress -> under_review -> archived
```

说明：
- `draft`：已创建但未正式进入阶段执行
- `in_progress`：至少一个阶段处于进行中
- `under_review`：当前阶段已提交审核
- `archived`：项目完成或归档，不再日常编辑

### 阶段状态

```text
not_started -> in_progress -> pending_review -> approved -> completed
                                  \-> rejected -> in_progress
```

### 清单版本状态

```text
editable -> submitted -> approved -> locked
               \-> rejected -> editable
```

### 锁定状态

```text
unlocked -> lock_requested -> locked -> unlock_requested -> unlocked
```

### 报表任务状态

```text
queued -> processing -> completed
                   \-> failed
```

## 权限模型

### 平台级角色

| 角色 | 职责 |
|------|------|
| `system_admin` | 管理用户、基础库、系统配置 |
| `project_owner` | 管理项目、阶段配置、成员配置 |
| `cost_engineer` | 编制清单、套定额、处理过程单据 |
| `reviewer` | 审核阶段成果和偏差 |
| `review_analyst` | 项目复盘、指标提取 |

### 项目级权限维度

| 维度 | 取值 |
|------|------|
| 阶段权限 | `view`, `edit`, `submit`, `review` |
| 专业权限 | `civil`, `installation`, `decoration`, `landscape`, `custom` |
| 单体权限 | `building_1`, `building_2`, `garage`, `custom` |
| 数据对象权限 | `bill`, `quota`, `report`, `summary`, `change_order`, `audit_log` |

### 冲突规则

1. 审核人与编制人不可为同一成员。
2. 合同清单锁定后，`edit` 权限失效，必须改走过程单据。
3. 平台角色允许进入模块，不等于项目内自动拥有编辑权限。

## 核心接口优先级

### P0 接口

- `POST /api/v1/projects`
- `GET /api/v1/projects/:id`
- `GET /api/v1/projects/:id/stages`
- `PUT /api/v1/projects/:id/stages`
- `GET /api/v1/projects/:id/bill-items`
- `POST /api/v1/projects/:id/bill-items`
- `PUT /api/v1/projects/:id/bill-items/:itemId`
- `GET /api/v1/projects/:id/quota-lines`
- `POST /api/v1/projects/:id/quota-lines`
- `POST /api/v1/engine/calculate`
- `POST /api/v1/projects/:id/review-submissions`

### P1 接口

- `POST /api/v1/projects/:id/change-orders`
- `POST /api/v1/projects/:id/site-visas`
- `POST /api/v1/projects/:id/progress-payments`
- `GET /api/v1/reports/summary`
- `POST /api/v1/reports/export`
- `GET /api/v1/projects/:id/summary/variance`

### P2 接口

- `POST /api/v1/ai/bill-recommendations`
- `POST /api/v1/ai/quota-recommendations`
- `GET /api/v1/projects/:id/version-chain`
- `GET /api/v1/projects/:id/audit-logs`
- `GET /mcp/project-context`
- `GET /mcp/stage-context`
- `GET /mcp/knowledge/search`

## 迭代拆分

### Iteration 1：项目与阶段配置

**目标：** 让用户可创建项目、选择模板、配置阶段与成员，并进入阶段工作台。

**交付物：**
- 项目管理页面
- 阶段模板与阶段配置
- 项目成员与权限配置
- 项目与阶段状态流转基础能力

**验收标准：**
- 可创建 9 阶段中任意组合项目
- 可为每个启用阶段指定负责人和审核人
- 可在项目详情页看到阶段工作台和当前阶段状态

### Iteration 2：清单与版本链

**目标：** 建立清单主业务流和版本追溯能力。

**交付物：**
- 清单编制页
- 清单导入导出
- 上游引用生成新版本
- 合同清单锁定
- 清单提交审核

**验收标准：**
- 招标清单可生成投标报价版本
- 投标报价可生成合同清单版本
- 合同清单锁定后无法直接改写
- 任意清单项可查看来源版本

### Iteration 3：定额、价目与计价引擎

**目标：** 让系统能完成受控计价和重算。

**交付物：**
- 定额套用页
- 定额选择器
- 价目版本绑定
- 取费模板绑定
- 计价引擎与重算机制

**验收标准：**
- 清单项可关联 1 条或多条定额
- 切换价目版本可触发重算
- 系统保存系统值、人工调整值、最终值

### Iteration 4：汇总、报表与审核流

**目标：** 让项目结果可汇总、可导出、可审核。

**交付物：**
- 汇总页面
- 偏差分析
- 报表中心
- 提交、驳回、通过审核流
- 审计日志

**验收标准：**
- 可按项目/阶段/专业/单体查看汇总
- 可生成标准报表并导出
- 审核驳回后可回退到可编辑状态

### Iteration 5：AI 推荐与预警

**目标：** 将 AI 能力以辅助模式接入主流程。

**交付物：**
- AI 清单推荐
- AI 定额推荐
- AI 偏差预警
- AI 结果缓存与人工确认机制

**验收标准：**
- AI 推荐结果不会直接覆盖正式业务数据
- 用户可确认、忽略或调整 AI 推荐结果
- 偏差超阈值时可在汇总页看到预警

### Iteration 5.5：AI 原生扩展底座

**目标：** 为 MCP、skills、知识库与系统记忆建立最小可运行底座。

**交付物：**
- `knowledge_entry` 与 `memory_entry` 基础表
- 复盘结论结构化沉淀
- 驳回原因标签化
- MCP 资源上下文基础能力预留

**验收标准：**
- 至少一类复盘结论可沉淀为知识条目
- 至少一类项目/组织偏好可沉淀为记忆条目
- MCP 可读取项目级上下文和知识搜索结果

## 开发前还需补的 4 份配套文档

1. `docs/product/v1-scope.md`
   内容：最终上线范围、明确不做项、业务优先级

2. `docs/architecture/data-model.md`
   内容：ER 图、表结构、唯一约束、外键关系

3. `docs/architecture/state-machines.md`
   内容：项目、阶段、版本、审核、锁定状态机

4. `docs/api/openapi-v1.yaml`
   内容：P0 与 P1 接口契约

## 实施顺序建议

1. 先定 `V1 范围`
2. 再定 `数据模型`
3. 再定 `状态机`
4. 再定 `权限矩阵`
5. 然后做 `P0 接口契约`
6. 最后按迭代 1 到 5 开发

## 风险与控制点

| 风险 | 控制方式 |
|------|---------|
| 范围持续膨胀 | 先锁定 V1 纳入/不纳入范围 |
| 阶段模型复杂导致返工 | 优先固化状态机和阶段流转规则 |
| 清单与定额版本链设计不稳 | 先完成数据模型评审再开发 |
| 权限过粗导致后续补洞 | 先做项目级、阶段级、专业级、单体级权限矩阵 |
| AI 能力影响主流程稳定性 | V1 中 AI 只做推荐与预警，不直接执行 |

## 建议的下一步产出

- 先基于本计划补 `data-model.md`
- 再补 `state-machines.md`
- 然后补 `openapi-v1.yaml`
- 完成后即可进入第一迭代开发
