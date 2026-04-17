# 新点 SaaS 造价系统流程与表单引擎详细设计

> 基于 [technical-architecture-and-platform-selection.md](/Users/huahaha/Documents/New%20project/docs/architecture/technical-architecture-and-platform-selection.md)、[state-machines.md](/Users/huahaha/Documents/New%20project/docs/architecture/state-machines.md)、[permission-matrix.md](/Users/huahaha/Documents/New%20project/docs/architecture/permission-matrix.md) 与 [data-model.md](/Users/huahaha/Documents/New%20project/docs/architecture/data-model.md) 展开。

## 1. 文档目标

这份文档用于把“流程低代码引擎（含流程表单配置）”从选型建议推进到可开发级设计。

它重点回答 6 个问题：

- 哪些业务要接流程引擎
- 流程定义和业务状态如何分工
- 表单 schema 怎么设计
- 节点级字段权限怎么表达
- 流程实例、任务、提交记录怎么落库
- V1 先做哪些流程，后做哪些流程

## 2. 设计原则

## 2.1 流程引擎只管“流转”，业务系统掌握“业务真相”

在本项目里，流程引擎不能反过来成为业务主数据库。

必须坚持：

- 业务主状态在业务表中
- 流程实例状态在流程表中
- 流程动作触发业务状态变化
- 业务状态变化写审计日志

也就是说：

- `bill_version.status`
- `project_stage.status`
- `review_submission.status`
- `change_order.status`

这些状态依然属于业务系统。

流程引擎负责的是：

- 当前走到哪个节点
- 当前待办是谁
- 下一步走向哪
- 哪个节点通过/驳回/撤回

## 2.2 清单/定额主编辑界面不走动态表单引擎

清单和定额是“领域专用重表格”，不能强行塞进通用表单渲染器。

所以本系统有两套渲染体系：

- `流程表单引擎`
  适用于审核、锁定申请、变更单、签证单、进度款、说明类表单。

- `领域表格引擎`
  适用于清单、定额、汇总、报表这类重 grid 业务。

## 2.3 V1 只做“可配置流程 + 可配置表单”，不做通用低代码平台

V1 目标不是做一个完整的 PaaS，而是做一个能支撑业务的流程配置层。

V1 允许：

- 流程模板配置
- 节点配置
- 审批人规则
- 节点表单配置
- 字段显隐/只读/必填
- 提交/审核/驳回/撤回

V1 不做：

- 拖拽式页面搭建器
- 自定义脚本执行平台
- 通用规则编排器
- 跨系统编排平台

## 3. V1 需要接入流程引擎的业务范围

V1 推荐先接 4 类流程。

## 3.1 阶段成果提交流程

适用对象：

- `bill_version`
- `project_stage`

典型场景：

- 当前阶段清单版本提交审核
- 阶段成果审核通过/驳回
- 阶段完成确认

## 3.2 锁定/解锁流程

适用对象：

- `bill_version`

典型场景：

- 合同基线锁定申请
- 锁定审批
- 解锁申请
- 解锁审批

## 3.3 过程单据流程

适用对象：

- `change_order`
- `site_visa`
- `progress_payment`

典型场景：

- 新建单据
- 提交审核
- 审核通过/驳回
- 驳回后修改重提

## 3.4 报表导出审批流程

V1 可以先预留，不一定首批上线。

适用对象：

- 高敏感导出任务
- 大批量结算报表导出

## 4. 流程模型设计

## 4.1 核心概念

建议统一使用下面这套概念：

- `workflow_definition`
  流程定义

- `workflow_version`
  流程定义版本

- `workflow_binding`
  流程和业务对象的绑定关系

- `workflow_instance`
  某个业务对象当前发起的一次流程实例

- `workflow_task`
  当前流程节点下派生出的待办任务

- `form_definition`
  表单定义

- `form_version`
  表单定义版本

- `form_submission`
  某次流程动作中的表单提交记录

## 4.2 流程定义层

### `workflow_definition`

建议字段：

- `id`
- `workflow_code`
- `workflow_name`
- `resource_type`
- `description`
- `status`
- `created_by`
- `created_at`
- `updated_at`

### `workflow_version`

建议字段：

- `id`
- `workflow_definition_id`
- `version_no`
- `bpmn_xml`
- `status`
- `is_default`
- `published_by`
- `published_at`

### 设计原则

- 同一个流程定义允许多个版本
- 只有 `published` 版本可被新实例使用
- 已运行实例始终绑定启动时版本，不随新版本漂移

## 4.3 流程绑定层

### `workflow_binding`

用于表达“某类业务对象在某条件下该走哪个流程”。

建议字段：

- `id`
- `resource_type`
- `stage_code`
- `submission_type`
- `project_type`
- `workflow_version_id`
- `form_version_id`
- `priority`
- `is_active`

### 绑定规则

支持按以下维度命中：

- `resource_type`
- `stage_code`
- `submission_type`
- `project_type`

推荐命中优先级：

1. 完全匹配
2. 忽略 `project_type`
3. 忽略 `stage_code`
4. 退回默认绑定

例如：

- `bill_version + bidding + stage_submit`
- `bill_version + contract + lock_request`
- `change_order + construction + submit`

## 4.4 运行时实例层

### `workflow_instance`

建议字段：

- `id`
- `workflow_definition_id`
- `workflow_version_id`
- `resource_type`
- `resource_id`
- `project_id`
- `project_stage_id`
- `submission_type`
- `status`
- `current_node_key`
- `current_node_name`
- `started_by`
- `started_at`
- `finished_at`

推荐状态：

- `running`
- `approved`
- `rejected`
- `cancelled`
- `terminated`

### `workflow_task`

建议字段：

- `id`
- `workflow_instance_id`
- `node_key`
- `node_name`
- `task_type`
- `assignee_user_id`
- `candidate_scope_json`
- `status`
- `action`
- `comment`
- `created_at`
- `completed_at`

推荐状态：

- `todo`
- `claimed`
- `completed`
- `cancelled`

## 5. 表单引擎设计

## 5.1 核心思路

表单引擎采用：

- `JSON Schema` 描述数据结构
- `UI Schema` 描述布局与组件
- `Field Rule` 描述字段权限

这样可以把“字段定义”“页面布局”“节点权限”拆开，不会互相污染。

## 5.2 表单定义表

### `form_definition`

建议字段：

- `id`
- `form_code`
- `form_name`
- `resource_type`
- `description`
- `status`
- `created_by`
- `created_at`

### `form_version`

建议字段：

- `id`
- `form_definition_id`
- `version_no`
- `schema_json`
- `ui_schema_json`
- `default_field_rules_json`
- `status`
- `is_default`
- `published_at`

## 5.3 表单提交记录

### `form_submission`

建议字段：

- `id`
- `form_definition_id`
- `form_version_id`
- `workflow_instance_id`
- `workflow_task_id`
- `resource_type`
- `resource_id`
- `submission_action`
- `form_payload`
- `submitted_by`
- `submitted_at`

推荐 `submission_action`：

- `draft_save`
- `submit`
- `approve`
- `reject`
- `cancel`

## 5.4 Schema 设计建议

推荐最小结构：

```json
{
  "fields": [
    {
      "key": "reason",
      "label": "申请原因",
      "type": "textarea",
      "required": true
    },
    {
      "key": "attachment_ids",
      "label": "附件",
      "type": "attachment",
      "required": false
    }
  ]
}
```

### V1 支持的字段类型

- `text`
- `textarea`
- `number`
- `money`
- `date`
- `datetime`
- `select`
- `multi_select`
- `user_picker`
- `attachment`
- `readonly_summary`
- `sub_table`

### V1 不建议首批支持

- 自定义脚本字段
- 复杂联动公式
- 自定义前端组件市场

## 5.5 UI Schema 设计建议

UI Schema 只负责布局，不负责业务逻辑。

推荐结构：

```json
{
  "layout": [
    {
      "type": "section",
      "title": "基本信息",
      "fields": ["reason", "attachment_ids"]
    }
  ]
}
```

支持的布局概念：

- `section`
- `row`
- `column`
- `tab`
- `summary_block`

## 6. 节点级字段权限设计

## 6.1 为什么要单独设计

同一张表单，在不同节点可能有不同权限。

例如：

- 提交人节点：可编辑“申请原因、附件”
- 审核人节点：可查看申请信息，但只能填写“审核意见”
- 归档节点：所有字段只读

所以字段权限不能只写在表单定义里，必须支持节点覆盖。

## 6.2 推荐权限模型

每个字段支持三类控制：

- `visible`
- `editable`
- `required`

建议表达方式：

```json
{
  "nodeKey": "review_node",
  "fieldRules": {
    "reason": { "visible": true, "editable": false, "required": false },
    "review_comment": { "visible": true, "editable": true, "required": true }
  }
}
```

## 6.3 权限合并规则

字段最终权限建议按下面顺序合并：

1. 表单默认规则
2. 节点覆盖规则
3. 流程动作规则
4. 用户业务权限校验

最终原则：

- 表单层决定“看起来如何”
- 权限层决定“到底能不能做”

前端不能单靠 schema 判权限，后端必须二次校验。

## 7. 审批人规则设计

## 7.1 支持的审批人来源

V1 先支持这几类：

- `project_stage.reviewer_user_id`
- 项目负责人
- 指定系统角色
- 指定业务身份
- 提交人上级
- 固定用户

## 7.2 推荐表达方式

在流程节点配置里保存：

```json
{
  "assigneeType": "stage_reviewer",
  "fallbackType": "project_owner"
}
```

### `assigneeType` 推荐枚举

- `stage_reviewer`
- `project_owner`
- `fixed_user`
- `system_role`
- `business_identity`

V1 先不要做过于复杂的表达式引擎。

## 8. 业务流程落地方式

## 8.1 阶段成果提交流程

推荐节点：

1. 提交节点
2. 审核节点
3. 结束节点

### 业务联动

- 提交时：
  - 创建 `review_submission`
  - 当前阶段进入 `pending_review`
  - 项目进入 `under_review`
  - 清单版本进入 `submitted`

- 审核通过时：
  - `review_submission` 置为 `approved`
  - 阶段进入 `approved`
  - 清单版本进入 `approved`

- 审核驳回时：
  - `review_submission` 置为 `rejected`
  - 阶段回到 `in_progress`
  - 清单版本回到 `editable`

## 8.2 锁定/解锁流程

推荐节点：

1. 发起锁定/解锁申请
2. 审批节点
3. 结束节点

### 业务联动

- 发起锁定申请：
  - `lock_status = lock_requested`
  - 创建 `review_submission(submission_type=lock_request)`

- 锁定通过：
  - `lock_status = locked`
  - `bill_version.status = locked`

- 发起解锁申请：
  - `lock_status = unlock_requested`
  - 创建 `review_submission(submission_type=unlock_request)`

- 解锁通过：
  - `lock_status = unlocked`
  - `bill_version.status = editable`

## 8.3 过程单据流程

适用：

- `change_order`
- `site_visa`
- `progress_payment`

推荐节点：

1. 填报节点
2. 审核节点
3. 结束节点

### 业务联动

- 提交时单据进入 `pending_review`
- 通过时进入 `approved`
- 驳回时进入 `rejected`
- 驳回后允许退回修改再提

## 9. 接口设计建议

## 9.1 流程定义接口

V1 可先做后台管理接口：

- `GET /api/v1/workflow-definitions`
- `POST /api/v1/workflow-definitions`
- `POST /api/v1/workflow-definitions/{id}/publish`
- `GET /api/v1/workflow-bindings`
- `PUT /api/v1/workflow-bindings/{id}`

## 9.2 运行时接口

- `POST /api/v1/projects/{id}/review-submissions`
- `POST /api/v1/workflow-tasks/{id}/approve`
- `POST /api/v1/workflow-tasks/{id}/reject`
- `POST /api/v1/workflow-tasks/{id}/cancel`
- `GET /api/v1/workflow-instances/{id}`
- `GET /api/v1/workflow-tasks/todo`

## 9.3 表单接口

- `GET /api/v1/forms/by-binding`
- `GET /api/v1/workflow-tasks/{id}/form`
- `POST /api/v1/workflow-tasks/{id}/form-submissions`

## 10. 前端渲染建议

## 10.1 流程表单页面形态

推荐页面组成：

- 顶部：业务对象摘要
- 中部：动态表单区
- 右侧：流程轨迹 / 审批记录
- 底部：动作按钮区

## 10.2 动作按钮规则

按钮显示不只看流程节点，还要看业务权限。

例如：

- 有 `review` 权限且任务归属本人，显示“通过/驳回”
- 有 `submit` 权限且对象可提交，显示“提交”
- 流程已结束，所有操作按钮隐藏，仅显示历史记录

## 10.3 审批轨迹展示

建议统一展示：

- 发起人
- 发起时间
- 当前节点
- 历史节点
- 审核意见
- 动作结果

## 11. 审计与追溯

以下动作必须写 `audit_log`：

- 发起流程实例
- 提交流程表单
- 审核通过
- 审核驳回
- 撤回
- 锁定通过
- 解锁通过
- 字段权限配置变更
- 流程绑定变更

## 12. V1 与 V1.1 边界

## 12.1 V1 必做

- Flowable 集成
- 流程定义与流程绑定
- 表单 schema / ui schema
- 节点字段权限
- 审批人规则
- 审核流 / 锁定流 / 过程单据流

## 12.2 V1.1 再做

- 可视化流程设计器
- 更复杂的审批表达式
- 表单联动脚本
- 流程 SLA / 超时提醒
- 外部系统回调节点

## 13. 推荐开发顺序

最推荐的开发顺序：

1. 建 `workflow_*` 与 `form_*` 基础表
2. 接入 Flowable 运行时
3. 打通阶段成果提交流程
4. 再接锁定/解锁流程
5. 再接过程单据流程
6. 最后补流程后台配置页

## 14. 一句话结论

本项目的流程低代码方案，最适合走：

`Flowable 负责流程流转，自研表单 schema 与节点权限层负责业务表单配置，业务系统继续掌握清单、单据、审核和锁定的主状态。`

