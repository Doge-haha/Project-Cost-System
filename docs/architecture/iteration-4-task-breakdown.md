# 新点 SaaS 造价系统 Iteration 4 任务拆分

> 基于 [2026-04-16-saas-pricing-v1-implementation.md](/Users/huahaha/Documents/New%20project/docs/superpowers/plans/2026-04-16-saas-pricing-v1-implementation.md)、[data-model.md](/Users/huahaha/Documents/New%20project/docs/architecture/data-model.md)、[state-machines.md](/Users/huahaha/Documents/New%20project/docs/architecture/state-machines.md)、[permission-matrix.md](/Users/huahaha/Documents/New%20project/docs/architecture/permission-matrix.md) 与 [openapi-v1.yaml](/Users/huahaha/Documents/New%20project/docs/api/openapi-v1.yaml) 整理。

## 1. 迭代目标

Iteration 4 的目标，是把前三轮已经形成的项目、清单、定额和计价结果真正纳入“可汇总、可审核、可导出、可追溯”的闭环。

本迭代重点覆盖：

- `review_submission`
- `audit_log`
- 汇总查询
- 偏差分析
- 报表导出任务
- 审核通过/驳回/撤回
- 阶段状态、项目状态与版本状态联动

本迭代不要求完成：

- AI 推荐
- 市场价自动采集
- 复杂第三方系统对接

## 2. 交付范围

### 2.1 后端交付

- `review_submission`
- `audit_log`
- 汇总聚合服务
- 偏差分析服务
- 报表导出任务服务
- 审核流服务

### 2.2 前端交付

- 汇总页面
- 偏差分析视图
- 报表中心
- 提交审核弹层
- 审核处理页
- 审计日志查看页

### 2.3 测试交付

- 审核流单元测试
- 状态联动测试
- 汇总计算集成测试
- 导出任务状态测试
- 审计日志完整性测试

## 3. 任务拆分

## 3.1 数据库与迁移

### 3.1.1 建表任务

- [ ] 创建 `review_submission`
- [ ] 创建 `audit_log`

### 3.1.2 字段补齐

- [ ] `review_submission` 加入 `submission_type`
- [ ] `review_submission` 加入 `status`
- [ ] `review_submission` 加入 `submitted_by`
- [ ] `review_submission` 加入 `reviewed_by`
- [ ] `review_submission` 加入 `submitted_at`
- [ ] `review_submission` 加入 `reviewed_at`
- [ ] `review_submission` 加入 `review_comment`
- [ ] `audit_log` 加入 `resource_type`
- [ ] `audit_log` 加入 `resource_id`
- [ ] `audit_log` 加入 `action`
- [ ] `audit_log` 加入 `operator_id`
- [ ] `audit_log` 加入 `project_id`
- [ ] `audit_log` 加入 `stage_code`
- [ ] `audit_log` 加入 `before_payload`
- [ ] `audit_log` 加入 `after_payload`

### 3.1.3 索引与约束

- [ ] 为 `review_submission(project_stage_id, resource_type, resource_id, status)` 建索引
- [ ] 为 `audit_log(resource_type, resource_id, created_at desc)` 建索引
- [ ] 增加“同一资源不可并存多个 `pending` 记录”的业务约束

验收标准：

- 审核记录和审计日志可独立建表并稳定写入
- 可按资源快速查询最近审计日志

## 3.2 枚举与常量

- [ ] 固化审核状态枚举：`pending`, `approved`, `rejected`, `cancelled`
- [ ] 固化提交类型枚举：`stage_submit`, `lock_request`, `unlock_request`
- [ ] 固化报表任务状态枚举：`queued`, `processing`, `completed`, `failed`
- [ ] 固化审计动作枚举：`create`, `update`, `submit`, `approve`, `reject`, `lock`, `unlock`, `export`

验收标准：

- 枚举值与 [state-machines.md](/Users/huahaha/Documents/New%20project/docs/architecture/state-machines.md) 保持一致

## 3.3 审核流模块

### 3.3.1 接口任务

- [ ] 实现 `POST /api/v1/projects/{id}/review-submissions`

### 3.3.2 建议新增接口

- [ ] 增加 `GET /api/v1/projects/{id}/review-submissions`
- [ ] 增加 `POST /api/v1/projects/{id}/review-submissions/{submissionId}/approve`
- [ ] 增加 `POST /api/v1/projects/{id}/review-submissions/{submissionId}/reject`
- [ ] 增加 `POST /api/v1/projects/{id}/review-submissions/{submissionId}/cancel`

### 3.3.3 业务规则

- [ ] 提交审核前校验资源状态必须为可提交态
- [ ] 同一资源存在 `pending` 时禁止重复提交
- [ ] 审核人与提交人不能为同一人
- [ ] 审核通过时联动更新资源状态
- [ ] 审核驳回时保留驳回意见
- [ ] 撤回只允许发生在未审核前

验收标准：

- 清单版本可提交审核
- 审核通过后资源进入正确下游状态
- 审核驳回后资源回到可编辑状态

## 3.4 状态联动

- [ ] 清单版本 `editable -> submitted -> approved -> locked`
- [ ] 阶段 `in_progress -> pending_review -> approved -> completed`
- [ ] 项目 `in_progress -> under_review -> in_progress`
- [ ] 审核驳回时联动阶段回退
- [ ] 锁定申请与解锁申请走审核流

验收标准：

- 一个资源状态变化后，对应阶段和项目状态同步正确
- 锁定与解锁申请都能进入审核记录表

## 3.5 汇总服务

### 3.5.1 接口任务

- [ ] 实现 `GET /api/v1/reports/summary`

### 3.5.2 汇总维度

- [ ] 支持按项目汇总
- [ ] 支持按阶段汇总
- [ ] 支持按专业汇总
- [ ] 支持按单体汇总

### 3.5.3 汇总口径

- [ ] 支持系统值汇总
- [ ] 支持最终值汇总
- [ ] 支持含税/不含税口径
- [ ] 支持清单金额与定额金额的一致性校验

验收标准：

- 可按项目、阶段、专业、单体查看汇总结果
- 汇总结果可区分系统值和最终值

## 3.6 偏差分析

### 3.6.1 查询能力

- [ ] 支持对比上游版本与当前版本
- [ ] 支持对比系统值与最终值
- [ ] 支持按专业查看偏差
- [ ] 支持按单体查看偏差

### 3.6.2 指标规则

- [ ] 输出偏差金额
- [ ] 输出偏差比例
- [ ] 输出高偏差清单项
- [ ] 支持设置告警阈值

验收标准：

- 汇总页可展示偏差金额和偏差率
- 可筛出偏差较大的清单项

## 3.7 报表导出任务

### 3.7.1 接口任务

- [ ] 实现 `POST /api/v1/reports/export`

### 3.7.2 建议新增接口

- [ ] 增加 `GET /api/v1/reports/export/{taskId}`
- [ ] 增加 `GET /api/v1/reports/export/{taskId}/download`

### 3.7.3 任务规则

- [ ] 导出走异步任务
- [ ] 创建任务默认进入 `queued`
- [ ] 执行中为 `processing`
- [ ] 成功后为 `completed`
- [ ] 失败时写入错误信息

### 3.7.4 导出范围

- [ ] 支持汇总报表
- [ ] 支持阶段清单报表
- [ ] 支持偏差分析报表
- [ ] 预留结算报表模板

验收标准：

- 导出接口返回 `202`
- 任务状态可被查询
- 导出失败时能返回错误原因

## 3.8 审计日志

- [ ] 项目状态变化写审计日志
- [ ] 阶段状态变化写审计日志
- [ ] 清单版本提交/通过/驳回/锁定写审计日志
- [ ] 定额和计价结果关键改动写审计日志
- [ ] 报表导出任务创建写审计日志
- [ ] 审核处理动作写审计日志

验收标准：

- 所有关键状态切换都能查询到日志
- `before_payload` 和 `after_payload` 至少覆盖核心变更字段

## 3.9 权限与页面控制

- [ ] 实现 `summary:view`
- [ ] 实现 `report:export`
- [ ] 实现 `review`
- [ ] 实现 `audit_log:view`
- [ ] 实现审核页与汇总页按钮显隐规则

验收标准：

- `reviewer` 可审核但不能替代编制人修改业务数据
- `review_analyst` 可查看汇总和复盘指标但不能发起审核
- 无导出权限用户不能创建报表任务

## 3.10 前端联动建议

- [ ] 汇总页支持多维筛选
- [ ] 偏差分析支持高亮异常项
- [ ] 审核弹层展示提交对象、提交人、提交时间
- [ ] 审核页支持通过、驳回、撤回
- [ ] 审计日志页支持按资源和时间过滤
- [ ] 报表中心展示任务状态与下载入口

前端最少展示字段：

- `totalAmount`
- `varianceRate`
- `disciplineCode`
- `unitCode`
- `submissionType`
- `status`
- `reviewComment`
- `action`
- `operatorId`
- `createdAt`

## 4. 建议排期

### Day 1-2

- 建表迁移
- 审核流接口
- 状态联动服务

### Day 3-4

- 汇总查询
- 偏差分析

### Day 5-6

- 报表导出任务
- 审计日志接入

### Day 7

- 权限联调
- 集成测试
- 文档回写

## 5. 联调顺序

建议按下面顺序联调：

1. 提交审核
2. 审核通过/驳回/撤回
3. 查看状态联动结果
4. 查询汇总
5. 查询偏差分析
6. 发起报表导出
7. 查询审计日志

## 6. 风险点

- 如果审核流和状态机分开实现，很容易出现“审核通过了但阶段没推进”的不一致
- 如果汇总口径没有先定义系统值和最终值，报表结果会前后不一致
- 如果审计日志接入太晚，很多关键状态切换会无法补历史
- 如果报表导出不做异步，会直接拖慢主请求

## 7. 完成标准

Iteration 4 完成时，至少满足以下结果：

- 清单和阶段成果可以提交审核
- 审核通过、驳回、撤回都能走通
- 可按项目、阶段、专业、单体查看汇总
- 可查看偏差分析
- 可异步导出标准报表
- 所有关键状态和关键动作都有审计日志

