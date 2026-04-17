# 新点 SaaS 造价系统 V1 数据模型

> 基于 [设计文档_v1.0_优化中.md](/Users/huahaha/Documents/New%20project/设计文档_v1.0_优化中.md) 与 [2026-04-16-saas-pricing-v1-implementation.md](/Users/huahaha/Documents/New%20project/docs/superpowers/plans/2026-04-16-saas-pricing-v1-implementation.md) 整理。

## 1. 文档目标

本文档用于固化 V1 的核心数据结构，作为以下工作的统一依据：

- 数据库建表
- ORM 模型定义
- 接口字段设计
- 权限模型落库
- 版本链与审计日志实现

V1 以“项目 + 阶段配置 + 清单版本链 + 定额明细 + 过程单据 + 审核流”为主线，所有会影响造价结果的数据，都必须能够追溯到具体版本和操作记录。

在此基础上，系统继续预留 AI 原生扩展层，支持后续把业务数据沉淀为：

- `knowledge_entry`
- `memory_entry`
- `skill_definition`
- `knowledge_relation`

这些对象不直接参与主业务计价结果计算，但会作为 MCP、skills、知识库和长期增智能力的基础资产。

## 2. 建模原则

1. 项目是根对象，所有业务数据必须归属到某个项目。
2. 阶段配置独立建模，不把阶段状态直接塞进项目主表。
3. 清单采用“版本头 + 明细行”模式，支持引用、分叉、锁定和追溯。
4. 定额明细挂载在清单行下，不直接独立存在于项目根层级。
5. 过程单据独立建模，不允许通过直接修改合同基线替代过程记录。
6. 审计日志采用多态资源关联，覆盖全部关键对象。
7. AI 推荐结果与正式业务数据隔离存储，不直接覆盖正式结果。
8. 对接源系统时，优先保留源主键、规范编码、定额集编码和层级字段，避免导入后失去追溯能力。

## 3. 实体关系概览

```text
project
├── project_stage
├── project_member
│   └── project_role_scope
├── project_discipline
├── bill_version
│   └── bill_item
│       ├── bill_item_work_item
│       └── quota_line
├── review_submission
├── change_order
├── site_visa
├── progress_payment
├── settlement_record
└── audit_log

fee_template
└── fee_rule

price_version
└── price_item

discipline_type

standard_set

ai_recommendation
knowledge_entry
memory_entry
skill_definition
knowledge_relation
```

## 4. 核心实体定义

### 4.1 `project`

项目主表，对应一个独立建设项目或造价任务。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | uuid | PK | 主键 |
| `project_code` | varchar(64) | UNIQUE, NOT NULL | 项目编号 |
| `project_name` | varchar(200) | NOT NULL | 项目名称 |
| `project_type` | varchar(50) | NOT NULL | 房建、市政、园林等 |
| `template_name` | varchar(100) | NOT NULL | 阶段模板名称 |
| `status` | varchar(30) | NOT NULL | `draft` / `in_progress` / `under_review` / `archived` |
| `owner_user_id` | uuid | NOT NULL | 项目负责人 |
| `default_price_version_id` | uuid | NULL | 默认价目版本 |
| `default_fee_template_id` | uuid | NULL | 默认取费模板 |
| `client_name` | varchar(200) | NULL | 建设单位 |
| `location_code` | varchar(50) | NULL | 地区编码 |
| `location_text` | varchar(200) | NULL | 地区名称 |
| `building_area` | numeric(18,2) | NULL | 建筑面积 |
| `structure_type` | varchar(50) | NULL | 结构形式 |
| `description` | text | NULL | 项目简介 |
| `created_by` | uuid | NOT NULL | 创建人 |
| `created_at` | timestamptz | NOT NULL | 创建时间 |
| `updated_at` | timestamptz | NOT NULL | 更新时间 |

### 4.1.1 `discipline_type`

专业主数据表，用于承接源系统中的专业定义与业务视图。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | uuid | PK | 主键 |
| `discipline_code` | varchar(50) | UNIQUE, NOT NULL | SaaS 内部专业编码 |
| `discipline_name` | varchar(100) | NOT NULL | 专业名称 |
| `source_field_code` | varchar(20) | NULL | 源字段编码，如 `ZY` |
| `source_markup` | varchar(50) | NULL | 源系统专业编码 |
| `gb08_code` | varchar(20) | NULL | 2008 规范映射码 |
| `gb13_code` | varchar(20) | NULL | 2013 规范映射码 |
| `discipline_group` | varchar(50) | NULL | 建安、市政、园林等 |
| `business_view_type` | varchar(50) | NULL | 造价10、清标、南京等业务视图 |
| `region_code` | varchar(50) | NULL | 地区编码 |
| `source_system` | varchar(50) | NULL | 源系统标识 |
| `status` | varchar(20) | NOT NULL | `active`, `inactive` |
| `created_at` | timestamptz | NOT NULL | 创建时间 |
| `updated_at` | timestamptz | NOT NULL | 更新时间 |

### 4.1.2 `standard_set`

定额集主数据表，用于承接源系统中的 `DekID` 维度。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | uuid | PK | 主键 |
| `standard_set_code` | varchar(50) | UNIQUE, NOT NULL | 定额集编码 |
| `standard_set_name` | varchar(100) | NOT NULL | 定额集名称 |
| `discipline_code` | varchar(50) | NULL | 关联专业编码 |
| `version_year` | int | NULL | 版本年份 |
| `standard_type` | varchar(50) | NULL | 土建、安装、市政等 |
| `region_code` | varchar(50) | NULL | 地区编码 |
| `source_system` | varchar(50) | NULL | 源系统标识 |
| `status` | varchar(20) | NOT NULL | `active`, `inactive` |
| `created_at` | timestamptz | NOT NULL | 创建时间 |
| `updated_at` | timestamptz | NOT NULL | 更新时间 |

### 4.2 `project_stage`

项目阶段配置表，每个项目对启用的阶段独立存一条记录。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | uuid | PK | 主键 |
| `project_id` | uuid | FK, NOT NULL | 归属项目 |
| `stage_code` | varchar(50) | NOT NULL | 如 `estimate`, `target_cost`, `bid_bill` |
| `stage_name` | varchar(100) | NOT NULL | 阶段中文名 |
| `sequence_no` | int | NOT NULL | 阶段顺序 |
| `status` | varchar(30) | NOT NULL | `not_started` / `in_progress` / `pending_review` / `approved` / `completed` / `skipped` |
| `assignee_user_id` | uuid | NULL | 当前负责人 |
| `reviewer_user_id` | uuid | NULL | 当前审核人 |
| `ai_enabled` | boolean | NOT NULL DEFAULT false | 是否启用 AI |
| `auto_flow_mode` | varchar(30) | NOT NULL | `manual_confirm` / `auto_next` / `auto_archive` |
| `is_enabled` | boolean | NOT NULL DEFAULT true | 是否启用 |
| `started_at` | timestamptz | NULL | 开始时间 |
| `completed_at` | timestamptz | NULL | 完成时间 |
| `created_at` | timestamptz | NOT NULL | 创建时间 |
| `updated_at` | timestamptz | NOT NULL | 更新时间 |

### 4.2.1 `project_discipline`

项目专业配置表，用于把项目启用的专业与主数据表关联起来。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | uuid | PK | 主键 |
| `project_id` | uuid | FK, NOT NULL | 归属项目 |
| `discipline_code` | varchar(50) | NOT NULL | 专业编码 |
| `standard_set_code` | varchar(50) | NULL | 默认定额集编码 |
| `sort_order` | int | NOT NULL DEFAULT 0 | 展示顺序 |
| `is_enabled` | boolean | NOT NULL DEFAULT true | 是否启用 |
| `created_at` | timestamptz | NOT NULL | 创建时间 |
| `updated_at` | timestamptz | NOT NULL | 更新时间 |

约束建议：

- `project_id + discipline_code` 唯一

### 4.3 `project_member`

项目成员表，用于把平台用户拉入项目并绑定角色。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | uuid | PK | 主键 |
| `project_id` | uuid | FK, NOT NULL | 归属项目 |
| `user_id` | uuid | FK, NOT NULL | 平台用户 |
| `system_role` | varchar(50) | NOT NULL | `project_owner`, `cost_engineer`, `reviewer`, `review_analyst` |
| `business_identity` | jsonb | NOT NULL DEFAULT '[]' | 业务身份数组 |
| `is_active` | boolean | NOT NULL DEFAULT true | 是否有效 |
| `created_at` | timestamptz | NOT NULL | 创建时间 |
| `updated_at` | timestamptz | NOT NULL | 更新时间 |

约束建议：

- `project_id + user_id` 唯一

### 4.4 `project_role_scope`

项目成员的细粒度权限范围表，控制阶段、专业、单体和动作。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | uuid | PK | 主键 |
| `project_member_id` | uuid | FK, NOT NULL | 归属项目成员 |
| `stage_code` | varchar(50) | NOT NULL | 阶段编码 |
| `discipline_code` | varchar(50) | NULL | 专业编码 |
| `unit_code` | varchar(100) | NULL | 单体编码 |
| `permission_code` | varchar(30) | NOT NULL | `view` / `edit` / `submit` / `review` |
| `resource_type` | varchar(50) | NOT NULL | `bill`, `quota`, `report`, `summary`, `change_order` 等 |
| `created_at` | timestamptz | NOT NULL | 创建时间 |

### 4.5 `bill_version`

清单版本头表，是 V1 的核心实体之一。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | uuid | PK | 主键 |
| `project_id` | uuid | FK, NOT NULL | 归属项目 |
| `stage_id` | uuid | FK, NOT NULL | 所属阶段配置 |
| `version_no` | varchar(30) | NOT NULL | 如 `v1.0`, `v2.0` |
| `version_type` | varchar(30) | NOT NULL | `initial`, `reference_copy`, `contract_baseline`, `change`, `settlement` |
| `source_stage_id` | uuid | FK, NULL | 来源阶段 |
| `source_version_id` | uuid | FK, NULL | 来源版本 |
| `source_spec_code` | varchar(50) | NULL | 源清单规范/清单集合编码 |
| `source_spec_name` | varchar(100) | NULL | 源清单集合名称 |
| `source_visible_flag` | boolean | NULL | 源系统是否显示 |
| `source_default_flag` | boolean | NULL | 源系统是否默认 |
| `status` | varchar(30) | NOT NULL | `editable`, `submitted`, `approved`, `locked`, `rejected` |
| `is_locked` | boolean | NOT NULL DEFAULT false | 是否锁定 |
| `change_reason` | text | NULL | 版本变更原因 |
| `created_by` | uuid | NOT NULL | 创建人 |
| `created_at` | timestamptz | NOT NULL | 创建时间 |
| `updated_at` | timestamptz | NOT NULL | 更新时间 |

约束建议：

- `project_id + stage_id + version_no` 唯一

### 4.6 `bill_item`

清单明细行表。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | uuid | PK | 主键 |
| `bill_version_id` | uuid | FK, NOT NULL | 所属清单版本 |
| `parent_id` | uuid | FK, NULL | 上级行，支持树形结构 |
| `item_level` | smallint | NOT NULL | 1=章, 2=节, 3=清单项 |
| `sort_order` | int | NOT NULL | 同级排序 |
| `item_code` | varchar(50) | NOT NULL | 清单编号 |
| `item_name` | varchar(200) | NOT NULL | 清单名称 |
| `unit` | varchar(30) | NOT NULL | 计量单位 |
| `source_bill_id` | varchar(100) | NULL | 源系统清单 ID |
| `source_sequence` | int | NULL | 源系统序号 |
| `source_level_code` | varchar(50) | NULL | 源层级代码，如 `Fbcch` |
| `is_measure_item` | boolean | NOT NULL DEFAULT false | 是否措施项目 |
| `quantity` | numeric(18,8) | NOT NULL | 工程量 |
| `feature_rule_text` | text | NULL | 项目特征或计算规则 |
| `source_reference_price` | numeric(18,6) | NULL | 源系统参考单价 |
| `source_fee_id` | varchar(100) | NULL | 源取费 ID |
| `measure_category` | varchar(50) | NULL | 措施类别 |
| `measure_fee_flag` | varchar(50) | NULL | 措施费用标记 |
| `measure_category_subtype` | varchar(50) | NULL | 措施类别细分 |
| `system_unit_price` | numeric(18,6) | NULL | 系统计算综合单价 |
| `manual_unit_price` | numeric(18,6) | NULL | 人工调整综合单价 |
| `final_unit_price` | numeric(18,6) | NULL | 最终生效综合单价 |
| `system_amount` | numeric(18,2) | NULL | 系统计算金额 |
| `final_amount` | numeric(18,2) | NULL | 最终生效金额 |
| `tax_rate` | numeric(8,4) | NULL | 税率 |
| `source_version_label` | varchar(100) | NULL | 来源显示字段 |
| `lock_status` | varchar(30) | NOT NULL DEFAULT 'unlocked' | 锁定状态 |
| `validation_status` | varchar(20) | NOT NULL DEFAULT 'normal' | `normal`, `warning`, `error` |
| `remark` | varchar(500) | NULL | 备注 |
| `created_at` | timestamptz | NOT NULL | 创建时间 |
| `updated_at` | timestamptz | NOT NULL | 更新时间 |

约束建议：

- `bill_version_id + item_code + parent_id` 可加业务唯一索引

### 4.7 `bill_item_work_item`

清单工作内容子表，用于兼容源系统中独立存储的 `Gznr` 数据。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | uuid | PK | 主键 |
| `bill_item_id` | uuid | FK, NOT NULL | 所属清单项 |
| `source_spec_code` | varchar(50) | NULL | 源清单规范编码 |
| `source_bill_id` | varchar(100) | NULL | 源系统清单 ID |
| `sort_order` | int | NOT NULL | 工作内容排序 |
| `work_content` | text | NOT NULL | 工作内容 |
| `created_at` | timestamptz | NOT NULL | 创建时间 |

### 4.8 `quota_line`

定额明细表，挂载在清单项下。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | uuid | PK | 主键 |
| `bill_item_id` | uuid | FK, NOT NULL | 归属清单项 |
| `source_standard_set_code` | varchar(50) | NULL | 源定额集编码 |
| `source_quota_id` | varchar(100) | NULL | 源系统定额 ID |
| `source_sequence` | int | NULL | 源系统序号 |
| `quota_code` | varchar(50) | NOT NULL | 定额编号 |
| `quota_name` | varchar(200) | NOT NULL | 定额名称 |
| `chapter_code` | varchar(50) | NULL | 源章节号 |
| `unit` | varchar(30) | NOT NULL | 定额单位 |
| `quantity` | numeric(18,8) | NOT NULL | 定额工程量 |
| `unit_price` | numeric(18,6) | NULL | 定额单价 |
| `total_price` | numeric(18,2) | NULL | 定额合价 |
| `labor_fee` | numeric(18,2) | NULL | 人工费 |
| `material_fee` | numeric(18,2) | NULL | 材料费 |
| `machine_fee` | numeric(18,2) | NULL | 机械费 |
| `content_factor` | numeric(18,6) | NOT NULL DEFAULT 1 | 含量系数 |
| `price_version_id` | uuid | FK, NULL | 价目版本 |
| `region_code` | varchar(50) | NULL | 所属地区 |
| `source_mode` | varchar(30) | NOT NULL | `manual`, `ai`, `history_reference` |
| `validation_status` | varchar(20) | NOT NULL DEFAULT 'normal' | 校验状态 |
| `remark` | varchar(500) | NULL | 备注 |
| `created_at` | timestamptz | NOT NULL | 创建时间 |
| `updated_at` | timestamptz | NOT NULL | 更新时间 |

### 4.9 `price_version`

价目版本头表。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | uuid | PK | 主键 |
| `version_code` | varchar(50) | NOT NULL | 如 `2024Q4-JS` |
| `region_code` | varchar(50) | NOT NULL | 地区编码 |
| `version_date` | date | NOT NULL | 版本日期 |
| `status` | varchar(20) | NOT NULL | `draft`, `active`, `inactive` |
| `remark` | varchar(500) | NULL | 备注 |
| `created_at` | timestamptz | NOT NULL | 创建时间 |
| `updated_at` | timestamptz | NOT NULL | 更新时间 |

约束建议：

- `version_code` 唯一

### 4.10 `price_item`

价目版本明细表。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | uuid | PK | 主键 |
| `price_version_id` | uuid | FK, NOT NULL | 所属价目版本 |
| `quota_code` | varchar(50) | NOT NULL | 定额编号 |
| `labor_unit_price` | numeric(18,6) | NOT NULL | 人工费单价 |
| `material_unit_price` | numeric(18,6) | NOT NULL | 材料费单价 |
| `machine_unit_price` | numeric(18,6) | NOT NULL | 机械费单价 |
| `total_unit_price` | numeric(18,6) | NOT NULL | 综合单价 |
| `created_at` | timestamptz | NOT NULL | 创建时间 |

约束建议：

- `price_version_id + quota_code` 唯一

### 4.11 `fee_template`

取费模板头表。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | uuid | PK | 主键 |
| `template_name` | varchar(100) | NOT NULL | 模板名称 |
| `project_type` | varchar(50) | NULL | 项目类型 |
| `region_code` | varchar(50) | NULL | 地区编码 |
| `stage_scope` | jsonb | NOT NULL DEFAULT '[]' | 适用阶段 |
| `tax_mode` | varchar(30) | NOT NULL | 计税模式 |
| `allocation_mode` | varchar(30) | NOT NULL | 分摊策略 |
| `status` | varchar(20) | NOT NULL | `draft`, `active`, `inactive` |
| `effective_date` | date | NULL | 生效日期 |
| `expired_date` | date | NULL | 失效日期 |
| `created_at` | timestamptz | NOT NULL | 创建时间 |
| `updated_at` | timestamptz | NOT NULL | 更新时间 |

### 4.12 `fee_rule`

取费规则明细表。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | uuid | PK | 主键 |
| `fee_template_id` | uuid | FK, NOT NULL | 所属模板 |
| `discipline_code` | varchar(50) | NULL | 专业编码 |
| `fee_type` | varchar(50) | NOT NULL | `management_fee`, `safety_fee`, `night_fee`, `tax`, `social_insurance` 等 |
| `fee_rate` | numeric(12,6) | NOT NULL | 费率 |
| `created_at` | timestamptz | NOT NULL | 创建时间 |

### 4.13 `review_submission`

审核提交记录表。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | uuid | PK | 主键 |
| `project_stage_id` | uuid | FK, NOT NULL | 所属阶段 |
| `resource_type` | varchar(50) | NOT NULL | 如 `bill_version`, `settlement_record` |
| `resource_id` | uuid | NOT NULL | 资源主键 |
| `submission_type` | varchar(30) | NOT NULL | `stage_submit`, `lock_request`, `unlock_request` |
| `status` | varchar(30) | NOT NULL | `pending`, `approved`, `rejected` |
| `submitted_by` | uuid | NOT NULL | 提交人 |
| `reviewed_by` | uuid | NULL | 审核人 |
| `submitted_at` | timestamptz | NOT NULL | 提交时间 |
| `reviewed_at` | timestamptz | NULL | 审核时间 |
| `review_comment` | text | NULL | 审核意见 |

### 4.14 `change_order`

设计变更单表。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | uuid | PK | 主键 |
| `project_id` | uuid | FK, NOT NULL | 所属项目 |
| `bill_version_id` | uuid | FK, NULL | 关联清单版本 |
| `change_code` | varchar(100) | UNIQUE, NOT NULL | 变更单编号 |
| `title` | varchar(200) | NOT NULL | 变更标题 |
| `status` | varchar(30) | NOT NULL | `draft`, `pending`, `approved`, `rejected`, `settled` |
| `reason` | text | NULL | 变更原因 |
| `requested_by` | uuid | NOT NULL | 发起人 |
| `approved_by` | uuid | NULL | 审批人 |
| `approved_at` | timestamptz | NULL | 审批时间 |
| `created_at` | timestamptz | NOT NULL | 创建时间 |

### 4.15 `site_visa`

现场签证单表，结构与 `change_order` 类似。

关键字段建议：

- `visa_code`
- `project_id`
- `title`
- `status`
- `reason`
- `requested_by`
- `approved_by`
- `approved_at`
- `created_at`

### 4.16 `progress_payment`

进度款申报单表。

关键字段建议：

- `payment_code`
- `project_id`
- `stage_id`
- `period_start`
- `period_end`
- `declared_amount`
- `approved_amount`
- `status`
- `submitted_by`
- `reviewed_by`
- `created_at`

### 4.17 `settlement_record`

竣工结算记录表。

关键字段建议：

- `id`
- `project_id`
- `bill_version_id`
- `contract_amount`
- `change_amount`
- `settlement_amount`
- `audit_amount`
- `status`
- `created_by`
- `created_at`

### 4.18 `audit_log`

审计日志表，用于记录所有关键操作。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | uuid | PK | 主键 |
| `resource_type` | varchar(50) | NOT NULL | 资源类型 |
| `resource_id` | uuid | NOT NULL | 资源 ID |
| `action` | varchar(50) | NOT NULL | `create`, `update`, `submit`, `approve`, `reject`, `lock` 等 |
| `operator_id` | uuid | NOT NULL | 操作人 |
| `project_id` | uuid | FK, NULL | 所属项目 |
| `stage_code` | varchar(50) | NULL | 所属阶段 |
| `before_payload` | jsonb | NULL | 变更前快照 |
| `after_payload` | jsonb | NULL | 变更后快照 |
| `created_at` | timestamptz | NOT NULL | 操作时间 |

### 4.19 `ai_recommendation`

AI 推荐结果缓存表。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | uuid | PK | 主键 |
| `project_id` | uuid | FK, NOT NULL | 所属项目 |
| `resource_type` | varchar(50) | NOT NULL | `bill_item`, `quota_line`, `summary` |
| `resource_id` | uuid | NOT NULL | 资源 ID |
| `recommendation_type` | varchar(50) | NOT NULL | `bill_recommendation`, `quota_recommendation`, `variance_warning` |
| `input_payload` | jsonb | NOT NULL | 输入上下文 |
| `output_payload` | jsonb | NOT NULL | 推荐结果 |
| `status` | varchar(20) | NOT NULL | `generated`, `accepted`, `ignored`, `expired` |
| `created_by` | uuid | NOT NULL | 触发人 |
| `created_at` | timestamptz | NOT NULL | 生成时间 |

### 4.20 `knowledge_entry`

知识条目表，用于承接项目复盘、审核经验、定额映射经验、偏差模式等可复用知识。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | uuid | PK | 主键 |
| `knowledge_type` | varchar(50) | NOT NULL | `retrospective_finding`, `audit_rule`, `variance_pattern`, `quota_mapping_pattern` 等 |
| `title` | varchar(200) | NOT NULL | 知识标题 |
| `summary` | text | NOT NULL | 摘要 |
| `content_markdown` | text | NULL | 文档化内容 |
| `content_json` | jsonb | NULL | 结构化内容 |
| `source_type` | varchar(50) | NOT NULL | `project_retrospective`, `review_submission`, `audit_log`, `ai_feedback` 等 |
| `source_id` | uuid | NULL | 来源对象 ID |
| `project_id` | uuid | FK, NULL | 所属项目 |
| `stage_code` | varchar(50) | NULL | 来源阶段 |
| `discipline_code` | varchar(50) | NULL | 来源专业 |
| `tags` | jsonb | NOT NULL DEFAULT '[]' | 标签数组 |
| `confidence_score` | numeric(5,4) | NULL | 置信度 |
| `status` | varchar(20) | NOT NULL | `draft`, `active`, `inactive` |
| `created_by` | uuid | NOT NULL | 创建人 |
| `created_at` | timestamptz | NOT NULL | 创建时间 |
| `updated_at` | timestamptz | NOT NULL | 更新时间 |

### 4.21 `memory_entry`

系统记忆表，用于承接用户、项目、组织和 AI 运行过程中的上下文记忆。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | uuid | PK | 主键 |
| `memory_scope` | varchar(30) | NOT NULL | `user`, `project`, `organization`, `ai_runtime` |
| `scope_id` | uuid | NULL | 作用域 ID，可为空表示平台级 |
| `memory_type` | varchar(50) | NOT NULL | `preference`, `risk_focus`, `review_pattern`, `recommendation_feedback` 等 |
| `summary` | text | NOT NULL | 记忆摘要 |
| `payload_json` | jsonb | NOT NULL | 记忆内容 |
| `importance_score` | numeric(5,4) | NULL | 重要性分数 |
| `freshness_score` | numeric(5,4) | NULL | 新鲜度分数 |
| `last_used_at` | timestamptz | NULL | 最近使用时间 |
| `created_at` | timestamptz | NOT NULL | 创建时间 |
| `updated_at` | timestamptz | NOT NULL | 更新时间 |

### 4.22 `skill_definition`

业务技能定义表，用于登记系统内可复用的 AI 业务技能。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | uuid | PK | 主键 |
| `skill_code` | varchar(100) | UNIQUE, NOT NULL | 技能编码 |
| `skill_name` | varchar(200) | NOT NULL | 技能名称 |
| `description` | text | NULL | 技能说明 |
| `input_schema` | jsonb | NOT NULL | 输入结构定义 |
| `output_schema` | jsonb | NOT NULL | 输出结构定义 |
| `prompt_template` | text | NULL | 提示词模板 |
| `resource_dependencies_json` | jsonb | NOT NULL DEFAULT '[]' | 依赖资源 |
| `default_knowledge_filters_json` | jsonb | NOT NULL DEFAULT '[]' | 默认知识检索过滤条件 |
| `status` | varchar(20) | NOT NULL | `draft`, `active`, `inactive` |
| `created_at` | timestamptz | NOT NULL | 创建时间 |
| `updated_at` | timestamptz | NOT NULL | 更新时间 |

### 4.23 `knowledge_relation`

轻量知识图谱关系表，用于表达知识条目、项目、流程、规则之间的关联。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | uuid | PK | 主键 |
| `from_type` | varchar(50) | NOT NULL | 起点对象类型 |
| `from_id` | uuid | NOT NULL | 起点对象 ID |
| `relation_type` | varchar(50) | NOT NULL | `causes`, `supports`, `similar_to`, `derived_from`, `used_in` 等 |
| `to_type` | varchar(50) | NOT NULL | 终点对象类型 |
| `to_id` | uuid | NOT NULL | 终点对象 ID |
| `weight` | numeric(8,4) | NULL | 关系权重 |
| `created_at` | timestamptz | NOT NULL | 创建时间 |

## 5. 枚举建议

### 5.1 阶段编码 `stage_code`

| 编码 | 含义 |
|------|------|
| `estimate` | 投资估算 |
| `target_cost` | 目标成本 |
| `bid_bill` | 招标清单 |
| `control_price` | 招标控制价 |
| `bid_quote` | 投标报价 |
| `contract_bill` | 合同清单 |
| `construction` | 施工过程 |
| `settlement` | 竣工结算 |
| `retrospective` | 项目复盘 |

### 5.2 业务身份 `business_identity`

| 编码 | 含义 |
|------|------|
| `tender_cost_engineer` | 招标方造价员 |
| `bid_cost_engineer` | 投标方造价员 |
| `construction_budget_engineer` | 施工方预算员 |
| `audit_reviewer` | 审计方审核员 |

### 5.3 源系统兼容字段说明

以下字段建议在 V1 就保留，不建议在导入时丢弃：

- `bill_version.source_spec_code`
- `bill_item.source_bill_id`
- `bill_item.source_level_code`
- `quota_line.source_standard_set_code`
- `quota_line.source_quota_id`
- `bill_item_work_item.work_content`

## 6. 索引建议

建议优先建立以下索引：

- `project(project_code)`
- `project_stage(project_id, stage_code)`
- `project_discipline(project_id, discipline_code)`
- `project_member(project_id, user_id)`
- `discipline_type(discipline_code)`
- `standard_set(standard_set_code)`
- `bill_version(project_id, stage_id, version_no)`
- `bill_item(bill_version_id, item_code)`
- `bill_item_work_item(bill_item_id, sort_order)`
- `quota_line(bill_item_id, quota_code)`
- `price_item(price_version_id, quota_code)`
- `audit_log(resource_type, resource_id, created_at desc)`
- `ai_recommendation(project_id, resource_type, resource_id)`
- `knowledge_entry(knowledge_type, status, created_at desc)`
- `knowledge_entry(project_id, stage_code, discipline_code)`
- `memory_entry(memory_scope, scope_id, memory_type)`
- `memory_entry(last_used_at desc)`
- `skill_definition(skill_code)`
- `knowledge_relation(from_type, from_id)`
- `knowledge_relation(to_type, to_id)`

## 7. 删除与归档策略

V1 不建议对核心业务数据做物理删除。

建议策略：

- `project`：使用 `status=archived`
- `project_member`：使用 `is_active=false`
- `discipline_type` / `standard_set`：使用 `status=inactive`
- `price_version` / `fee_template`：使用 `status=inactive`
- 核心版本表、审核记录、审计日志：禁止删除
- `knowledge_entry`：使用 `status=inactive`
- `memory_entry`：建议逻辑失效，不做物理删除
- `skill_definition`：使用 `status=inactive`
- `knowledge_relation`：禁止随意物理删除，优先维护关系有效性

## 8. 开发落地建议

建表时建议顺序如下：

1. `project`
2. `discipline_type` / `standard_set`
3. `project_stage`
4. `project_discipline`
5. `project_member`
6. `project_role_scope`
7. `price_version` / `price_item`
8. `fee_template` / `fee_rule`
9. `bill_version`
10. `bill_item`
11. `bill_item_work_item`
12. `quota_line`
13. `review_submission`
14. `change_order` / `site_visa` / `progress_payment` / `settlement_record`
15. `audit_log`
16. `ai_recommendation`
17. `knowledge_entry`
18. `memory_entry`
19. `skill_definition`
20. `knowledge_relation`

## 9. 下一步建议

在本文档基础上，建议紧接着做两件事：

1. 基于 [source-field-mapping.md](/Users/huahaha/Documents/New%20project/docs/architecture/source-field-mapping.md) 定一版导入字段白名单
2. 给 `bill_item_work_item`、`project_discipline`、`standard_set` 补接口和权限规则
3. 将 `knowledge_entry`、`memory_entry`、`skill_definition`、`knowledge_relation` 逐步纳入知识与记忆抽取链路

这样你的数据模型就不只是“自研版”，而是已经具备了源系统导入和兼容演进的基础。 
