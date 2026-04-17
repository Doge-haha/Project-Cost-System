# 新点 SaaS 造价系统 Iteration 2 任务拆分

> 基于 [2026-04-16-saas-pricing-v1-implementation.md](/Users/huahaha/Documents/New%20project/docs/superpowers/plans/2026-04-16-saas-pricing-v1-implementation.md)、[data-model.md](/Users/huahaha/Documents/New%20project/docs/architecture/data-model.md)、[source-field-mapping.md](/Users/huahaha/Documents/New%20project/docs/architecture/source-field-mapping.md)、[permission-matrix.md](/Users/huahaha/Documents/New%20project/docs/architecture/permission-matrix.md) 与 [openapi-v1.yaml](/Users/huahaha/Documents/New%20project/docs/api/openapi-v1.yaml) 整理。

## 1. 迭代目标

Iteration 2 的目标，是把“清单与版本链”真正落地，让系统从项目配置层进入业务数据层。

本迭代重点覆盖：

- `bill_version`、`bill_item`、`bill_item_work_item`
- 清单树结构与排序
- 版本创建、引用、分叉、来源追溯
- 初始清单导入
- 合同清单锁定前置能力
- 清单提交审核前置能力

本迭代不要求完成：

- 定额正式套用
- 计价引擎
- 取费规则
- 报表导出
- AI 推荐

## 2. 交付范围

### 2.1 后端交付

- `bill_version`
- `bill_item`
- `bill_item_work_item`
- 清单版本服务
- 清单树服务
- 清单导入服务
- 版本来源追溯能力

### 2.2 前端交付

- 清单列表页
- 清单树结构操作
- 清单详情侧栏
- 工作内容维护区
- 版本切换与来源查看
- 导入初始清单入口

### 2.3 测试交付

- 版本链单元测试
- 清单树结构集成测试
- 导入流程测试
- 锁定前置规则测试

## 3. 任务拆分

## 3.1 数据库与迁移

### 3.1.1 建表任务

- [ ] 创建 `bill_version`
- [ ] 创建 `bill_item`
- [ ] 创建 `bill_item_work_item`

### 3.1.2 字段补齐

- [ ] `bill_version` 加入 `source_spec_code`
- [ ] `bill_version` 加入 `source_spec_name`
- [ ] `bill_version` 加入 `source_visible_flag`
- [ ] `bill_version` 加入 `source_default_flag`
- [ ] `bill_item` 加入 `source_bill_id`
- [ ] `bill_item` 加入 `source_sequence`
- [ ] `bill_item` 加入 `source_level_code`
- [ ] `bill_item` 加入 `is_measure_item`
- [ ] `bill_item` 加入 `source_reference_price`
- [ ] `bill_item` 加入 `source_fee_id`
- [ ] `bill_item` 加入 `measure_category`
- [ ] `bill_item` 加入 `measure_fee_flag`
- [ ] `bill_item` 加入 `measure_category_subtype`
- [ ] `bill_item_work_item` 加入 `source_spec_code`
- [ ] `bill_item_work_item` 加入 `source_bill_id`

### 3.1.3 索引与约束

- [ ] 为 `bill_version(project_id, stage_id, version_no)` 建唯一索引
- [ ] 为 `bill_item(bill_version_id, item_code, parent_id)` 建业务唯一索引
- [ ] 为 `bill_item_work_item(bill_item_id, sort_order)` 建唯一索引
- [ ] 建立 `bill_item.parent_id -> bill_item.id` 外键
- [ ] 建立 `bill_item_work_item.bill_item_id -> bill_item.id` 外键

验收标准：

- 能完成清单版本、清单项、工作内容的完整迁移
- 清单项和工作内容可按父子关系正确存储
- 同一版本下清单编号不允许重复冲突

## 3.2 枚举与常量

- [ ] 固化清单版本类型枚举：`initial`, `reference_copy`, `contract_baseline`, `change`, `settlement`
- [ ] 固化清单版本状态枚举：`editable`, `submitted`, `approved`, `locked`, `rejected`
- [ ] 固化清单锁定状态枚举：`unlocked`, `lock_requested`, `locked`, `unlock_requested`
- [ ] 固化清单校验状态枚举：`normal`, `warning`, `error`

验收标准：

- 枚举值与 [state-machines.md](/Users/huahaha/Documents/New%20project/docs/architecture/state-machines.md) 保持一致

## 3.3 清单版本服务

### 3.3.1 创建与查询

- [ ] 实现创建空白清单版本
- [ ] 实现按项目和阶段查询版本列表
- [ ] 实现按版本 ID 查询版本详情

### 3.3.2 引用与分叉

- [ ] 实现从上游版本创建 `reference_copy`
- [ ] 实现记录 `source_stage_id`
- [ ] 实现记录 `source_version_id`
- [ ] 实现保留来源展示字段
- [ ] 实现分叉后新版本默认进入 `editable`

### 3.3.3 合同基线前置

- [ ] 预留 `contract_baseline` 创建逻辑
- [ ] 预留锁定前版本状态校验

验收标准：

- 招标清单可生成投标报价版本
- 投标报价可生成合同清单基线版本
- 任意版本可查看上游来源

## 3.4 清单树结构

### 3.4.1 数据层

- [ ] 实现 `bill_item` 仓储
- [ ] 支持树形父子关系查询
- [ ] 支持同级 `sort_order` 排序

### 3.4.2 业务层

- [ ] 按 `item_code` 和 `parent_id` 建树
- [ ] 支持章、节、清单项三级或多级展示
- [ ] 支持根节点批量创建
- [ ] 支持子节点插入
- [ ] 支持节点移动后的排序重排

### 3.4.3 规则校验

- [ ] 禁止形成循环父子关系
- [ ] 禁止子节点跨版本挂载
- [ ] 禁止锁定版本内修改树结构

验收标准：

- 一个版本内可正确展示完整树结构
- 排序调整后返回顺序稳定
- 非法父子关系写入会被拦截

## 3.5 工作内容子表

### 3.5.1 接口任务

- [ ] 实现 `GET /api/v1/projects/{id}/bill-items/{itemId}/work-items`
- [ ] 实现 `POST /api/v1/projects/{id}/bill-items/{itemId}/work-items`
- [ ] 实现 `PUT /api/v1/projects/{id}/bill-items/{itemId}/work-items/{workItemId}`

### 3.5.2 业务规则

- [ ] 工作内容按 `sort_order` 排序
- [ ] 工作内容必须归属一个有效清单项
- [ ] 锁定版本下禁止编辑工作内容
- [ ] 父清单项删除或失效时同步处理工作内容

验收标准：

- 每个清单项可维护多条工作内容
- 工作内容顺序可稳定保存
- 父清单锁定后工作内容进入只读

## 3.6 清单接口

### 3.6.1 已定义接口实现

- [ ] 实现 `GET /api/v1/projects/{id}/bill-items`
- [ ] 实现 `POST /api/v1/projects/{id}/bill-items`
- [ ] 实现 `PUT /api/v1/projects/{id}/bill-items/{itemId}`

### 3.6.2 建议新增接口

- [ ] 增加 `GET /api/v1/projects/{id}/bill-versions`
- [ ] 增加 `POST /api/v1/projects/{id}/bill-versions`
- [ ] 增加 `POST /api/v1/projects/{id}/bill-versions/{versionId}/copy-from`
- [ ] 增加 `GET /api/v1/projects/{id}/bill-versions/{versionId}/source-chain`

### 3.6.3 过滤与查询能力

- [ ] 支持按 `stageCode` 查询清单
- [ ] 支持按 `billVersionId` 查询清单
- [ ] 支持按 `disciplineCode` 查询清单
- [ ] 支持按关键字搜索 `item_code` / `item_name`

验收标准：

- 前端可按版本切换清单数据
- 前端可查看来源链
- 查询接口能支撑树形页面和详情侧栏

## 3.7 源数据导入

### 3.7.1 导入对象

- [ ] 支持导入 `ZaoJia_Qd_QdList`
- [ ] 支持导入 `ZaoJia_Qd_Qdxm`
- [ ] 支持导入 `ZaoJia_Qd_Gznr`

### 3.7.2 映射规则

- [ ] `QdGf -> bill_version.source_spec_code`
- [ ] `Qdmc -> bill_version.source_spec_name`
- [ ] `QdID -> bill_item.source_bill_id`
- [ ] `Sjxh -> bill_item.source_sequence`
- [ ] `Qdbh -> bill_item.item_code`
- [ ] `Xmmc -> bill_item.item_name`
- [ ] `Dw -> bill_item.unit`
- [ ] `Jsgz -> bill_item.feature_rule_text`
- [ ] `Fbcch -> bill_item.source_level_code`
- [ ] `Iscs -> bill_item.is_measure_item`
- [ ] `Dj -> bill_item.source_reference_price`
- [ ] `QfID -> bill_item.source_fee_id`
- [ ] `Cslb -> bill_item.measure_category`
- [ ] `CsfyBj -> bill_item.measure_fee_flag`
- [ ] `CslbXf -> bill_item.measure_category_subtype`
- [ ] `Gznr -> bill_item_work_item.work_content`

### 3.7.3 导入流程

- [ ] 解析源文件
- [ ] 先创建 `bill_version`
- [ ] 再批量创建 `bill_item`
- [ ] 最后创建 `bill_item_work_item`
- [ ] 导入完成后生成导入摘要
- [ ] 导入失败时保留错误明细

### 3.7.4 导入约束

- [ ] 导入只允许生成 `initial` 类型版本
- [ ] 导入后版本默认为 `editable`
- [ ] 导入过程不直接生成合同基线
- [ ] 导入权限要求 `bill:import` 或项目级导入能力

验收标准：

- 可从江苏源样本导入一版完整初始清单
- 导入后可看到树结构和工作内容
- 导入失败时能定位到具体记录

## 3.8 权限与锁定

- [ ] 实现 `bill:view`
- [ ] 实现 `bill:edit`
- [ ] 实现 `bill:submit`
- [ ] 实现 `bill_work_item:view`
- [ ] 实现 `bill_work_item:edit`
- [ ] 实现 `bill:import`
- [ ] 实现锁定版本写接口统一返回 `423`

验收标准：

- `reviewer` 只能查看清单和工作内容
- `cost_engineer` 可导入初始清单，但不能越权导入其他项目
- 锁定版本下所有清单写接口统一受限

## 3.9 审计与追溯

- [ ] 清单版本创建写审计日志
- [ ] 清单导入写审计日志
- [ ] 清单项新增/修改写审计日志
- [ ] 工作内容新增/修改写审计日志
- [ ] 版本引用和分叉写审计日志

验收标准：

- 任意版本创建来源可追溯
- 任意清单项变更可追溯到操作人和时间

## 3.10 前端联动建议

- [ ] 版本下拉切换
- [ ] 清单树展开/折叠
- [ ] 详情侧栏展示源字段与来源信息
- [ ] 工作内容面板支持增改
- [ ] 导入结果反馈弹层

前端最少展示字段：

- `itemCode`
- `itemName`
- `unit`
- `quantity`
- `sourceVersionLabel`
- `validationStatus`
- `sourceLevelCode`
- `isMeasureItem`

## 4. 建议排期

### Day 1-2

- 建表迁移
- 版本服务
- 清单树数据层

### Day 3-4

- 清单接口
- 工作内容接口
- 权限中间件

### Day 5-6

- 初始导入能力
- 来源追溯
- 审计日志

### Day 7

- 前后端联调
- 集成测试
- 文档回写

## 5. 联调顺序

建议按下面顺序联调：

1. 创建空白版本
2. 查询版本列表
3. 新增清单项
4. 编辑清单项
5. 查询和编辑工作内容
6. 导入初始清单
7. 查看来源链

## 6. 风险点

- `item_level` 和 `source_level_code` 很容易被误当成同一个字段
- 若一开始不把 `bill_item_work_item` 作为独立子表，后面导入和兼容会返工
- 若导入直接写死为扁平表结构，后面树形清单页面会很难补救
- 如果版本引用与导入都不写审计日志，后面追溯链会断

## 7. 完成标准

Iteration 2 完成时，至少满足以下结果：

- 可以创建、查询和切换清单版本
- 可以维护树形清单项
- 可以维护清单工作内容
- 可以从源样本导入一版初始清单
- 可以查看来源版本与来源链
- 锁定前置规则和权限校验生效

